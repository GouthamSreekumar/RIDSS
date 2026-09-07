"""Initial schema creation and RBAC seed

Revision ID: 0001_initial
Revises: 
Create Date: 2026-08-16

"""
import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# revision identifiers, used by Alembic.
revision: str = '0001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create Roles
    op.create_table(
        'roles',
        sa.Column('role_id', sa.String(), nullable=False),
        sa.Column('role_name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('role_id'),
        sa.UniqueConstraint('role_name')
    )
    op.create_index(op.f('ix_roles_role_name'), 'roles', ['role_name'], unique=True)

    # 2. Create Teams
    op.create_table(
        'teams',
        sa.Column('team_id', sa.String(), nullable=False),
        sa.Column('team_name', sa.String(), nullable=False),
        sa.Column('principal', sa.String(), nullable=True),
        sa.Column('headquarters', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('team_id')
    )
    op.create_index(op.f('ix_teams_team_name'), 'teams', ['team_name'], unique=False)

    # 3. Create Users
    op.create_table(
        'users',
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('full_name', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('password_hash', sa.String(), nullable=False),
        sa.Column('role_id', sa.String(), nullable=False),
        sa.Column('team_id', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['role_id'], ['roles.role_id'], ),
        sa.ForeignKeyConstraint(['team_id'], ['teams.team_id'], ),
        sa.PrimaryKeyConstraint('user_id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_role_id'), 'users', ['role_id'], unique=False)
    op.create_index(op.f('ix_users_team_id'), 'users', ['team_id'], unique=False)

    # 4. Create Drivers
    op.create_table(
        'drivers',
        sa.Column('driver_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('driver_number', sa.Integer(), nullable=False),
        sa.Column('nationality', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('driver_id'),
        sa.UniqueConstraint('user_id')
    )

    # 5. Create Vehicles
    op.create_table(
        'vehicles',
        sa.Column('vehicle_id', sa.String(), nullable=False),
        sa.Column('team_id', sa.String(), nullable=False),
        sa.Column('chassis', sa.String(), nullable=False),
        sa.Column('engine', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='ready'),
        sa.ForeignKeyConstraint(['team_id'], ['teams.team_id'], ),
        sa.PrimaryKeyConstraint('vehicle_id')
    )

    # 6. Create Circuits
    op.create_table(
        'circuits',
        sa.Column('circuit_id', sa.String(), nullable=False),
        sa.Column('circuit_name', sa.String(), nullable=False),
        sa.Column('country', sa.String(), nullable=False),
        sa.Column('length', sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint('circuit_id')
    )
    op.create_index(op.f('ix_circuits_circuit_name'), 'circuits', ['circuit_name'], unique=False)

    # 7. Create Races
    op.create_table(
        'races',
        sa.Column('race_id', sa.String(), nullable=False),
        sa.Column('race_name', sa.String(), nullable=False),
        sa.Column('circuit_id', sa.String(), nullable=False),
        sa.Column('race_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('season', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['circuit_id'], ['circuits.circuit_id'], ),
        sa.PrimaryKeyConstraint('race_id')
    )

    # 8. Create Components
    op.create_table(
        'components',
        sa.Column('component_id', sa.String(), nullable=False),
        sa.Column('vehicle_id', sa.String(), nullable=False),
        sa.Column('component_name', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='good'),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.vehicle_id'], ),
        sa.PrimaryKeyConstraint('component_id')
    )

    # 9. Create Maintenances
    op.create_table(
        'maintenances',
        sa.Column('maintenance_id', sa.String(), nullable=False),
        sa.Column('vehicle_id', sa.String(), nullable=False),
        sa.Column('mechanic_id', sa.String(), nullable=False),
        sa.Column('maintenance_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='scheduled'),
        sa.ForeignKeyConstraint(['mechanic_id'], ['users.user_id'], ),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.vehicle_id'], ),
        sa.PrimaryKeyConstraint('maintenance_id')
    )

    # 10. Create Notifications
    op.create_table(
        'notifications',
        sa.Column('notification_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='unread'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('notification_id')
    )

    # 11. Create Reports
    op.create_table(
        'reports',
        sa.Column('report_id', sa.String(), nullable=False),
        sa.Column('generated_by', sa.String(), nullable=False),
        sa.Column('report_type', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['generated_by'], ['users.user_id'], ),
        sa.PrimaryKeyConstraint('report_id')
    )

    # 12. Create Audit Logs
    op.create_table(
        'audit_logs',
        sa.Column('log_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('entity_type', sa.String(), nullable=False),
        sa.Column('entity_id', sa.String(), nullable=True),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('log_id')
    )

    # 13. Create System Settings
    op.create_table(
        'system_settings',
        sa.Column('setting_id', sa.String(), nullable=False),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('key', sa.String(), nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('updated_by', sa.String(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['updated_by'], ['users.user_id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('setting_id'),
        sa.UniqueConstraint('key')
    )

    # 14. Create Permissions
    op.create_table(
        'permissions',
        sa.Column('permission_id', sa.String(), nullable=False),
        sa.Column('permission_key', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('module', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('permission_id'),
        sa.UniqueConstraint('permission_key')
    )
    op.create_index(op.f('ix_permissions_module'), 'permissions', ['module'], unique=False)
    op.create_index(op.f('ix_permissions_permission_key'), 'permissions', ['permission_key'], unique=True)

    # 15. Create RolePermissions
    op.create_table(
        'role_permissions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('role_id', sa.String(), nullable=False),
        sa.Column('permission_id', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.permission_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.role_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('role_id', 'permission_id', name='uq_role_permission')
    )

    # ──────────────────────────────────────────────────────────────────────────
    # DATA SEEDING
    # ──────────────────────────────────────────────────────────────────────────
    roles_table = sa.table('roles',
        sa.column('role_id', sa.String),
        sa.column('role_name', sa.String),
        sa.column('description', sa.Text)
    )
    
    role_map = {
        "Administrator": (str(uuid.uuid4()), "System Administrator with full access to all modules and configurations."),
        "Team Manager": (str(uuid.uuid4()), "Manages team operations, vehicle assignments, and driver roster."),
        "Race Engineer": (str(uuid.uuid4()), "Monitors real-time telemetry, session analysis, and vehicle telemetry output."),
        "Strategy Engineer": (str(uuid.uuid4()), "Executes race strategy simulations and pit window decision modeling."),
        "Mechanic": (str(uuid.uuid4()), "Tracks maintenance tasks, component wear, and garage work orders."),
        "Driver": (str(uuid.uuid4()), "Accesses personal telemetry logs, session briefs, and notification alerts.")
    }

    role_id_map = {}
    roles_insert = []
    for r_name, (r_id, r_desc) in role_map.items():
        role_id_map[r_name] = r_id
        roles_insert.append({"role_id": r_id, "role_name": r_name, "description": r_desc})
    op.bulk_insert(roles_table, roles_insert)

    # Permissions list
    permissions_table = sa.table('permissions',
        sa.column('permission_id', sa.String),
        sa.column('permission_key', sa.String),
        sa.column('description', sa.Text),
        sa.column('module', sa.String)
    )

    permission_specs = [
        # Users
        ("users:read", "View user accounts", "users"),
        ("users:create", "Create new user accounts", "users"),
        ("users:update", "Update user profile and team assignments", "users"),
        ("users:disable", "Disable/soft-delete user accounts", "users"),
        # Teams
        ("teams:read", "View team details", "teams"),
        ("teams:create", "Create new teams", "teams"),
        ("teams:update", "Update team information", "teams"),
        ("teams:assign", "Assign members to teams", "teams"),
        # Roles & Permissions
        ("roles:read", "View roles and permissions", "roles"),
        ("roles:create", "Create custom roles", "roles"),
        ("roles:update", "Update role permissions matrix", "roles"),
        # Races & Circuits
        ("races:read", "View race calendars and events", "races"),
        ("races:create", "Create race events", "races"),
        ("races:update", "Update race schedules", "races"),
        ("races:delete", "Delete race events", "races"),
        ("circuits:read", "View circuit details", "circuits"),
        ("circuits:create", "Create circuit entries", "circuits"),
        ("circuits:update", "Update circuit information", "circuits"),
        ("circuits:delete", "Delete circuit entries", "circuits"),
        # Vehicles & Drivers
        ("vehicles:read", "View vehicle inventory", "vehicles"),
        ("vehicles:create", "Create vehicle record", "vehicles"),
        ("vehicles:update", "Update vehicle status", "vehicles"),
        ("vehicles:assign", "Assign drivers to vehicles", "vehicles"),
        ("drivers:read", "View driver list", "drivers"),
        ("drivers:assign", "Assign driver details", "drivers"),
        # Telemetry
        ("telemetry:read", "View live and historic telemetry", "telemetry"),
        ("telemetry:write", "Stream live telemetry data", "telemetry"),
        ("telemetry:export", "Export raw telemetry packages", "telemetry"),
        # Strategy
        ("strategy:read", "View race strategy models", "strategy"),
        ("strategy:create", "Create strategy simulations", "strategy"),
        ("strategy:update", "Modify strategy params", "strategy"),
        ("strategy:execute", "Commit active race strategy", "strategy"),
        # Maintenance
        ("maintenance:read", "View maintenance schedule", "maintenance"),
        ("maintenance:create", "Create maintenance log", "maintenance"),
        ("maintenance:update", "Update maintenance log status", "maintenance"),
        ("maintenance:delete", "Delete maintenance log", "maintenance"),
        ("components:read", "View vehicle component status", "components"),
        ("components:update", "Update component health/wear", "components"),
        # Reports
        ("reports:read", "View system reports", "reports"),
        ("reports:create", "Generate custom reports", "reports"),
        ("reports:team", "Access team performance reports", "reports"),
        ("reports:engineering", "Access engineering telemetry reports", "reports"),
        ("reports:strategy", "Access strategy analysis reports", "reports"),
        # Notifications
        ("notifications:read", "Read notifications", "notifications"),
        ("notifications:send", "Send broadcast/user notifications", "notifications"),
        ("notifications:archive", "Archive notification alerts", "notifications"),
        # Settings & Audit
        ("settings:read", "View system settings", "settings"),
        ("settings:update", "Update system settings", "settings"),
        ("audit-logs:read", "View system audit logs", "audit-logs"),
        ("audit-logs:export", "Export audit logs CSV", "audit-logs"),
    ]

    perm_id_map = {}
    perms_insert = []
    for p_key, p_desc, p_mod in permission_specs:
        p_id = str(uuid.uuid4())
        perm_id_map[p_key] = p_id
        perms_insert.append({
            "permission_id": p_id,
            "permission_key": p_key,
            "description": p_desc,
            "module": p_mod
        })
    op.bulk_insert(permissions_table, perms_insert)

    # Role Permissions Mapping
    role_perms_table = sa.table('role_permissions',
        sa.column('id', sa.String),
        sa.column('role_id', sa.String),
        sa.column('permission_id', sa.String)
    )

    role_permission_mappings = {
        "Administrator": list(perm_id_map.keys()),  # All permissions
        "Team Manager": [
            "teams:read", "teams:update", "teams:assign",
            "users:read", "drivers:read", "drivers:assign",
            "vehicles:read", "vehicles:assign",
            "races:read", "circuits:read",
            "reports:read", "reports:team",
            "notifications:read", "notifications:send", "notifications:archive"
        ],
        "Race Engineer": [
            "telemetry:read", "telemetry:write", "telemetry:export",
            "vehicles:read", "races:read", "circuits:read",
            "reports:read", "reports:engineering",
            "notifications:read", "notifications:archive"
        ],
        "Strategy Engineer": [
            "strategy:read", "strategy:create", "strategy:update", "strategy:execute",
            "telemetry:read", "races:read", "circuits:read",
            "reports:read", "reports:strategy",
            "notifications:read", "notifications:archive"
        ],
        "Mechanic": [
            "maintenance:read", "maintenance:create", "maintenance:update", "maintenance:delete",
            "components:read", "components:update", "vehicles:read",
            "races:read", "circuits:read",
            "notifications:read", "notifications:archive"
        ],
        "Driver": [
            "telemetry:read", "races:read", "circuits:read",
            "notifications:read", "notifications:archive"
        ]
    }

    role_perms_insert = []
    for r_name, p_keys in role_permission_mappings.items():
        r_id = role_id_map[r_name]
        for p_k in p_keys:
            if p_k in perm_id_map:
                role_perms_insert.append({
                    "id": str(uuid.uuid4()),
                    "role_id": r_id,
                    "permission_id": perm_id_map[p_k]
                })
    op.bulk_insert(role_perms_table, role_perms_insert)

    # Initial System Settings
    settings_table = sa.table('system_settings',
        sa.column('setting_id', sa.String),
        sa.column('category', sa.String),
        sa.column('key', sa.String),
        sa.column('value', sa.Text),
        sa.column('updated_at', sa.DateTime(timezone=True))
    )
    now = datetime.now(timezone.utc)
    op.bulk_insert(settings_table, [
        {"setting_id": str(uuid.uuid4()), "category": "authentication", "key": "auth.require_mfa", "value": "false", "updated_at": now},
        {"setting_id": str(uuid.uuid4()), "category": "authentication", "key": "auth.max_failed_logins", "value": "5", "updated_at": now},
        {"setting_id": str(uuid.uuid4()), "category": "session", "key": "session.timeout_minutes", "value": "60", "updated_at": now},
        {"setting_id": str(uuid.uuid4()), "category": "email", "key": "email.smtp_host", "value": "smtp.ridss.team", "updated_at": now},
        {"setting_id": str(uuid.uuid4()), "category": "email", "key": "email.from_address", "value": "noreply@ridss.team", "updated_at": now},
    ])

    # Initial Admin User
    users_table = sa.table('users',
        sa.column('user_id', sa.String),
        sa.column('full_name', sa.String),
        sa.column('email', sa.String),
        sa.column('password_hash', sa.String),
        sa.column('role_id', sa.String),
        sa.column('status', sa.String),
        sa.column('created_at', sa.DateTime(timezone=True))
    )
    admin_id = str(uuid.uuid4())
    admin_role_id = role_id_map["Administrator"]
    op.bulk_insert(users_table, [{
        "user_id": admin_id,
        "full_name": "System Administrator",
        "email": "admin@ridss.team",
        "password_hash": pwd_context.hash("Admin@2025!"),
        "role_id": admin_role_id,
        "status": "active",
        "created_at": now
    }])


def downgrade() -> None:
    op.drop_table('role_permissions')
    op.drop_index(op.f('ix_permissions_permission_key'), table_name='permissions')
    op.drop_index(op.f('ix_permissions_module'), table_name='permissions')
    op.drop_table('permissions')
    op.drop_table('system_settings')
    op.drop_table('audit_logs')
    op.drop_table('reports')
    op.drop_table('notifications')
    op.drop_table('maintenances')
    op.drop_table('components')
    op.drop_table('races')
    op.drop_index(op.f('ix_circuits_circuit_name'), table_name='circuits')
    op.drop_table('circuits')
    op.drop_table('vehicles')
    op.drop_table('drivers')
    op.drop_index(op.f('ix_users_team_id'), table_name='users')
    op.drop_index(op.f('ix_users_role_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    op.drop_index(op.f('ix_teams_team_name'), table_name='teams')
    op.drop_table('teams')
    op.drop_index(op.f('ix_roles_role_name'), table_name='roles')
    op.drop_table('roles')
