"""Add response_highlighted_html and prompt_highlighted_html to moderation_session

Revision ID: aa11bb22cc44
Revises: merge_all_heads_2026_03_03
Create Date: 2026-03-11 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "aa11bb22cc44"
down_revision: Union[str, None] = "merge_all_heads_2026_03_03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "moderation_session",
        sa.Column("response_highlighted_html", sa.Text(), nullable=True),
    )
    op.add_column(
        "moderation_session",
        sa.Column("prompt_highlighted_html", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("moderation_session", "prompt_highlighted_html")
    op.drop_column("moderation_session", "response_highlighted_html")
