"""Create race_strategies table

Revision ID: 0012_race_strategy_table
Revises: 0011_user_team_since
Create Date: 2026-10-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0012_race_strategy_table'
down_revision: Union[str, None] = '0011_user_team_since'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'race_strategies',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('team_id', sa.String(), nullable=False),
        sa.Column('session_id', sa.String(), nullable=False),
        sa.Column('created_by', sa.String(), nullable=False),
        sa.Column('plan', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.user_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['team_id'], ['teams.team_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_race_strategies_team_id', 'race_strategies', ['team_id'], unique=False)
    op.create_index('ix_race_strategies_session_id', 'race_strategies', ['session_id'], unique=False)
    op.create_index('ix_race_strategies_created_by', 'race_strategies', ['created_by'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_race_strategies_created_by', table_name='race_strategies')
    op.drop_index('ix_race_strategies_session_id', table_name='race_strategies')
    op.drop_index('ix_race_strategies_team_id', table_name='race_strategies')
    op.drop_table('race_strategies')
