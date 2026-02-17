"""convert_child_age_to_integer

Revision ID: b047112a78c6
Revises: a11b22c33d44
Create Date: 2026-02-15 21:56:39.215047

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import open_webui.internal.db


# revision identifiers, used by Alembic.
revision: str = 'b047112a78c6'
down_revision: Union[str, None] = 'a11b22c33d44'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: Add new integer column
    with op.batch_alter_table("child_profile", schema=None) as batch_op:
        batch_op.add_column(sa.Column("child_age_new", sa.Integer(), nullable=True))
    
    # Step 2: Convert existing string values to integers
    # Mapping: "6-8" → 6, "9-12" → 9, "13-15" → 13, "16-18" → 16
    connection = op.get_bind()
    connection.execute(
        sa.text("""
            UPDATE child_profile
            SET child_age_new = CASE
                WHEN child_age = '6-8' THEN 6
                WHEN child_age = '9-12' THEN 9
                WHEN child_age = '13-15' THEN 13
                WHEN child_age = '16-18' THEN 16
                ELSE NULL
            END
        """)
    )
    
    # Step 3: Drop old column and rename new one
    with op.batch_alter_table("child_profile", schema=None) as batch_op:
        batch_op.drop_column("child_age")
        batch_op.alter_column("child_age_new", new_column_name="child_age")


def downgrade() -> None:
    # Reverse: Convert integer back to string ranges
    with op.batch_alter_table("child_profile", schema=None) as batch_op:
        batch_op.add_column(sa.Column("child_age_new", sa.String(), nullable=True))
    
    connection = op.get_bind()
    connection.execute(
        sa.text("""
            UPDATE child_profile
            SET child_age_new = CASE
                WHEN child_age = 6 THEN '6-8'
                WHEN child_age = 9 THEN '9-12'
                WHEN child_age = 13 THEN '13-15'
                WHEN child_age = 16 THEN '16-18'
                ELSE NULL
            END
        """)
    )
    
    with op.batch_alter_table("child_profile", schema=None) as batch_op:
        batch_op.drop_column("child_age")
        batch_op.alter_column("child_age_new", new_column_name="child_age")
