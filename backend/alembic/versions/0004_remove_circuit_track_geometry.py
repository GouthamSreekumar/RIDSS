"""Remove circuit track_geometry column

Revision ID: 0004_remove_track_geometry
Revises: 0003_race_engineer
Create Date: 2026-09-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0004_remove_track_geometry'
down_revision: Union[str, None] = '0003_race_engineer'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop track_geometry column from circuits table
    op.drop_column('circuits', 'track_geometry')


def downgrade() -> None:
    # Re-add track_geometry JSON column to circuits table
    op.add_column('circuits', sa.Column('track_geometry', sa.JSON(), nullable=True))
