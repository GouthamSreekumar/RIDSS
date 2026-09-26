"""
Verification script for Driver Module.
Tests:
1. Driver Dashboard endpoint (GET /api/v1/driver/dashboard)
2. Own Reports endpoint (GET /api/v1/driver/reports)
3. Report Detail view & Cross-driver security isolation (GET /api/v1/driver/reports/{id})
4. Season Session History endpoint (GET /api/v1/driver/sessions?season=2024)
5. Driver Notifications endpoint (GET /api/v1/driver/notifications)
6. Mark Notification read & Cross-driver notification security (PATCH /api/v1/driver/notifications/{id}/read)
"""
import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import AsyncSessionLocal
from app.models.driver import Driver
from app.models.notification import Notification
from app.models.report import Report
from app.models.user import User
from app.api.v1.endpoints.driver import (
    get_driver_dashboard,
    get_driver_notifications,
    get_driver_report_detail,
    get_driver_reports,
    get_driver_sessions,
    mark_notification_as_read,
)
from fastapi import HTTPException

logger = logging.getLogger(__name__)


async def verify_driver_module():
    # 1. Ensure Red Bull drivers are seeded
    from scripts.seed_redbull_drivers import seed_redbull_drivers
    await seed_redbull_drivers()

    async with AsyncSessionLocal() as db:
        # Query drivers with active user accounts
        drivers_res = await db.execute(
            select(Driver).options(selectinload(Driver.user)).join(User).where(User.status == "active")
        )
        drivers = drivers_res.scalars().all()
        if len(drivers) < 2:
            raise RuntimeError(f"Expected at least 2 active drivers in DB, found {len(drivers)}")

        driver_a = drivers[0]
        driver_b = drivers[1]
        user_a = driver_a.user
        user_b = driver_b.user

        print("================================================================")
        print(f"Testing Driver Module for User A: {user_a.full_name} ({user_a.email}, Code: {driver_a.fastf1_code})")
        print(f"Testing Driver Module for User B: {user_b.full_name} ({user_b.email}, Code: {driver_b.fastf1_code})")
        print("================================================================")

        # 2. Test GET /api/v1/driver/dashboard
        dash_a = await get_driver_dashboard(db=db, current_user=user_a)
        print(f"[PASSED] Dashboard fetched successfully for {user_a.full_name}:")
        print(f"  - Points: {dash_a.current_season_points}")
        print(f"  - Last Finish: {dash_a.last_race_position_text}")
        print(f"  - Last Session Date: {dash_a.last_session_date}")

        # 3. Create test reports for User A and User B
        report_a = Report(
            generated_by=user_a.user_id,
            team_id=user_a.team_id,
            report_type="engineering",
            data={
                "session_id": "2024_bahrain_race",
                "driver_code": driver_a.fastf1_code,
                "driver_name": user_a.full_name,
                "driver_id": driver_a.driver_id,
                "target_driver_user_id": user_a.user_id,
                "key_findings": "Optimal stint pace on hard compound.",
                "stint_degradation_trend": "Low degradation.",
            },
            created_at=datetime.now(timezone.utc),
        )
        db.add(report_a)

        report_b = Report(
            generated_by=user_b.user_id,
            team_id=user_b.team_id,
            report_type="engineering",
            data={
                "session_id": "2024_bahrain_race",
                "driver_code": driver_b.fastf1_code,
                "driver_name": user_b.full_name,
                "driver_id": driver_b.driver_id,
                "target_driver_user_id": user_b.user_id,
                "key_findings": "Tire wear noted on front left.",
                "stint_degradation_trend": "Medium degradation.",
            },
            created_at=datetime.now(timezone.utc),
        )
        db.add(report_b)

        # 4. Create test notifications
        notif_a = Notification(
            user_id=user_a.user_id,
            title="Driver A Alert",
            message="Test notification for Verstappen.",
            status="unread",
            reference_type="report",
            reference_id="test_report_a_id",
            created_at=datetime.now(timezone.utc),
        )
        db.add(notif_a)

        notif_b = Notification(
            user_id=user_b.user_id,
            title="Driver B Alert",
            message="Test notification for Perez.",
            status="unread",
            reference_type="report",
            reference_id="test_report_b_id",
            created_at=datetime.now(timezone.utc),
        )
        db.add(notif_b)

        await db.commit()
        await db.refresh(report_a)
        await db.refresh(report_b)
        await db.refresh(notif_a)
        await db.refresh(notif_b)

        # 5. Test GET /api/v1/driver/reports for User A
        reports_a = await get_driver_reports(db=db, current_user=user_a)
        print(f"[PASSED] GET /reports for User A returned {len(reports_a)} reports.")
        report_ids_a = {r.report_id for r in reports_a}
        assert report_a.report_id in report_ids_a, "Report A should be in Driver A reports!"
        assert report_b.report_id not in report_ids_a, "CRITICAL: Report B must NOT leak to Driver A!"
        print("  - [VERIFIED] No cross-driver report leakage!")

        # 6. Test GET /api/v1/driver/reports/{id} Ownership check
        detail_own = await get_driver_report_detail(report_id=report_a.report_id, db=db, current_user=user_a)
        print(f"[PASSED] Driver A fetched own report detail: {detail_own.report_id}")

        try:
            await get_driver_report_detail(report_id=report_b.report_id, db=db, current_user=user_a)
            assert False, "CRITICAL FAILURE: Driver A was able to access Driver B's report!"
        except HTTPException as exc:
            assert exc.status_code == 403, f"Expected 403 Forbidden, got {exc.status_code}"
            print(f"  - [VERIFIED] Cross-driver report access correctly forbidden (HTTP 403): {exc.detail}")

        # 7. Test GET /api/v1/driver/sessions?season=2024
        sessions_a = await get_driver_sessions(season=2024, db=db, current_user=user_a)
        print(f"[PASSED] GET /sessions?season=2024 returned {len(sessions_a.sessions)} session entries for {sessions_a.driver_code}.")

        # 8. Test GET /api/v1/driver/notifications
        notifs_a = await get_driver_notifications(db=db, current_user=user_a)
        print(f"[PASSED] GET /notifications returned {len(notifs_a)} notifications for Driver A.")
        notif_ids_a = {n.notification_id for n in notifs_a}
        assert notif_a.notification_id in notif_ids_a
        assert notif_b.notification_id not in notif_ids_a, "CRITICAL: Notification B must NOT leak to Driver A!"
        print("  - [VERIFIED] No cross-driver notification leakage!")

        # 9. Test PATCH /api/v1/driver/notifications/{id}/read Ownership check
        read_res = await mark_notification_as_read(notification_id=notif_a.notification_id, db=db, current_user=user_a)
        assert read_res.status == "read"
        print(f"[PASSED] Driver A successfully marked own notification {notif_a.notification_id} as read.")

        try:
            await mark_notification_as_read(notification_id=notif_b.notification_id, db=db, current_user=user_a)
            assert False, "CRITICAL FAILURE: Driver A was able to mark Driver B's notification read!"
        except HTTPException as exc:
            assert exc.status_code == 403
            print(f"  - [VERIFIED] Cross-driver notification update correctly forbidden (HTTP 403): {exc.detail}")

        print("================================================================")
        print("ALL DRIVER MODULE ENDPOINTS & OWN-DRIVER SECURITY CHECKS PASSED!")
        print("================================================================")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(verify_driver_module())
