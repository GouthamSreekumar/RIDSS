"""Add notification reference fields and Driver RBAC permissions

Revision ID: 0006_driver_module
Revises: 0005_add_driver_is_active
Create Date: 2026-09-21

"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0006_driver_module'
down_revision: Union[str, None] = '0005_add_driver_is_active'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add notification reference columns
    op.add_column('notifications', sa.Column('reference_type', sa.String(), nullable=True))
    op.add_column('notifications', sa.Column('reference_id', sa.String(), nullable=True))

    # 2. Seed Driver scoped permissions
    permissions_table = sa.table(
        'permissions',
        sa.column('permission_id', sa.String),
        sa.column('permission_key', sa.String),
        sa.column('description', sa.Text),
        sa.column('module', sa.String)
    )

    driver_perms = [
        ("reports:own", "Access own driver performance reports", "reports"),
        ("sessions:own", "Access own driver session history and stats", "sessions"),
        ("notifications:own", "Access own driver notifications", "notifications"),
        ("driver:read_dashboard", "Access driver personal dashboard", "driver"),
    ]

    connection = op.get_bind()
    perm_ids = {}
    perms_insert = []
    
    # Check if permission keys already exist in DB
    existing_perms = connection.execute(sa.text("SELECT permission_key, permission_id FROM permissions")).fetchall()
    existing_map = {p_key: p_id for p_key, p_id in existing_perms}

    for p_key, p_desc, p_mod in driver_perms:
        if p_key in existing_map:
            perm_ids[p_key] = existing_map[p_key]
        else:
            p_id = str(uuid.uuid4())
            perm_ids[p_key] = p_id
            perms_insert.append({
                "permission_id": p_id,
                "permission_key": p_key,
                "description": p_desc,
                "module": p_mod
            })

    if perms_insert:
        op.bulk_insert(permissions_table, perms_insert)

    # 3. Assign Driver permissions to 'Driver' and 'Administrator' roles
    roles_result = connection.execute(
        sa.text("SELECT role_id, role_name FROM roles WHERE role_name IN ('Driver', 'Administrator')")
    ).fetchall()

    role_perms_table = sa.table(
        'role_permissions',
        sa.column('id', sa.String),
        sa.column('role_id', sa.String),
        sa.column('permission_id', sa.String)
    )

    # Fetch existing role_permissions to avoid duplicates
    existing_role_perms = connection.execute(sa.text("SELECT role_id, permission_id FROM role_permissions")).fetchall()
    existing_rp_set = {(r_id, p_id) for r_id, p_id in existing_role_perms}

    role_perms_insert = []
    for role_id, role_name in roles_result:
        for p_key, p_id in perm_ids.items():
            if (role_id, p_id) not in existing_rp_set:
                role_perms_insert.append({
                    "id": str(uuid.uuid4()),
                    "role_id": role_id,
                    "permission_id": p_id
                })

    if role_perms_insert:
        op.bulk_insert(role_perms_table, role_perms_insert)


def downgrade() -> None:
    # Drop columns
    op.drop_column('notifications', 'reference_id')
    op.drop_column('notifications', 'reference_type')

    # Delete added permissions and role permissions
    connection = op.get_bind()
    connection.execute(
        sa.text("DELETE FROM permissions WHERE permission_key IN ('reports:own', 'sessions:own', 'notifications:own', 'driver:read_dashboard')")
    )
