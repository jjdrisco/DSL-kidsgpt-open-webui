"""add highlight_levels to concern_item

Revision ID: bb11cc22dd33
Revises: aa00bb11cc22
Create Date: 2026-03-03 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision: str = "bb11cc22dd33"
down_revision: Union[str, None] = "aa00bb11cc22"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    existing_cols = [c["name"] for c in inspector.get_columns("concern_item")]

    if "highlight_levels" not in existing_cols:
        op.add_column(
            "concern_item",
            sa.Column("highlight_levels", sa.Text, nullable=True),
        )


def downgrade() -> None:
    # SQLite doesn't support DROP COLUMN directly; skip for SQLite
    pass
