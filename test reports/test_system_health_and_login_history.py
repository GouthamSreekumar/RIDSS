"""
Integration & Verification script for RIDSS System Health and Login History.

Run via CLI:
    python -m scripts.test_system_health_and_login_history
"""
import asyncio
import logging
import os
import sys
from datetime import datetime, timezone

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from alembic.config import Config
from alembic import command
from sqlalchemy import select, text

from app.core.config import get_settings
from app.core.rbac import rbac_cache
from app.db.session import AsyncSessionLocal
from app.models import Base, User, Role, Permission, RolePermission, LoginHistory, CacheStatus
from app.services.cache import fastf1_cache

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)


async def run_tests():
    logger.info("=== 1. Running Alembic Migrations to Head ===")
    alembic_cfg = Config(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "alembic.ini"))
    try:
        command.upgrade(alembic_cfg, "head")
        logger.info("Alembic upgrade head completed successfully.")
    except Exception as e:
        logger.warning("Alembic upgrade failed (may already be managed or in-memory): %s", e)

    async with AsyncSessionLocal() as db:
        # 2. Initialize RBAC Cache
        logger.info("=== 2. Initializing RBAC Cache Engine ===")
        await rbac_cache.initialize(db)

        # Verify system:read permission
        perm_res = await db.execute(select(Permission).where(Permission.permission_key == "system:read"))
        sys_perm = perm_res.scalar_one_or_none()
        assert sys_perm is not None, "system:read permission missing from database!"
        logger.info("Verified system:read permission in DB: ID=%s", sys_perm.permission_id)

        admin_role_res = await db.execute(select(Role).where(Role.role_name == "Administrator"))
        admin_role = admin_role_res.scalar_one_or_none()
        assert admin_role is not None, "Administrator role missing!"

        has_sys_perm = rbac_cache.has_permission(admin_role.role_id, "system:read")
        logger.info("Administrator role has system:read permission: %s", has_sys_perm)
        assert has_sys_perm, "Administrator role does not have system:read permission in RBAC cache!"

        # 3. Test LoginHistory insertion & retrieval
        logger.info("=== 3. Testing LoginHistory Creation & Query ===")
        user_res = await db.execute(select(User).where(User.role_id == admin_role.role_id))
        admin_user = user_res.scalars().first()
        assert admin_user is not None, "No Admin user found for login history test."

        login_rec = LoginHistory(
            user_id=admin_user.user_id,
            logged_in_at=datetime.now(timezone.utc),
            ip_address="127.0.0.1",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) VerificationTest/1.0",
        )
        db.add(login_rec)
        await db.commit()
        logger.info("Created test LoginHistory entry for user: %s", admin_user.email)

        # Retrieve login history
        history_res = await db.execute(
            select(LoginHistory)
            .where(LoginHistory.user_id == admin_user.user_id)
            .order_by(LoginHistory.logged_in_at.desc())
        )
        history_items = history_res.scalars().all()
        assert len(history_items) > 0, "Failed to retrieve login history entries!"
        logger.info("Retrieved %d login history records for user %s. Latest IP: %s", len(history_items), admin_user.email, history_items[0].ip_address)

        # 4. Test CacheStatus Table Upsert
        logger.info("=== 4. Testing CacheStatus Table Upsert ===")
        cs_res = await db.execute(select(CacheStatus).where(CacheStatus.id == "default"))
        cs_row = cs_res.scalar_one_or_none()
        now = datetime.now(timezone.utc)
        if cs_row:
            cs_row.last_prewarm_at = now
            cs_row.status = "success"
            cs_row.details = "Verified by test_system_health_and_login_history"
            cs_row.updated_at = now
        else:
            cs_row = CacheStatus(
                id="default",
                last_prewarm_at=now,
                status="success",
                details="Verified by test_system_health_and_login_history",
                updated_at=now,
            )
            db.add(cs_row)
        await db.commit()

        cs_check = (await db.execute(select(CacheStatus).where(CacheStatus.id == "default"))).scalar_one_or_none()
        assert cs_check is not None and cs_check.last_prewarm_at is not None, "CacheStatus table upsert failed!"
        logger.info("CacheStatus verified. Last prewarm at: %s", cs_check.last_prewarm_at.isoformat())

        # 5. Test System Health Endpoint Logic
        logger.info("=== 5. Testing System Health API Endpoint Functionality ===")
        from app.api.v1.endpoints.admin_system import get_system_health, get_user_login_history

        health_resp = await get_system_health(db=db, _current_user=admin_user)
        logger.info("System Health Endpoint Output: Overall status = %s", health_resp.status)
        logger.info("  -> DB status: %s (Response time: %s ms)", health_resp.database.status, health_resp.database.response_time_ms)
        logger.info("  -> Cache status: %s (Disk footprint: %s)", health_resp.cache.status, health_resp.cache.size_formatted)
        logger.info("  -> Migration status: %s (Applied: %s, Head: %s)", health_resp.migrations.status, health_resp.migrations.applied_version, health_resp.migrations.current_head)

        assert health_resp.database.status == "Healthy", "Database check reported unhealthy!"
        assert health_resp.status in ["Healthy", "Degraded"], f"Unexpected overall status: {health_resp.status}"

        # 6. Test User Login History Endpoint Functionality
        logger.info("=== 6. Testing GET /admin/users/{id}/login-history Endpoint Functionality ===")
        user_history = await get_user_login_history(user_id=admin_user.user_id, db=db, _current_user=admin_user)
        assert len(user_history) > 0, "get_user_login_history returned empty list!"
        logger.info("get_user_login_history returned %d records. Latest entry logged at: %s", len(user_history), user_history[0].logged_in_at.isoformat())

        # 7. Test Graceful Unreachable DB Handling
        logger.info("=== 7. Testing Graceful Error Handling on DB Failure ===")
        class MockFailingDB:
            async def execute(self, statement, *args, **kwargs):
                raise Exception("Simulated PostgreSQL connection drop")

        mock_failing_db = MockFailingDB()
        failing_health_resp = await get_system_health(db=mock_failing_db, _current_user=admin_user)
        assert failing_health_resp.database.status == "Unreachable", "Failing DB did not return 'Unreachable' status!"
        assert failing_health_resp.status == "Critical", f"Failing DB did not yield 'Critical' overall status! Got: {failing_health_resp.status}"
        logger.info("Verified: Unreachable DB handled gracefully without endpoint crash. Overall status = Critical.")

        logger.info("=== ALL SYSTEM HEALTH & LOGIN HISTORY VERIFICATION TESTS PASSED SUCCESSFULLY! ===")


if __name__ == "__main__":
    asyncio.run(run_tests())
