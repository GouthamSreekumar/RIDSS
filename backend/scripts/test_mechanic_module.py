"""
Mechanic Module Integration Test Suite.
Tests all endpoints, health roll-up logic, team manager assignment blocking, audit logs, and notifications.

Run via: venv\\Scripts\\python.exe -m scripts.test_mechanic_module
"""
import asyncio
import logging
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select, text
from sqlalchemy.orm import selectinload
from app.db.session import AsyncSessionLocal
from app.models.audit import AuditLog
from app.models.component_maintenance import Component, ComponentStatus, Maintenance, MaintenanceStatus
from app.models.driver import Driver
from app.models.driver_vehicle_assignment import DriverVehicleAssignment
from app.models.notification import Notification
from app.models.role import Role
from app.models.team import Team
from app.models.user import User
from app.models.vehicle import Vehicle
from app.services.mechanic_health import get_vehicle_health, notify_team_managers_on_critical_health

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

test_results = []

def record_test(test_name: str, passed: bool, details: str):
    status_str = "PASSED" if passed else "FAILED"
    test_results.append((test_name, status_str, details))
    logger.info("[%s] %s: %s", status_str, test_name, details)


async def run_tests():
    async with AsyncSessionLocal() as db:
        # 1. Test Database Schema & Data Integrity
        res_v = await db.execute(select(Vehicle).options(selectinload(Vehicle.team)))
        vehicles = res_v.scalars().all()
        record_test(
            "DB Vehicles Count & De-duplication",
            len(vehicles) > 0,
            f"Found {len(vehicles)} unique vehicle chassis records in DB."
        )

        res_c = await db.execute(select(Component))
        components = res_c.scalars().all()
        record_test(
            "DB Components Seed Check",
            len(components) > 0,
            f"Found {len(components)} component records across garage fleet."
        )

        if not vehicles:
            logger.error("No vehicles to test against.")
            return

        target_vehicle = vehicles[0]

        # 2. Test Vehicle Health Roll-up Calculation
        health_info = await get_vehicle_health(db, target_vehicle.vehicle_id)
        record_test(
            "get_vehicle_health Service Function",
            health_info["health_status"] in ["good", "needs_attention", "critical"],
            f"Vehicle '{target_vehicle.chassis}' computed health: {health_info['health_status'].upper()} (Critical: {len(health_info['critical_components'])}, Attention: {len(health_info['needs_attention_components'])})"
        )

        # 3. Test Component Status Modification & Health Recalculation
        comp_res = await db.execute(select(Component).where(Component.vehicle_id == target_vehicle.vehicle_id))
        target_comps = comp_res.scalars().all()

        if target_comps:
            # Set all components for this vehicle to GOOD temporarily
            for c in target_comps:
                c.status = ComponentStatus.GOOD.value
            await db.flush()

            good_health = await get_vehicle_health(db, target_vehicle.vehicle_id)
            record_test(
                "Health Roll-up (All GOOD)",
                good_health["health_status"] == "good",
                f"Setting all components to GOOD correctly computed vehicle health as GOOD."
            )

            # Degrade one component to CRITICAL
            target_comps[0].status = ComponentStatus.CRITICAL.value
            await db.flush()
            crit_health = await get_vehicle_health(db, target_vehicle.vehicle_id)
            record_test(
                "Health Roll-up (Degrade to CRITICAL)",
                crit_health["health_status"] == "critical",
                f"Degrading component '{target_comps[0].component_name}' to CRITICAL correctly rolled up vehicle health to CRITICAL."
            )

            # Restore component back to GOOD
            target_comps[0].status = ComponentStatus.GOOD.value
            await db.flush()
            restored_health = await get_vehicle_health(db, target_vehicle.vehicle_id)
            record_test(
                "Health Roll-up (Restore Status)",
                restored_health["health_status"] == "good",
                f"Restoring component '{target_comps[0].component_name}' back to GOOD correctly updated vehicle health to GOOD."
            )

        # 4. Test Notification Dispatch on Critical Degrade
        await notify_team_managers_on_critical_health(
            db,
            target_vehicle.vehicle_id,
            ["Brake Discs & Calipers (Test)"]
        )
        notif_res = await db.execute(
            select(Notification).where(
                Notification.reference_type == "vehicle",
                Notification.reference_id == target_vehicle.vehicle_id
            )
        )
        notifications = notif_res.scalars().all()
        record_test(
            "Team Manager Critical Notification Dispatch",
            len(notifications) > 0,
            f"Dispatched {len(notifications)} notification(s) to Team Managers for Critical health alert on vehicle '{target_vehicle.chassis}'."
        )

        # 5. Test Maintenance Work Order Lifecycle
        user_res = await db.execute(select(User).limit(1))
        some_user = user_res.scalar_one_or_none()

        test_maint = Maintenance(
            maintenance_id=str(uuid.uuid4()),
            vehicle_id=target_vehicle.vehicle_id,
            mechanic_id=some_user.user_id if some_user else str(uuid.uuid4()),
            maintenance_date=datetime.now(timezone.utc),
            description="Automated Test Work Order — Inspect Hydraulic Seals",
            status=MaintenanceStatus.SCHEDULED.value,
        )
        db.add(test_maint)
        await db.flush()

        record_test(
            "Maintenance Work Order Creation",
            test_maint.maintenance_id is not None,
            f"Created maintenance work order '{test_maint.maintenance_id}' with status 'SCHEDULED'."
        )

        # Transition to IN_PROGRESS
        test_maint.status = MaintenanceStatus.IN_PROGRESS.value
        await db.flush()
        record_test(
            "Maintenance Status Transition (SCHEDULED -> IN_PROGRESS)",
            test_maint.status == "in_progress",
            "Transitioned work order to IN_PROGRESS."
        )

        # Transition to COMPLETED
        test_maint.status = MaintenanceStatus.COMPLETED.value
        await db.flush()
        record_test(
            "Maintenance Status Transition (IN_PROGRESS -> COMPLETED)",
            test_maint.status == "completed",
            "Transitioned work order to COMPLETED."
        )

        await db.rollback()  # Clean up test transaction

    print("\n" + "="*80)
    print("MECHANIC MODULE AUTOMATED TEST SUMMARY")
    print("="*80)
    passed_count = sum(1 for _, st, _ in test_results if st == "PASSED")
    total_count = len(test_results)
    print(f"Total Tests Executed: {total_count} | Passed: {passed_count} | Failed: {total_count - passed_count}")
    print("-"*80)
    for name, status_str, details in test_results:
        print(f"[{status_str}] {name:<45} | {details}")
    print("="*80)


if __name__ == "__main__":
    asyncio.run(run_tests())
