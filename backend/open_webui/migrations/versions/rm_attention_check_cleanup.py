"""Remove attention check columns and tables

Revision ID: rm_attention_check_cleanup
Revises: merge_all_heads_2026_03_03
Create Date: 2026-03-24 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = "rm_attention_check_cleanup"
down_revision = "merge_all_heads_2026_03_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)

    # 1. Drop attention_check_code column + index from scenario_assignments
    if "scenario_assignments" in inspector.get_table_names():
        existing_cols = [
            c["name"] for c in inspector.get_columns("scenario_assignments")
        ]
        if "attention_check_code" in existing_cols:
            existing_indexes = [
                idx["name"] for idx in inspector.get_indexes("scenario_assignments")
            ]
            if "idx_assignments_attention_code" in existing_indexes:
                op.drop_index(
                    "idx_assignments_attention_code",
                    table_name="scenario_assignments",
                )
            op.drop_column("scenario_assignments", "attention_check_code")

    # 2. Drop attention check columns from moderation_session
    if "moderation_session" in inspector.get_table_names():
        existing_cols = [c["name"] for c in inspector.get_columns("moderation_session")]
        for col_name in (
            "is_attention_check",
            "attention_check_selected",
            "attention_check_passed",
        ):
            if col_name in existing_cols:
                op.drop_column("moderation_session", col_name)

    # 3. Drop attention_check_scenarios table
    if "attention_check_scenarios" in inspector.get_table_names():
        existing_indexes = [
            idx["name"] for idx in inspector.get_indexes("attention_check_scenarios")
        ]
        for idx_name in (
            "idx_ac_scenarios_trait_theme",
            "idx_ac_scenarios_set_name",
            "idx_ac_scenarios_is_active",
        ):
            if idx_name in existing_indexes:
                op.drop_index(idx_name, table_name="attention_check_scenarios")
        op.drop_table("attention_check_scenarios")


def downgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)

    # 1. Recreate attention_check_scenarios table
    if "attention_check_scenarios" not in inspector.get_table_names():
        op.create_table(
            "attention_check_scenarios",
            sa.Column("scenario_id", sa.String(), nullable=False, primary_key=True),
            sa.Column("prompt_text", sa.Text(), nullable=False),
            sa.Column("response_text", sa.Text(), nullable=False),
            sa.Column("trait_theme", sa.String(), nullable=True),
            sa.Column("trait_phrase", sa.String(), nullable=True),
            sa.Column("sentiment", sa.String(), nullable=True),
            sa.Column("trait_index", sa.Integer(), nullable=True),
            sa.Column("prompt_index", sa.Integer(), nullable=True),
            sa.Column("set_name", sa.String(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
            sa.Column("source", sa.String(), nullable=True),
            sa.Column("created_at", sa.BigInteger(), nullable=False),
            sa.Column("updated_at", sa.BigInteger(), nullable=False),
        )
        op.create_index(
            "idx_ac_scenarios_is_active", "attention_check_scenarios", ["is_active"]
        )
        op.create_index(
            "idx_ac_scenarios_set_name", "attention_check_scenarios", ["set_name"]
        )
        op.create_index(
            "idx_ac_scenarios_trait_theme",
            "attention_check_scenarios",
            ["trait_theme"],
        )

    # 2. Recreate attention check columns on moderation_session
    if "moderation_session" in inspector.get_table_names():
        existing_cols = [c["name"] for c in inspector.get_columns("moderation_session")]
        for col_name in (
            "is_attention_check",
            "attention_check_selected",
            "attention_check_passed",
        ):
            if col_name not in existing_cols:
                op.add_column(
                    "moderation_session",
                    sa.Column(
                        col_name,
                        sa.Boolean(),
                        nullable=False,
                        server_default=sa.text("false"),
                    ),
                )

    # 3. Recreate attention_check_code column on scenario_assignments
    if "scenario_assignments" in inspector.get_table_names():
        existing_cols = [
            c["name"] for c in inspector.get_columns("scenario_assignments")
        ]
        if "attention_check_code" not in existing_cols:
            op.add_column(
                "scenario_assignments",
                sa.Column("attention_check_code", sa.String(), nullable=True),
            )
            op.create_index(
                "idx_assignments_attention_code",
                "scenario_assignments",
                ["attention_check_code"],
            )
