"""add child_internet_use_frequency to child_profile

Revision ID: t1u2v3w4x5y6
Revises: f871c94b1b0a
Create Date: 2026-02-22 12:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = "t1u2v3w4x5y6"
down_revision = "f871c94b1b0a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add child_internet_use_frequency column to child_profile.

    Stores the parent's answer to 'How often does this child use the Internet?'
    using the same 1–8 scale as the exit survey (childInternetUseFrequency).
    Used as a cross-reference attention check: the same question appears in both
    the child profile form (reversed option order) and the exit survey (forward
    order) so responses can be compared in post-hoc analysis.
    """
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)

    existing_tables = inspector.get_table_names()
    if "child_profile" not in existing_tables:
        return

    existing_columns = [col["name"] for col in inspector.get_columns("child_profile")]
    if "child_internet_use_frequency" not in existing_columns:
        with op.batch_alter_table("child_profile") as batch_op:
            batch_op.add_column(
                sa.Column("child_internet_use_frequency", sa.String(), nullable=True)
            )


def downgrade() -> None:
    """Remove child_internet_use_frequency column from child_profile."""
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)

    existing_tables = inspector.get_table_names()
    if "child_profile" not in existing_tables:
        return

    existing_columns = [col["name"] for col in inspector.get_columns("child_profile")]
    if "child_internet_use_frequency" in existing_columns:
        with op.batch_alter_table("child_profile") as batch_op:
            batch_op.drop_column("child_internet_use_frequency")
