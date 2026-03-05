"""add attention_check_code column and deactivate legacy checks

Revision ID: z33a44b55c66
Revises: z22a33b44c55_add_scenario_metadata_fields
Create Date: 2026-02-25 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'z33a44b55c66'
down_revision = 'z22a33b44c55'
branch_labels = None
depends_on = None


def upgrade():
    # add attention_check_code column to scenario_assignments
    op.add_column('scenario_assignments', sa.Column('attention_check_code', sa.String(), nullable=True))
    op.create_index('idx_assignments_attention_code', 'scenario_assignments', ['attention_check_code'])

    # deactivate all attention_check_scenarios so endpoint returns 404
    op.execute("UPDATE attention_check_scenarios SET is_active = false")

    # drop legacy attention check question/response tables if they exist
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    for tbl in ('attention_check_question', 'attention_check_response'):
        if inspector.has_table(tbl):
            op.drop_table(tbl)


def downgrade():
    # reverse of upgrade
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # recreate question and response tables (empty)
    if not inspector.has_table('attention_check_question'):
        op.create_table(
            'attention_check_question',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('prompt', sa.String(), nullable=False),
            sa.Column('options', sa.String(), nullable=False),
            sa.Column('correct_option', sa.String(), nullable=False),
            sa.Column('created_at', sa.BigInteger(), nullable=False),
        )
    if not inspector.has_table('attention_check_response'):
        op.create_table(
            'attention_check_response',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('user_id', sa.String(), nullable=False),
            sa.Column('session_number', sa.Integer(), nullable=True),
            sa.Column('question_id', sa.String(), nullable=False),
            sa.Column('response', sa.String(), nullable=False),
            sa.Column('is_passed', sa.Boolean(), nullable=False, default=False),
            sa.Column('created_at', sa.BigInteger(), nullable=False),
        )

    # remove attention_check_code index and column
    op.drop_index('idx_assignments_attention_code', table_name='scenario_assignments')
    op.drop_column('scenario_assignments', 'attention_check_code')

    # reactivate attention check scenarios
    op.execute("UPDATE attention_check_scenarios SET is_active = true")
