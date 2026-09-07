"""Race engineer circuit track_geometry and driver fastf1 fields

Revision ID: 0003_race_engineer
Revises: 0002_team_manager
Create Date: 2026-08-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0003_race_engineer'
down_revision: Union[str, None] = '0002_team_manager'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Extend circuits table with track_geometry (JSON column)
    op.add_column('circuits', sa.Column('track_geometry', sa.JSON(), nullable=True))

    # 2. Extend drivers table with fastf1_driver_number and fastf1_code
    op.add_column('drivers', sa.Column('fastf1_driver_number', sa.Integer(), nullable=True))
    op.add_column('drivers', sa.Column('fastf1_code', sa.String(length=3), nullable=True))


def downgrade() -> None:
    # Drop columns
    op.drop_column('drivers', 'fastf1_code')
    op.drop_column('drivers', 'fastf1_driver_number')
    op.drop_column('circuits', 'track_geometry')
