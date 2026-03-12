"""add_concern_item_table

Revision ID: aa00bb11cc22
Revises: zz_add_scenario_id_to_moderation
Create Date: 2026-03-01 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision: str = "aa00bb11cc22"
down_revision: Union[str, None] = "zz_add_scenario_id_to_moderation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the concern_item table for per-concern storage with individual Likert ratings."""
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    existing_tables = inspector.get_table_names()

    if "concern_item" not in existing_tables:
        op.create_table(
            "concern_item",
            sa.Column("id", sa.Text, primary_key=True),
            sa.Column("session_id", sa.Text, nullable=False),
            sa.Column("user_id", sa.Text, nullable=False),
            sa.Column("child_id", sa.Text, nullable=False),
            sa.Column("scenario_index", sa.Integer, nullable=False),
            sa.Column("attempt_number", sa.Integer, nullable=False),
            sa.Column("version_number", sa.Integer, nullable=False),
            sa.Column("session_number", sa.Integer, nullable=False, server_default="1"),
            sa.Column("scenario_id", sa.Text, nullable=True),
            sa.Column("position", sa.Integer, nullable=False, server_default="0"),
            sa.Column("text", sa.Text, nullable=False, server_default=""),
            sa.Column("concern_level", sa.Integer, nullable=True),
            sa.Column(
                "linked_highlights", sa.Text, nullable=True
            ),  # JSON stored as Text
            sa.Column("created_at", sa.BigInteger, nullable=False),
            sa.Column("updated_at", sa.BigInteger, nullable=False),
        )

        op.create_index("ix_concern_item_session_id", "concern_item", ["session_id"])
        op.create_index("ix_concern_item_user_id", "concern_item", ["user_id"])
        op.create_index(
            "ix_concern_item_context",
            "concern_item",
            [
                "user_id",
                "child_id",
                "scenario_index",
                "attempt_number",
                "version_number",
                "session_number",
            ],
        )


def downgrade() -> None:
    """Drop the concern_item table."""
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    existing_tables = inspector.get_table_names()

    if "concern_item" in existing_tables:
        op.drop_index("ix_concern_item_context", table_name="concern_item")
        op.drop_index("ix_concern_item_user_id", table_name="concern_item")
        op.drop_index("ix_concern_item_session_id", table_name="concern_item")
        op.drop_table("concern_item")
