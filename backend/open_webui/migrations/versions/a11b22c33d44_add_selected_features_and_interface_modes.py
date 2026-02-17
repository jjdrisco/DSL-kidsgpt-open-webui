"""Add selected_features and selected_interface_modes to child_profile

Revision ID: a11b22c33d44
Revises: z22a33b44c55
Create Date: 2026-02-15 12:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = "a11b22c33d44"
down_revision = "z22a33b44c55"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add selected_features and selected_interface_modes columns (JSON arrays)."""
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)

    existing_tables = inspector.get_table_names()
    if "child_profile" not in existing_tables:
        return

    existing_columns = [col["name"] for col in inspector.get_columns("child_profile")]

    for col_name in ["selected_features", "selected_interface_modes"]:
        if col_name not in existing_columns:
            with op.batch_alter_table("child_profile") as batch_op:
                try:
                    batch_op.add_column(sa.Column(col_name, sa.JSON(), nullable=True))
                except Exception:
                    batch_op.add_column(sa.Column(col_name, sa.Text(), nullable=True))


def downgrade() -> None:
    """Remove selected_features and selected_interface_modes columns."""
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)

    existing_tables = inspector.get_table_names()
    if "child_profile" not in existing_tables:
        return

    existing_columns = [col["name"] for col in inspector.get_columns("child_profile")]

    for col_name in ["selected_interface_modes", "selected_features"]:
        if col_name in existing_columns:
            with op.batch_alter_table("child_profile") as batch_op:
                batch_op.drop_column(col_name)
