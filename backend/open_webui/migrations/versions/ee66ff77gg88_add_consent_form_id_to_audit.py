"""add_consent_form_id_to_consent_audit

Revision ID: ee66ff77gg88
Revises: dd55ee66ff77
Create Date: 2026-04-09 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = "ee66ff77gg88"
down_revision = "dd55ee66ff77"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)

    if "consent_audit" in inspector.get_table_names():
        existing_columns = [c["name"] for c in inspector.get_columns("consent_audit")]
        if "consent_form_id" not in existing_columns:
            op.add_column(
                "consent_audit",
                sa.Column("consent_form_id", sa.String(), nullable=True),
            )


def downgrade():
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)

    if "consent_audit" in inspector.get_table_names():
        existing_columns = [c["name"] for c in inspector.get_columns("consent_audit")]
        if "consent_form_id" in existing_columns:
            op.drop_column("consent_audit", "consent_form_id")
