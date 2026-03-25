"""Add attempt_number column to assignment_session_activity

Revision ID: add_attempt_number_to_assignment_activity
Revises: rm_attention_check_cleanup
Create Date: 2026-03-25 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = "add_attempt_number_to_assignment_activity"
down_revision = ("rm_attention_check_cleanup", "aa11bb22cc44")
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)

    if "assignment_session_activity" not in inspector.get_table_names():
        return

    existing_cols = [
        c["name"] for c in inspector.get_columns("assignment_session_activity")
    ]

    # Add attempt_number column
    if "attempt_number" not in existing_cols:
        op.add_column(
            "assignment_session_activity",
            sa.Column(
                "attempt_number",
                sa.BigInteger(),
                nullable=True,
                server_default="1",
            ),
        )

    # Replace index to include attempt_number
    existing_indexes = [
        idx["name"] for idx in inspector.get_indexes("assignment_session_activity")
    ]
    if "idx_assignment_activity_user_session" in existing_indexes:
        op.drop_index(
            "idx_assignment_activity_user_session",
            table_name="assignment_session_activity",
        )
    op.create_index(
        "idx_assignment_activity_user_session_attempt",
        "assignment_session_activity",
        ["user_id", "session_number", "attempt_number"],
    )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)

    if "assignment_session_activity" not in inspector.get_table_names():
        return

    existing_indexes = [
        idx["name"] for idx in inspector.get_indexes("assignment_session_activity")
    ]
    if "idx_assignment_activity_user_session_attempt" in existing_indexes:
        op.drop_index(
            "idx_assignment_activity_user_session_attempt",
            table_name="assignment_session_activity",
        )

    existing_cols = [
        c["name"] for c in inspector.get_columns("assignment_session_activity")
    ]
    if "attempt_number" in existing_cols:
        op.drop_column("assignment_session_activity", "attempt_number")

    # Restore original index
    op.create_index(
        "idx_assignment_activity_user_session",
        "assignment_session_activity",
        ["user_id", "session_number"],
    )
