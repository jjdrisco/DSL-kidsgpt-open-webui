"""merge a33b44c55d66 and zz_add_scenario_id_to_moderation

Revision ID: f871c94b1b0a
Revises: a33b44c55d66, zz_add_scenario_id_to_moderation
Create Date: 2026-02-21 19:11:52.401421

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import open_webui.internal.db


# revision identifiers, used by Alembic.
revision: str = 'f871c94b1b0a'
down_revision: Union[str, None] = ('a33b44c55d66', 'zz_add_scenario_id_to_moderation')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
