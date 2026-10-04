"""LapNote and SavedComparison tables

Revision ID: 0010_lap_note_saved_comp
Revises: 0009_driver_team_since
Create Date: 2026-09-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0010_lap_note_saved_comp'
down_revision: Union[str, None] = '0009_driver_team_since'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create lap_notes table
    op.create_table(
        'lap_notes',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('session_id', sa.String(), nullable=False),
        sa.Column('driver', sa.String(), nullable=False),
        sa.Column('lap_number', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_lap_notes_user_id', 'lap_notes', ['user_id'], unique=False)
    op.create_index('ix_lap_notes_session_id', 'lap_notes', ['session_id'], unique=False)
    op.create_index('ix_lap_notes_driver', 'lap_notes', ['driver'], unique=False)
    op.create_index('ix_lap_notes_lap_number', 'lap_notes', ['lap_number'], unique=False)

    # 2. Create saved_comparisons table
    op.create_table(
        'saved_comparisons',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('season', sa.Integer(), nullable=False),
        sa.Column('circuit', sa.String(), nullable=False),
        sa.Column('session_type', sa.String(), nullable=False, server_default='Race'),
        sa.Column('driver_a', sa.String(), nullable=False),
        sa.Column('lap_a', sa.Integer(), nullable=False),
        sa.Column('driver_b', sa.String(), nullable=True),
        sa.Column('season_b', sa.Integer(), nullable=True),
        sa.Column('lap_b', sa.Integer(), nullable=True),
        sa.Column('comparison_type', sa.String(), nullable=False, server_default='driver_vs_driver'),
        sa.Column('label', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_saved_comparisons_user_id', 'saved_comparisons', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_saved_comparisons_user_id', table_name='saved_comparisons')
    op.drop_table('saved_comparisons')

    op.drop_index('ix_lap_notes_lap_number', table_name='lap_notes')
    op.drop_index('ix_lap_notes_driver', table_name='lap_notes')
    op.drop_index('ix_lap_notes_session_id', table_name='lap_notes')
    op.drop_index('ix_lap_notes_user_id', table_name='lap_notes')
    op.drop_table('lap_notes')
