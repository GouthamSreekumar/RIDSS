"""System health and login history tables + RBAC permission seed

Revision ID: 0008_system_health_login_history
Revises: 0007_deduplicate_vehicles
Create Date: 2026-09-25

"""
import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0008_system_health_login_history'
down_revision: Union[str, None] = '0007_deduplicate_vehicles'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create login_history table
    op.create_table(
        'login_history',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('logged_in_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_login_history_user_id', 'login_history', ['user_id'], unique=False)
    op.create_index('ix_login_history_logged_in_at', 'login_history', ['logged_in_at'], unique=False)

    # 2. Create cache_status table
    op.create_table(
        'cache_status',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('last_prewarm_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='success'),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # 3. Seed system:read permission and grant to Administrator role
    conn = op.get_bind()

    # Find Administrator role_id
    admin_role = conn.execute(sa.text("SELECT role_id FROM roles WHERE role_name = 'Administrator'")).fetchone()
    if admin_role:
        admin_role_id = admin_role[0]
        # Check if system:read permission exists
        perm_res = conn.execute(sa.text("SELECT permission_id FROM permissions WHERE permission_key = 'system:read'")).fetchone()
        if not perm_res:
            perm_id = str(uuid.uuid4())
            conn.execute(
                sa.text("""
                    INSERT INTO permissions (permission_id, permission_key, description, module)
                    VALUES (:p_id, 'system:read', 'View system health and status', 'system')
                """),
                {"p_id": perm_id}
            )
        else:
            perm_id = perm_res[0]

        # Grant to Administrator
        rp_res = conn.execute(
            sa.text("SELECT id FROM role_permissions WHERE role_id = :r_id AND permission_id = :p_id"),
            {"r_id": admin_role_id, "p_id": perm_id}
        ).fetchone()
        if not rp_res:
            conn.execute(
                sa.text("""
                    INSERT INTO role_permissions (id, role_id, permission_id)
                    VALUES (:rp_id, :r_id, :p_id)
                """),
                {"rp_id": str(uuid.uuid4()), "r_id": admin_role_id, "p_id": perm_id}
            )


def downgrade() -> None:
    conn = op.get_bind()
    perm_res = conn.execute(sa.text("SELECT permission_id FROM permissions WHERE permission_key = 'system:read'")).fetchone()
    if perm_res:
        perm_id = perm_res[0]
        conn.execute(sa.text("DELETE FROM role_permissions WHERE permission_id = :p_id"), {"p_id": perm_id})
        conn.execute(sa.text("DELETE FROM permissions WHERE permission_id = :p_id"), {"p_id": perm_id})

    op.drop_table('cache_status')
    op.drop_index('ix_login_history_logged_in_at', table_name='login_history')
    op.drop_index('ix_login_history_user_id', table_name='login_history')
    op.drop_table('login_history')
