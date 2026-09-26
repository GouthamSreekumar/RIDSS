"""Driver team_since and assignment unassigned_at columns

Revision ID: 0009_driver_team_since
Revises: 0008_system_health_login_history
Create Date: 2026-09-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0009_driver_team_since'
down_revision: Union[str, None] = '0008_system_health_login_history'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('drivers', sa.Column('team_since', sa.Date(), nullable=True))
    op.add_column('driver_vehicle_assignments', sa.Column('unassigned_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('driver_vehicle_assignments', 'unassigned_at')
    op.drop_column('drivers', 'team_since')
