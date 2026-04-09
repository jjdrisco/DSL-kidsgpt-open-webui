"""replace session_number with session_id

Revision ID: f1a2b3c4d5e6
Revises: merge_all_heads_2026_03_03
Create Date: 2026-04-09 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "merge_all_heads_2026_03_03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(inspector, table_name: str) -> set[str]:
    return {c["name"] for c in inspector.get_columns(table_name)}


def _drop_indexes_with_session_number(table_name: str) -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    try:
        indexes = inspector.get_indexes(table_name)
    except Exception:
        return

    for idx in indexes:
        name = idx.get("name")
        cols = idx.get("column_names") or []
        if not name:
            continue
        if "session_number" in cols:
            try:
                op.drop_index(name, table_name=table_name)
            except Exception:
                pass


def _index_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = inspect(bind)
    try:
        return {i.get("name") for i in inspector.get_indexes(table_name) if i.get("name")}
    except Exception:
        return set()


def _add_and_backfill_session_id(table_name: str, nullable: bool = False) -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    cols = _columns(inspector, table_name)

    if "session_number" not in cols:
        return

    # SQLite batch table rewrites recreate indexes; drop session_number-based
    # indexes first so they are not recreated against a dropped column.
    _drop_indexes_with_session_number(table_name)

    if "session_id" not in cols:
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.add_column(sa.Column("session_id", sa.Text(), nullable=True))

    # Copy any legacy integer values into the new text column.
    bind.execute(
        text(
            f"UPDATE {table_name} "
            "SET session_id = CAST(session_number AS TEXT) "
            "WHERE session_number IS NOT NULL "
            "AND (session_id IS NULL OR session_id = '')"
        )
    )

    with op.batch_alter_table(table_name) as batch_op:
        if not nullable:
            batch_op.alter_column("session_id", existing_type=sa.Text(), nullable=False)
        batch_op.drop_column("session_number")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # user table no longer keeps a separate session_number counter.
    if "user" in inspector.get_table_names() and "session_number" in _columns(inspector, "user"):
        with op.batch_alter_table("user") as batch_op:
            batch_op.drop_column("session_number")

    _add_and_backfill_session_id("moderation_session", nullable=False)
    _add_and_backfill_session_id("moderation_session_activity", nullable=False)
    _add_and_backfill_session_id("child_profile", nullable=False)
    _add_and_backfill_session_id("assignment_session_activity", nullable=False)

    # concern_item already has session_id in this codebase; only drop legacy column.
    if "concern_item" in inspector.get_table_names() and "session_number" in _columns(inspector, "concern_item"):
        _drop_indexes_with_session_number("concern_item")
        bind.execute(
            text(
                "UPDATE concern_item "
                "SET session_id = CAST(session_number AS TEXT) "
                "WHERE session_number IS NOT NULL "
                "AND (session_id IS NULL OR session_id = '')"
            )
        )
        with op.batch_alter_table("concern_item") as batch_op:
            batch_op.drop_column("session_number")

    # Whitelist check tables are nullable by design.
    for table_name in ("prompt_comparison_check", "response_validation_check"):
        if table_name in inspector.get_table_names() and "session_number" in _columns(inspector, table_name):
            if "session_id" not in _columns(inspector, table_name):
                with op.batch_alter_table(table_name) as batch_op:
                    batch_op.add_column(sa.Column("session_id", sa.Text(), nullable=True))
            bind.execute(
                text(
                    f"UPDATE {table_name} "
                    "SET session_id = CAST(session_number AS TEXT) "
                    "WHERE session_number IS NOT NULL "
                    "AND (session_id IS NULL OR session_id = '')"
                )
            )
            with op.batch_alter_table(table_name) as batch_op:
                batch_op.drop_column("session_number")

    # Replace known session-number indexes with session-id equivalents.
    if "idx_mod_session_user_session" in _index_names("moderation_session"):
        with op.batch_alter_table("moderation_session") as batch_op:
            batch_op.drop_index("idx_mod_session_user_session")
    if "idx_mod_session_user_session" not in _index_names("moderation_session"):
        with op.batch_alter_table("moderation_session") as batch_op:
            batch_op.create_index("idx_mod_session_user_session", ["user_id", "session_id"])

    if (
        "idx_mod_activity_user_child_session_attempt"
        in _index_names("moderation_session_activity")
    ):
        with op.batch_alter_table("moderation_session_activity") as batch_op:
            batch_op.drop_index("idx_mod_activity_user_child_session_attempt")
    if (
        "idx_mod_activity_user_child_session_attempt"
        not in _index_names("moderation_session_activity")
    ):
        with op.batch_alter_table("moderation_session_activity") as batch_op:
            batch_op.create_index(
                "idx_mod_activity_user_child_session_attempt",
                ["user_id", "child_id", "session_id", "attempt_number"],
            )

    if "idx_child_profile_user_session_current" in _index_names("child_profile"):
        with op.batch_alter_table("child_profile") as batch_op:
            batch_op.drop_index("idx_child_profile_user_session_current")
    if "idx_child_profile_user_session_current" not in _index_names("child_profile"):
        with op.batch_alter_table("child_profile") as batch_op:
            batch_op.create_index(
                "idx_child_profile_user_session_current",
                ["user_id", "session_id", "is_current"],
            )

    if "idx_assignment_activity_user_session_attempt" in _index_names(
        "assignment_session_activity"
    ):
        with op.batch_alter_table("assignment_session_activity") as batch_op:
            batch_op.drop_index("idx_assignment_activity_user_session_attempt")
    if "idx_assignment_activity_user_session_attempt" not in _index_names(
        "assignment_session_activity"
    ):
        with op.batch_alter_table("assignment_session_activity") as batch_op:
            batch_op.create_index(
                "idx_assignment_activity_user_session_attempt",
                ["user_id", "session_id", "attempt_number"],
            )


def downgrade() -> None:
    # Downgrade intentionally omitted for this schema migration.
    pass
