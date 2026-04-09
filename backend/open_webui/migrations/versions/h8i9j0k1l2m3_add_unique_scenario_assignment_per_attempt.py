"""add unique scenario assignment per participant attempt

Revision ID: h8i9j0k1l2m3
Revises: f1a2b3c4d5e6
Create Date: 2026-04-09 12:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect, text


revision: str = "h8i9j0k1l2m3"
down_revision: Union[str, Sequence[str], None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


UNIQUE_INDEX_NAME = "uq_assignments_participant_attempt_scenario"


def _index_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = inspect(bind)
    try:
        return {i.get("name") for i in inspector.get_indexes(table_name) if i.get("name")}
    except Exception:
        return set()


def upgrade() -> None:
    bind = op.get_bind()

    # Defensive dedupe for SQLite: keep earliest row per participant+attempt+scenario.
    # This avoids migration failure if historical race conditions inserted duplicates.
    if bind.dialect.name == "sqlite":
        bind.execute(
            text(
                """
                DELETE FROM scenario_assignments
                WHERE rowid NOT IN (
                    SELECT MIN(rowid)
                    FROM scenario_assignments
                    GROUP BY participant_id, attempt_number, scenario_id
                )
                """
            )
        )

    if UNIQUE_INDEX_NAME not in _index_names("scenario_assignments"):
        op.create_index(
            UNIQUE_INDEX_NAME,
            "scenario_assignments",
            ["participant_id", "attempt_number", "scenario_id"],
            unique=True,
        )


def downgrade() -> None:
    if UNIQUE_INDEX_NAME in _index_names("scenario_assignments"):
        op.drop_index(UNIQUE_INDEX_NAME, table_name="scenario_assignments")
