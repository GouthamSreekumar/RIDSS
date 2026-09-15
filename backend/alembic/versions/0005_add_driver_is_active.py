"""Add is_active column to drivers table

Revision ID: 0005_add_driver_is_active
Revises: 0004_remove_track_geometry
Create Date: 2026-09-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0005_add_driver_is_active'
down_revision: Union[str, None] = '0004_remove_track_geometry'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('drivers', sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False))


def downgrade() -> None:
    op.drop_column('drivers', 'is_active')
