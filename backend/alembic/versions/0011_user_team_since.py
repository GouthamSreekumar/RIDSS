"""Move team_since from drivers table to users table

Revision ID: 0011_user_team_since
Revises: 0010_lap_note_saved_comp
Create Date: 2026-09-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0011_user_team_since'
down_revision: Union[str, None] = '0010_lap_note_saved_comp'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add team_since column to users
    op.add_column('users', sa.Column('team_since', sa.Date(), nullable=True))

    # 2. Migrate existing team_since data from drivers to users (ANSI SQL subquery)
    op.execute(
        """
        UPDATE users
        SET team_since = (
            SELECT drivers.team_since
            FROM drivers
            WHERE drivers.user_id = users.user_id
        )
        WHERE EXISTS (
            SELECT 1
            FROM drivers
            WHERE drivers.user_id = users.user_id
              AND drivers.team_since IS NOT NULL
        )
        """
    )

    # 3. Drop team_since column from drivers
    op.drop_column('drivers', 'team_since')


def downgrade() -> None:
    # 1. Re-add team_since column to drivers
    op.add_column('drivers', sa.Column('team_since', sa.Date(), nullable=True))

    # 2. Restore data back to drivers
    op.execute(
        """
        UPDATE drivers
        SET team_since = (
            SELECT users.team_since
            FROM users
            WHERE users.user_id = drivers.user_id
        )
        WHERE EXISTS (
            SELECT 1
            FROM users
            WHERE users.user_id = drivers.user_id
              AND users.team_since IS NOT NULL
        )
        """
    )

    # 3. Drop team_since column from users
    op.drop_column('users', 'team_since')
