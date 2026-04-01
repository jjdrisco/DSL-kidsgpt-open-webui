"""Add attempt_number column to moderation_session_activity

Revision ID: add_attempt_number_to_mod_activity
Revises: 4f919f805a75
Create Date: 2026-03-25 00:00:01.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = "7b3e2c9f1d04"
down_revision = "add_attempt_number_to_assignment_activity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)

    if "moderation_session_activity" not in inspector.get_table_names():
        return

    existing_cols = [
        c["name"] for c in inspector.get_columns("moderation_session_activity")
    ]

    # Add attempt_number column
    if "attempt_number" not in existing_cols:
        op.add_column(
            "moderation_session_activity",
            sa.Column(
                "attempt_number",
                sa.BigInteger(),
                nullable=True,
                server_default="1",
            ),
        )

    # Replace index to include attempt_number
    existing_indexes = [
        idx["name"] for idx in inspector.get_indexes("moderation_session_activity")
    ]
    if "idx_mod_activity_user_child_session" in existing_indexes:
        op.drop_index(
            "idx_mod_activity_user_child_session",
            table_name="moderation_session_activity",
        )
    op.create_index(
        "idx_mod_activity_user_child_session_attempt",
        "moderation_session_activity",
        ["user_id", "child_id", "session_number", "attempt_number"],
    )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)

    if "moderation_session_activity" not in inspector.get_table_names():
        return

    existing_indexes = [
        idx["name"] for idx in inspector.get_indexes("moderation_session_activity")
    ]
    if "idx_mod_activity_user_child_session_attempt" in existing_indexes:
        op.drop_index(
            "idx_mod_activity_user_child_session_attempt",
            table_name="moderation_session_activity",
        )

    existing_cols = [
        c["name"] for c in inspector.get_columns("moderation_session_activity")
    ]
    if "attempt_number" in existing_cols:
        op.drop_column("moderation_session_activity", "attempt_number")

    # Restore original index
    op.create_index(
        "idx_mod_activity_user_child_session",
        "moderation_session_activity",
        ["user_id", "child_id", "session_number"],
    )
