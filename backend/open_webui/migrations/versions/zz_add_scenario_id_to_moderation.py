"""add_scenario_id_to_moderation

Revision ID: zz_add_scenario_id_to_moderation
Revises: 19b49840514
Create Date: 2026-02-20 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision: str = "zz_add_scenario_id_to_moderation"
down_revision: Union[str, None] = "z22a33b44c55"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Add scenario_id column to moderation_session so sessions can be linked
    back to the canonical scenarios table.  Nullable to preserve existing rows.
    """
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    existing_columns = [
        col["name"] for col in inspector.get_columns("moderation_session")
    ]

    with op.batch_alter_table("moderation_session") as batch_op:
        if "scenario_id" not in existing_columns:
            batch_op.add_column(sa.Column("scenario_id", sa.Text(), nullable=True))
            # optional index; SQLite adds automatically when using batch_op.create_index
            try:
                batch_op.create_index(
                    "idx_moderation_session_scenario_id", ["scenario_id"]
                )
            except Exception:
                # some dialects may not support creating index inside batch
                pass


def downgrade() -> None:
    """
    Remove scenario_id column from moderation_session.
    """
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    existing_columns = [
        col["name"] for col in inspector.get_columns("moderation_session")
    ]

    with op.batch_alter_table("moderation_session") as batch_op:
        if "scenario_id" in existing_columns:
            batch_op.drop_column("scenario_id")
