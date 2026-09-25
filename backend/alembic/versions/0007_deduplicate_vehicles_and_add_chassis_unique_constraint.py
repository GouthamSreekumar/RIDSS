"""Deduplicate vehicles table and add chassis unique constraint

Revision ID: 0007_deduplicate_vehicles
Revises: 0006_driver_module_and_notifications
Create Date: 2026-09-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0007_deduplicate_vehicles'
down_revision: Union[str, None] = '0006_driver_module'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Identify all vehicle records grouped by team_id and chassis
    query = sa.text("""
        SELECT team_id, chassis, COUNT(*) 
        FROM vehicles 
        GROUP BY team_id, chassis 
        HAVING COUNT(*) > 1
    """)
    duplicates = conn.execute(query).fetchall()

    for team_id, chassis, _ in duplicates:
        # Fetch all vehicle IDs for this (team_id, chassis) combo
        v_query = sa.text("""
            SELECT v.vehicle_id, 
                   (SELECT COUNT(*) FROM driver_vehicle_assignments WHERE vehicle_id = v.vehicle_id) as assignment_count,
                   (SELECT COUNT(*) FROM components WHERE vehicle_id = v.vehicle_id) as component_count,
                   (SELECT COUNT(*) FROM maintenances WHERE vehicle_id = v.vehicle_id) as maintenance_count
            FROM vehicles v
            WHERE v.team_id = :team_id AND v.chassis = :chassis
        """)
        rows = conn.execute(v_query, {"team_id": team_id, "chassis": chassis}).fetchall()

        # Sort rows: prioritize rows with references (assignments + components + maintenances)
        rows_sorted = sorted(
            rows,
            key=lambda r: (r.assignment_count + r.component_count + r.maintenance_count),
            reverse=True
        )

        keeper_id = rows_sorted[0].vehicle_id
        duplicate_ids = [r.vehicle_id for r in rows_sorted[1:]]

        for dup_id in duplicate_ids:
            # Delete duplicate row if no references exist
            conn.execute(sa.text("DELETE FROM vehicles WHERE vehicle_id = :v_id"), {"v_id": dup_id})

    # 2. Add Unique Constraint on (team_id, chassis)
    op.create_unique_constraint("uq_vehicles_team_chassis", "vehicles", ["team_id", "chassis"])


def downgrade() -> None:
    op.drop_constraint("uq_vehicles_team_chassis", "vehicles", type_="unique")
