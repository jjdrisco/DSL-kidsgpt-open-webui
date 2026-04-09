"""add_consent_form_table

Revision ID: dd55ee66ff77
Revises: cc44dd55ee66
Create Date: 2026-04-09 00:00:00.000000

"""

import json
import uuid
import time
from pathlib import Path

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = "dd55ee66ff77"
down_revision = "cc44dd55ee66"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    existing_tables = inspector.get_table_names()

    if "consent_form" not in existing_tables:
        op.create_table(
            "consent_form",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("slug", sa.String(), nullable=False),
            sa.Column("study_ids", sa.JSON(), nullable=False),
            sa.Column(
                "version", sa.String(), nullable=False, server_default="1.0.0"
            ),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("pi_name", sa.String(), nullable=True),
            sa.Column("irb_number", sa.String(), nullable=True),
            sa.Column("body_html", sa.Text(), nullable=False),
            sa.Column(
                "is_active",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("true"),
            ),
            sa.Column("effective_date", sa.BigInteger(), nullable=True),
            sa.Column("created_at", sa.BigInteger(), nullable=False),
            sa.Column("updated_at", sa.BigInteger(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("slug"),
        )

    # Seed data from the existing consent HTML file
    consent_file = (
        Path(__file__).resolve().parent.parent.parent.parent
        / "consent_texts"
        / "ucsd_parental_ai_study.html"
    )
    if consent_file.exists():
        text = consent_file.read_text(encoding="utf-8")
        first_newline = text.index("\n")
        body_html = text[first_newline + 1 :]
        now = int(time.time())

        # Use raw SQL for the data migration
        conn.execute(
            sa.text(
                """
                INSERT INTO consent_form
                    (id, slug, study_ids, version, title, pi_name, irb_number,
                     body_html, is_active, effective_date, created_at, updated_at)
                VALUES
                    (:id, :slug, :study_ids, :version, :title, :pi_name, :irb_number,
                     :body_html, :is_active, :effective_date, :created_at, :updated_at)
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "slug": "ucsd-parental-ai-study",
                "study_ids": json.dumps(["69d6b9879ae5dcb4c0752010"]),
                "version": "1.0.0",
                "title": "Parents' Moderation Preferences for Children's Use of Generative AI",
                "pi_name": "Haojian Jin",
                "irb_number": None,
                "body_html": body_html,
                "is_active": True,
                "effective_date": None,
                "created_at": now,
                "updated_at": now,
            },
        )


def downgrade():
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    existing_tables = inspector.get_table_names()

    if "consent_form" in existing_tables:
        op.drop_table("consent_form")
