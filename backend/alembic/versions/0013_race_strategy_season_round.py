"""Add season and round columns to race_strategies; make session_id nullable

Revision ID: 0013_race_strategy_season_round
Revises: 0012_race_strategy_table
Create Date: 2026-10-08

Idempotency: All ADD COLUMN and DROP NOT NULL operations are wrapped in
existence checks so the migration is safe to re-run if interrupted.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = '0013_race_strategy_season_round'
down_revision: Union[str, None] = '0012_race_strategy_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    """Return True if the column already exists in the given table."""
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [c["name"] for c in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    # 1. Add `season` column (nullable INT) if not already present
    if not _column_exists("race_strategies", "season"):
        op.add_column(
            "race_strategies",
            sa.Column("season", sa.Integer(), nullable=True),
        )
        op.create_index(
            "ix_race_strategies_season", "race_strategies", ["season"], unique=False
        )

    # 2. Add `round` column (nullable INT) if not already present
    if not _column_exists("race_strategies", "round"):
        op.add_column(
            "race_strategies",
            sa.Column("round", sa.Integer(), nullable=True),
        )
        op.create_index(
            "ix_race_strategies_round", "race_strategies", ["round"], unique=False
        )

    # 3. Make session_id nullable (it becomes a legacy-support field).
    #    SQLite does not support ALTER COLUMN; detect dialect and skip if needed.
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    if dialect_name != "sqlite":
        op.alter_column(
            "race_strategies",
            "session_id",
            existing_type=sa.String(),
            nullable=True,
        )
    # For SQLite: the column is already nullable in the fresh table definition
    # used during testing; existing rows keep their session_id values.


def downgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name

    # 1. Restore session_id NOT NULL constraint (non-SQLite only)
    if dialect_name != "sqlite":
        op.alter_column(
            "race_strategies",
            "session_id",
            existing_type=sa.String(),
            nullable=False,
        )

    # 2. Drop round index + column if they exist
    if _column_exists("race_strategies", "round"):
        op.drop_index("ix_race_strategies_round", table_name="race_strategies")
        op.drop_column("race_strategies", "round")

    # 3. Drop season index + column if they exist
    if _column_exists("race_strategies", "season"):
        op.drop_index("ix_race_strategies_season", table_name="race_strategies")
        op.drop_column("race_strategies", "season")
