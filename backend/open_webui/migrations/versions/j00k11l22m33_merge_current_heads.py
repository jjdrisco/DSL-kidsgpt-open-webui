"""Merge current migration heads.

Revision ID: j00k11l22m33
Revises: h8i9j0k1l2m3, h99i00j11k22
Create Date: 2026-04-10 05:04:00.000000
"""

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "j00k11l22m33"
down_revision: Union[str, Sequence[str], None] = ("h8i9j0k1l2m3", "h99i00j11k22")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
