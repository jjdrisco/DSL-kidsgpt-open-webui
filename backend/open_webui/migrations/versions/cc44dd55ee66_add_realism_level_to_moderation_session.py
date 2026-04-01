"""Add realism_level column to moderation_session

Revision ID: cc44dd55ee66
Revises: 7b3e2c9f1d04
Create Date: 2026-03-31 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = "cc44dd55ee66"
down_revision = "7b3e2c9f1d04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    existing_columns = [
        col["name"] for col in inspector.get_columns("moderation_session")
    ]

    if "realism_level" not in existing_columns:
        with op.batch_alter_table("moderation_session") as batch_op:
            batch_op.add_column(sa.Column("realism_level", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("moderation_session") as batch_op:
        batch_op.drop_column("realism_level")
