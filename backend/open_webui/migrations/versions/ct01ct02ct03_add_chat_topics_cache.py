"""add chat_topics_cache to child_profile

Revision ID: ct01ct02ct03
Revises: merge_all_heads_2026_03_03
Create Date: 2026-03-24 00:00:00.000000

"""

from typing import Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "ct01ct02ct03"
down_revision: Union[str, None] = "aa11bb22cc44"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("child_profile", schema=None) as batch_op:
        batch_op.add_column(sa.Column("chat_topics_cache", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("child_profile", schema=None) as batch_op:
        batch_op.drop_column("chat_topics_cache")
