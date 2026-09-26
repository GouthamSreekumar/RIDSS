"""
Test script for Feature 1: Bulk user status action & audit logging.
"""
import asyncio
import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.user import User, UserStatus
from app.models.audit import AuditLog
from app.schemas.user import BulkUserStatusUpdate
from app.api.v1.endpoints.users import bulk_update_user_status
from unittest.mock import MagicMock


async def main():
    async with AsyncSessionLocal() as db:
        # Fetch up to 2 non-admin users or test users
        res = await db.execute(select(User).limit(5))
        users = res.scalars().all()
        if len(users) < 2:
            print("Not enough users to test bulk update.")
            return

        admin_user = users[0]
        target_users = users[1:3]
        target_ids = [u.user_id for u in target_users]

        print(f"Testing bulk update on users: {[u.email for u in target_users]}")
        print(f"Performing bulk status change to 'disabled'...")

        payload = BulkUserStatusUpdate(user_ids=target_ids, status="disabled")
        mock_request = MagicMock()
        mock_request.client.host = "127.0.0.1"
        mock_request.headers = {}


        updated = await bulk_update_user_status(
            payload=payload,
            request=mock_request,
            db=db,
            current_user=admin_user,
        )

        assert len(updated) == len(target_ids)
        for u in updated:
            assert u.status == "disabled"
            print(f"Verified User {u.email} status is now {u.status}")

        # Verify audit logs
        audit_res = await db.execute(
            select(AuditLog)
            .where(
                AuditLog.action == "user_status_bulk_changed",
                AuditLog.entity_id.in_(target_ids),
            )
        )
        logs = audit_res.scalars().all()
        print(f"Found {len(logs)} audit log entries for bulk change (expected {len(target_ids)})")
        assert len(logs) >= len(target_ids)

        # Restore status to active
        print("Restoring status to 'active'...")
        payload_restore = BulkUserStatusUpdate(user_ids=target_ids, status="active")
        restored = await bulk_update_user_status(
            payload=payload_restore,
            request=mock_request,
            db=db,
            current_user=admin_user,
        )
        for u in restored:
            assert u.status == "active"
            print(f"Restored User {u.email} status to {u.status}")

        print("\nSUCCESS: Bulk user actions backend test passed!")


if __name__ == "__main__":
    asyncio.run(main())
