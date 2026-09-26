"""
Test script for Feature 3: Data retention settings & background pruning job.
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.audit import AuditLog
from app.models.login_history import LoginHistory
from app.models.user import User
from app.services.retention import (
    get_retention_policy,
    run_retention_pruning_job,
    update_retention_policy,
)
from unittest.mock import MagicMock


async def main():
    async with AsyncSessionLocal() as db:
        user_res = await db.execute(select(User).limit(1))
        admin_user = user_res.scalar_one_or_none()
        assert admin_user is not None, "No user found in DB"

        print("Testing retention policy GET & PATCH...")
        # 1. Test update retention policy
        policy = await update_retention_policy(
            db=db,
            audit_log_retention_days=30,
            login_history_retention_days=30,
            user_id=admin_user.user_id,
        )
        assert policy["audit_log_retention_days"] == 30
        assert policy["login_history_retention_days"] == 30

        curr = await get_retention_policy(db)
        assert curr["audit_log_retention_days"] == 30
        assert curr["login_history_retention_days"] == 30
        print("Updated retention policy to 30 days.")

        # 2. Insert test records older than 30 days (45 days old)
        old_dt = datetime.now(timezone.utc) - timedelta(days=45)
        old_audit_id = str(uuid.uuid4())
        old_login_id = str(uuid.uuid4())

        old_audit = AuditLog(
            log_id=old_audit_id,
            user_id=admin_user.user_id,
            action="TEST_OLD_EVENT",
            entity_type="TestEntity",
            created_at=old_dt,
        )
        old_login = LoginHistory(
            id=old_login_id,
            user_id=admin_user.user_id,
            logged_in_at=old_dt,
            ip_address="127.0.0.1",
        )

        db.add(old_audit)
        db.add(old_login)
        await db.commit()
        print("Inserted test AuditLog and LoginHistory entries older than 30 days.")

        # 3. Run pruning job
        mock_req = MagicMock()
        mock_req.client.host = "127.0.0.1"
        mock_req.headers = {}

        print("Executing retention pruning job...")
        result = await run_retention_pruning_job(
            db=db,
            user_id=admin_user.user_id,
            request=mock_req,
        )
        print(f"Pruning job result: {result}")
        assert result["audit_logs_pruned"] >= 1
        assert result["login_history_pruned"] >= 1

        # 4. Verify old records deleted
        check_audit = await db.execute(select(AuditLog).where(AuditLog.log_id == old_audit_id))
        assert check_audit.scalar_one_or_none() is None, "Old AuditLog record was not deleted!"

        check_login = await db.execute(select(LoginHistory).where(LoginHistory.id == old_login_id))
        assert check_login.scalar_one_or_none() is None, "Old LoginHistory record was not deleted!"

        # 5. Verify audit log entry for pruning job execution
        prune_audit_res = await db.execute(
            select(AuditLog).where(
                AuditLog.action == "retention_pruning_executed"
            ).order_by(AuditLog.created_at.desc())
        )
        prune_log = prune_audit_res.scalars().first()
        assert prune_log is not None, "Audit log entry 'retention_pruning_executed' not found!"
        print(f"Verified AuditLog entry 'retention_pruning_executed': {prune_log.details}")

        # 6. Restore policy to keep indefinitely (None) as default
        print("Restoring retention policy to keep indefinitely (None)...")
        restored_policy = await update_retention_policy(
            db=db,
            audit_log_retention_days=None,
            login_history_retention_days=None,
            user_id=admin_user.user_id,
        )
        assert restored_policy["audit_log_retention_days"] is None
        assert restored_policy["login_history_retention_days"] is None

        print("\nSUCCESS: Retention policy & background pruning job backend test passed!")


if __name__ == "__main__":
    asyncio.run(main())
