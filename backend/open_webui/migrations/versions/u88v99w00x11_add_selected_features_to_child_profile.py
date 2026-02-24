"""add selected_features and selected_interface_modes to child_profile

Revision ID: u88v99w00x11
Revises: t1u2v3w4x5y6
Create Date: 2026-02-23 00:00:00.000000

"""

from typing import Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "u88v99w00x11"
down_revision: Union[str, None] = "t1u2v3w4x5y6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add selected_features: JSON list of enabled feature IDs (e.g. ["school_assignment"])
    with op.batch_alter_table("child_profile", schema=None) as batch_op:
        batch_op.add_column(sa.Column("selected_features", sa.Text(), nullable=True))
        batch_op.add_column(
            sa.Column("selected_interface_modes", sa.Text(), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("child_profile", schema=None) as batch_op:
        batch_op.drop_column("selected_interface_modes")
        batch_op.drop_column("selected_features")
