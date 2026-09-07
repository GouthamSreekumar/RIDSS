"""Team manager tables and RBAC permission seed

Revision ID: 0002_team_manager
Revises: 0001_initial
Create Date: 2026-08-19

"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0002_team_manager'
down_revision: Union[str, None] = '0001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Extend reports table
    op.add_column('reports', sa.Column('data', sa.JSON(), nullable=True))
    op.add_column('reports', sa.Column('team_id', sa.String(), nullable=True))
    op.create_foreign_key('fk_reports_team_id', 'reports', 'teams', ['team_id'], ['team_id'])
    op.create_index(op.f('ix_reports_team_id'), 'reports', ['team_id'], unique=False)

    # 2. Create driver_vehicle_assignments table
    op.create_table(
        'driver_vehicle_assignments',
        sa.Column('assignment_id', sa.String(), nullable=False),
        sa.Column('team_id', sa.String(), nullable=False),
        sa.Column('driver_id', sa.String(), nullable=False),
        sa.Column('vehicle_id', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='active'),
        sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('season', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['driver_id'], ['drivers.driver_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['team_id'], ['teams.team_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.vehicle_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('assignment_id')
    )
    op.create_index(op.f('ix_driver_vehicle_assignments_driver_id'), 'driver_vehicle_assignments', ['driver_id'], unique=False)
    op.create_index(op.f('ix_driver_vehicle_assignments_status'), 'driver_vehicle_assignments', ['status'], unique=False)
    op.create_index(op.f('ix_driver_vehicle_assignments_team_id'), 'driver_vehicle_assignments', ['team_id'], unique=False)
    op.create_index(op.f('ix_driver_vehicle_assignments_vehicle_id'), 'driver_vehicle_assignments', ['vehicle_id'], unique=False)

    # 3. Create partial unique indexes
    op.create_index(
        'uq_active_driver_assignment',
        'driver_vehicle_assignments',
        ['driver_id'],
        unique=True,
        postgresql_where=sa.text("status = 'active'")
    )
    op.create_index(
        'uq_active_vehicle_assignment',
        'driver_vehicle_assignments',
        ['vehicle_id'],
        unique=True,
        postgresql_where=sa.text("status = 'active'")
    )

    # 4. Seed new RBAC permissions: teams:assign_driver and teams:assign_vehicle
    permissions_table = sa.table(
        'permissions',
        sa.column('permission_id', sa.String),
        sa.column('permission_key', sa.String),
        sa.column('description', sa.Text),
        sa.column('module', sa.String)
    )

    new_perms = [
        ("teams:assign_driver", "Assign driver to team vehicle", "teams"),
        ("teams:assign_vehicle", "Assign vehicle to team driver", "teams"),
    ]

    perm_ids = {}
    perms_insert = []
    for p_key, p_desc, p_mod in new_perms:
        p_id = str(uuid.uuid4())
        perm_ids[p_key] = p_id
        perms_insert.append({
            "permission_id": p_id,
            "permission_key": p_key,
            "description": p_desc,
            "module": p_mod
        })
    op.bulk_insert(permissions_table, perms_insert)

    # Assign new permissions to Team Manager and Administrator roles
    connection = op.get_bind()
    roles_result = connection.execute(sa.text("SELECT role_id, role_name FROM roles WHERE role_name IN ('Team Manager', 'Administrator')")).fetchall()
    
    role_perms_table = sa.table(
        'role_permissions',
        sa.column('id', sa.String),
        sa.column('role_id', sa.String),
        sa.column('permission_id', sa.String)
    )

    role_perms_insert = []
    for role_id, role_name in roles_result:
        for p_key in perm_ids:
            role_perms_insert.append({
                "id": str(uuid.uuid4()),
                "role_id": role_id,
                "permission_id": perm_ids[p_key]
            })

    if role_perms_insert:
        op.bulk_insert(role_perms_table, role_perms_insert)


def downgrade() -> None:
    # Remove seeded role_permissions & permissions
    connection = op.get_bind()
    connection.execute(sa.text("DELETE FROM permissions WHERE permission_key IN ('teams:assign_driver', 'teams:assign_vehicle')"))

    # Drop indexes and table
    op.drop_index('uq_active_vehicle_assignment', table_name='driver_vehicle_assignments')
    op.drop_index('uq_active_driver_assignment', table_name='driver_vehicle_assignments')
    op.drop_index(op.f('ix_driver_vehicle_assignments_vehicle_id'), table_name='driver_vehicle_assignments')
    op.drop_index(op.f('ix_driver_vehicle_assignments_team_id'), table_name='driver_vehicle_assignments')
    op.drop_index(op.f('ix_driver_vehicle_assignments_status'), table_name='driver_vehicle_assignments')
    op.drop_index(op.f('ix_driver_vehicle_assignments_driver_id'), table_name='driver_vehicle_assignments')
    op.drop_table('driver_vehicle_assignments')

    # Drop report table additions
    op.drop_index(op.f('ix_reports_team_id'), table_name='reports')
    op.drop_constraint('fk_reports_team_id', 'reports', type_='foreignkey')
    op.drop_column('reports', 'team_id')
    op.drop_column('reports', 'data')
