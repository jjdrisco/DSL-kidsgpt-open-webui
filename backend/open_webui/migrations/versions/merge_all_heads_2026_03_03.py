"""merge all divergent heads

Revision ID: merge_all_heads_2026_03_03
Revises: u88v99w00x11, z33a44b55c66, bb11cc22dd33
Create Date: 2026-03-03 00:00:00.000000

"""

from typing import Sequence, Union

revision: str = "merge_all_heads_2026_03_03"
down_revision: Union[tuple, None] = ("u88v99w00x11", "z33a44b55c66", "bb11cc22dd33")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
