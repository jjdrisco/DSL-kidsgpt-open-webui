"""Add whitelist enforcement tables for prompt comparison and response validation

Revision ID: a33b44c55d66
Revises: z22a33b44c55
Create Date: 2026-02-18 01:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision: str = "a33b44c55d66"
down_revision: Union[str, None] = "z22a33b44c55"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    existing_tables = inspector.get_table_names()

    # Determine JSON type based on database dialect
    json_type = JSONB if conn.dialect.name == "postgresql" else sa.JSON

    # Create prompt_comparison_check table
    if "prompt_comparison_check" not in existing_tables:
        op.create_table(
            "prompt_comparison_check",
            sa.Column("id", sa.Text(), primary_key=True),
            sa.Column("user_id", sa.Text(), nullable=False),
            sa.Column("child_id", sa.Text(), nullable=True),
            sa.Column("child_prompt", sa.Text(), nullable=False),
            sa.Column("system_prompt", sa.Text(), nullable=False),
            sa.Column("is_compliant", sa.Boolean(), nullable=False, default=True),
            sa.Column("concern_level", sa.Text(), nullable=False, default="none"),
            sa.Column("concerns", json_type, nullable=True),
            sa.Column("reasoning", sa.Text(), nullable=True),
            sa.Column("model_used", sa.Text(), nullable=True),
            sa.Column("session_number", sa.BigInteger(), nullable=True),
            sa.Column("created_at", sa.BigInteger(), nullable=False),
        )

        # Create indexes for prompt_comparison_check
        op.create_index(
            "idx_prompt_check_user_id",
            "prompt_comparison_check",
            ["user_id"],
        )
        op.create_index(
            "idx_prompt_check_child_id",
            "prompt_comparison_check",
            ["child_id"],
        )
        op.create_index(
            "idx_prompt_check_created_at",
            "prompt_comparison_check",
            ["created_at"],
        )
        op.create_index(
            "idx_prompt_check_compliant",
            "prompt_comparison_check",
            ["is_compliant", "concern_level"],
        )

    # Create response_validation_check table
    if "response_validation_check" not in existing_tables:
        op.create_table(
            "response_validation_check",
            sa.Column("id", sa.Text(), primary_key=True),
            sa.Column("user_id", sa.Text(), nullable=False),
            sa.Column("child_id", sa.Text(), nullable=True),
            sa.Column("response_text", sa.Text(), nullable=False),
            sa.Column("whitelist_system_prompt", sa.Text(), nullable=False),
            sa.Column("original_child_prompt", sa.Text(), nullable=True),
            sa.Column("is_compliant", sa.Boolean(), nullable=False, default=True),
            sa.Column("severity", sa.Text(), nullable=False, default="none"),
            sa.Column("violations", json_type, nullable=True),
            sa.Column("reasoning", sa.Text(), nullable=True),
            sa.Column("should_block", sa.Boolean(), nullable=False, default=False),
            sa.Column("was_blocked", sa.Boolean(), nullable=False, default=False),
            sa.Column("model_used", sa.Text(), nullable=True),
            sa.Column("session_number", sa.BigInteger(), nullable=True),
            sa.Column("created_at", sa.BigInteger(), nullable=False),
        )

        # Create indexes for response_validation_check
        op.create_index(
            "idx_response_check_user_id",
            "response_validation_check",
            ["user_id"],
        )
        op.create_index(
            "idx_response_check_child_id",
            "response_validation_check",
            ["child_id"],
        )
        op.create_index(
            "idx_response_check_created_at",
            "response_validation_check",
            ["created_at"],
        )
        op.create_index(
            "idx_response_check_compliant",
            "response_validation_check",
            ["is_compliant", "severity"],
        )
        op.create_index(
            "idx_response_check_blocked",
            "response_validation_check",
            ["should_block", "was_blocked"],
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    existing_tables = inspector.get_table_names()

    # Drop response_validation_check table and its indexes
    if "response_validation_check" in existing_tables:
        existing_indexes = [
            idx["name"] for idx in inspector.get_indexes("response_validation_check")
        ]
        for idx_name in [
            "idx_response_check_blocked",
            "idx_response_check_compliant",
            "idx_response_check_created_at",
            "idx_response_check_child_id",
            "idx_response_check_user_id",
        ]:
            if idx_name in existing_indexes:
                op.drop_index(idx_name, table_name="response_validation_check")

        op.drop_table("response_validation_check")

    # Drop prompt_comparison_check table and its indexes
    if "prompt_comparison_check" in existing_tables:
        existing_indexes = [
            idx["name"] for idx in inspector.get_indexes("prompt_comparison_check")
        ]
        for idx_name in [
            "idx_prompt_check_compliant",
            "idx_prompt_check_created_at",
            "idx_prompt_check_child_id",
            "idx_prompt_check_user_id",
        ]:
            if idx_name in existing_indexes:
                op.drop_index(idx_name, table_name="prompt_comparison_check")

        op.drop_table("prompt_comparison_check")
