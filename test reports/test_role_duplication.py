"""
Test script for Feature 2: Role duplication template & audit logging.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import delete, select
from app.db.session import AsyncSessionLocal
from app.models.role import Role
from app.models.role_permission import RolePermission
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas.role import RoleDuplicateRequest
from app.api.v1.endpoints.roles import duplicate_role
from unittest.mock import MagicMock


async def main():
    async with AsyncSessionLocal() as db:
        # 1. Fetch an admin user and a source role
        user_res = await db.execute(select(User).limit(1))
        admin_user = user_res.scalar_one_or_none()
        assert admin_user is not None, "No user found in DB"

        source_res = await db.execute(select(Role).order_by(Role.role_name.asc()).limit(1))
        source_role = source_res.scalar_one_or_none()
        assert source_role is not None, "No role found in DB"

        # Count source permissions
        source_rp_res = await db.execute(
            select(RolePermission).where(RolePermission.role_id == source_role.role_id)
        )
        source_perms = source_rp_res.scalars().all()
        source_perm_ids = {rp.permission_id for rp in source_perms}
        print(f"Source role '{source_role.role_name}' has {len(source_perm_ids)} permissions.")

        test_new_name = f"Duplicated {source_role.role_name} Test"

        # Clean up previous test role if exists
        old_test_res = await db.execute(select(Role).where(Role.role_name == test_new_name))
        old_test = old_test_res.scalar_one_or_none()
        if old_test:
            await db.execute(delete(RolePermission).where(RolePermission.role_id == old_test.role_id))
            await db.delete(old_test)
            await db.commit()

        # 2. Call duplicate_role
        req_payload = RoleDuplicateRequest(
            new_role_name=test_new_name,
            description="Unit test copied role",
        )
        mock_req = MagicMock()
        mock_req.client.host = "127.0.0.1"
        mock_req.headers = {}

        print(f"Duplicating role '{source_role.role_name}' into '{test_new_name}'...")
        matrix_entry = await duplicate_role(
            role_id=source_role.role_id,
            dup_in=req_payload,
            request=mock_req,
            db=db,
            current_user=admin_user,
        )

        assert matrix_entry.role_name == test_new_name
        assert set(matrix_entry.permission_ids) == source_perm_ids
        print(f"Successfully duplicated role! New Role ID: {matrix_entry.role_id}")
        print(f"Copied permissions count: {len(matrix_entry.permission_ids)}")

        # 3. Verify audit log entry 'role_duplicated'
        audit_res = await db.execute(
            select(AuditLog).where(
                AuditLog.action == "role_duplicated",
                AuditLog.entity_id == matrix_entry.role_id,
            )
        )
        audit_entry = audit_res.scalar_one_or_none()
        assert audit_entry is not None, "Audit log entry for 'role_duplicated' not found!"
        print(f"Verified AuditLog entry 'role_duplicated': {audit_entry.details}")

        # Clean up test role
        print("Cleaning up test role...")
        await db.execute(delete(RolePermission).where(RolePermission.role_id == matrix_entry.role_id))
        del_role_res = await db.execute(select(Role).where(Role.role_id == matrix_entry.role_id))
        role_to_del = del_role_res.scalar_one()
        await db.delete(role_to_del)
        await db.commit()

        print("\nSUCCESS: Role duplication template backend test passed!")


if __name__ == "__main__":
    asyncio.run(main())
