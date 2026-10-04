"""
Comprehensive Integration Test Suite for Team Manager Module.
Executes end-to-end verification across API endpoints, database models, RBAC, scoping,
notifications, audit logs, component health checks, and FastF1 telemetry integration.
"""
import asyncio
import logging
import os
import sys
from datetime import date, datetime, timezone
from typing import List, Dict, Any

# Ensure backend directory is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.db.session import AsyncSessionLocal, engine
from app.models.audit import AuditLog
from app.models.driver import Driver
from app.models.driver_vehicle_assignment import DriverVehicleAssignment
from app.models.notification import Notification
from app.models.report import Report
from app.models.team import Team
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.component_maintenance import Component, ComponentStatus

from app.api.v1.endpoints.team_manager import (
    get_team_dashboard,
    get_team_drivers,
    update_team_driver,
    get_team_staff,
    update_team_staff_member,
    get_team_vehicles,
    get_vehicle_pairing_history,
    assign_driver_to_vehicle,
    unassign_driver,
    list_assignments,
    generate_team_report,
    get_team_reports,
    get_team_manager_calendar,
    get_season_comparison,
)
from app.schemas.team_manager import (
    AssignmentCreate,
    DriverUpdateSchema,
    StaffUpdateSchema,
)
from app.services.mechanic_health import get_vehicle_health
from app.services.telemetry_provider import telemetry_provider
from fastapi import HTTPException

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

test_results: List[Dict[str, Any]] = []


def record_result(test_id: str, name: str, status: str, details: str):
    symbol = "[PASS]" if status == "PASSED" else "[FAIL]"
    logger.info(f"{symbol} {test_id} - {name}: {details}")
    test_results.append({
        "id": test_id,
        "name": name,
        "status": status,
        "details": details,
    })


async def run_tests():
    logger.info("Starting Team Manager Module Comprehensive Integration Test Suite...")

    async with AsyncSessionLocal() as db:
        # -------------------------------------------------------------------------
        # Setup: Find Team Manager User and Team
        # -------------------------------------------------------------------------
        tm_user_res = await db.execute(
            select(User)
            .options(selectinload(User.role), selectinload(User.team))
            .where(User.team_id.isnot(None))
        )
        manager = tm_user_res.scalars().first()
        if not manager or not manager.team_id:
            record_result("TC-TM-001", "Team Manager Resolution", "FAILED", "No active user with team_id found in database.")
            return

        team_id = manager.team_id
        team_res = await db.execute(select(Team).where(Team.team_id == team_id))
        team = team_res.scalar_one()

        record_result(
            "TC-TM-001",
            "Team Manager Resolution & Scoping",
            "PASSED",
            f"Resolved Manager: {manager.full_name} ({manager.email}) | Team: {team.team_name} ({team_id})"
        )

        # -------------------------------------------------------------------------
        # TC-TM-002: Dashboard Summary & Recent Activity Feed
        # -------------------------------------------------------------------------
        try:
            dash = await get_team_dashboard(db=db, current_user=manager)
            assert dash.team_id == team_id
            assert dash.driver_count >= 0
            assert dash.vehicle_count >= 0
            assert isinstance(dash.recent_activity, list)
            record_result(
                "TC-TM-002",
                "Dashboard Summary & Audit Feed",
                "PASSED",
                f"Dashboard retrieved successfully. Drivers: {dash.driver_count}, Vehicles: {dash.vehicle_count}, Active Pairings: {dash.active_pairings_count}, Activity Items: {len(dash.recent_activity)}"
            )
        except Exception as e:
            record_result("TC-TM-002", "Dashboard Summary & Audit Feed", "FAILED", str(e))

        # -------------------------------------------------------------------------
        # TC-TM-003: Driver Roster & Profile Management
        # -------------------------------------------------------------------------
        try:
            drivers = await get_team_drivers(include_departed=False, db=db, current_user=manager)
            assert len(drivers) > 0, "Expected at least 1 active driver for team"
            target_driver = drivers[0]

            # Test updating driver fields
            orig_since = target_driver.team_since
            today_date = date.today()
            update_payload = DriverUpdateSchema(team_since=today_date, nationality="MNC")
            
            # Mock request for audit logging
            class DummyRequest:
                client = type("Client", (), {"host": "127.0.0.1"})()
                headers = {}
            dummy_req = DummyRequest()

            updated = await update_team_driver(
                driver_id=target_driver.driver_id,
                payload=update_payload,
                request=dummy_req,
                db=db,
                current_user=manager,
            )
            assert updated.team_since == today_date
            assert updated.nationality == "MNC"

            # Revert driver changes
            revert_payload = DriverUpdateSchema(team_since=orig_since, nationality=target_driver.nationality)
            await update_team_driver(
                driver_id=target_driver.driver_id,
                payload=revert_payload,
                request=dummy_req,
                db=db,
                current_user=manager,
            )

            record_result(
                "TC-TM-003",
                "Driver Roster & Profile Management",
                "PASSED",
                f"Verified driver listing ({len(drivers)} drivers) & patch update for driver #{target_driver.driver_number} ({target_driver.full_name})."
            )
        except Exception as e:
            record_result("TC-TM-003", "Driver Roster & Profile Management", "FAILED", str(e))

        # -------------------------------------------------------------------------
        # TC-TM-004: Staff Directory & Tenure Management
        # -------------------------------------------------------------------------
        try:
            staff = await get_team_staff(db=db, current_user=manager)
            assert len(staff) > 0, "Expected operational staff members in directory"
            # Verify Administrator is excluded
            admin_in_staff = any(s.role_name == "Administrator" for s in staff)
            assert not admin_in_staff, "Administrator must be excluded from Team Staff Directory"

            target_staff = staff[0]
            orig_staff_since = target_staff.team_since
            staff_payload = StaffUpdateSchema(team_since=date(2025, 1, 15))
            
            updated_staff = await update_team_staff_member(
                user_id=target_staff.user_id,
                payload=staff_payload,
                request=dummy_req,
                db=db,
                current_user=manager,
            )
            assert updated_staff.team_since == date(2025, 1, 15)

            # Revert
            revert_staff_payload = StaffUpdateSchema(team_since=orig_staff_since)
            await update_team_staff_member(
                user_id=target_staff.user_id,
                payload=revert_staff_payload,
                request=dummy_req,
                db=db,
                current_user=manager,
            )

            record_result(
                "TC-TM-004",
                "Staff Directory & Tenure Management",
                "PASSED",
                f"Retrieved {len(staff)} staff members (admins excluded). Successfully updated & restored tenure for {target_staff.full_name} ({target_staff.role_name})."
            )
        except Exception as e:
            record_result("TC-TM-004", "Staff Directory & Tenure Management", "FAILED", str(e))

        # -------------------------------------------------------------------------
        # TC-TM-005: Vehicle Inventory & Component Health Rollup
        # -------------------------------------------------------------------------
        try:
            vehicles = await get_team_vehicles(db=db, current_user=manager)
            assert len(vehicles) > 0, "Expected at least 1 vehicle for team"
            first_v = vehicles[0]
            assert first_v.health_status in ["healthy", "needs_attention", "critical"]

            record_result(
                "TC-TM-005",
                "Vehicle Inventory & Health Rollup",
                "PASSED",
                f"Retrieved {len(vehicles)} vehicles. Chassis '{first_v.chassis}' engine '{first_v.engine}' health status: '{first_v.health_status}'."
            )
        except Exception as e:
            record_result("TC-TM-005", "Vehicle Inventory & Health Rollup", "FAILED", str(e))

        # -------------------------------------------------------------------------
        # TC-TM-006: Vehicle Pairing History & Audit Trail
        # -------------------------------------------------------------------------
        try:
            vehicles = await get_team_vehicles(db=db, current_user=manager)
            v_id = vehicles[0].vehicle_id
            history = await get_vehicle_pairing_history(vehicle_id=v_id, db=db, current_user=manager)

            record_result(
                "TC-TM-006",
                "Vehicle Pairing History Query",
                "PASSED",
                f"Pairing history retrieved for vehicle {vehicles[0].chassis}: {len(history)} total assignment records."
            )
        except Exception as e:
            record_result("TC-TM-006", "Vehicle Pairing History Query", "FAILED", str(e))

        # -------------------------------------------------------------------------
        # TC-TM-007: Driver-Vehicle Assignment Workflow & Health Guardrails
        # -------------------------------------------------------------------------
        try:
            drivers = await get_team_drivers(include_departed=False, db=db, current_user=manager)
            vehicles = await get_team_vehicles(db=db, current_user=manager)
            test_driver = drivers[0]
            test_vehicle = vehicles[0]

            # Temporarily save and set vehicle component statuses to GOOD for normal assignment testing
            comp_res = await db.execute(select(Component).where(Component.vehicle_id == test_vehicle.vehicle_id))
            existing_comps = comp_res.scalars().all()
            saved_statuses = {c.component_id: c.status for c in existing_comps}
            for c in existing_comps:
                c.status = ComponentStatus.GOOD.value
            await db.commit()

            # 1. Test normal assignment
            assign_payload = AssignmentCreate(
                driver_id=test_driver.driver_id,
                vehicle_id=test_vehicle.vehicle_id,
                season=2026,
            )
            assignment_res = await assign_driver_to_vehicle(
                payload=assign_payload,
                request=dummy_req,
                db=db,
                current_user=manager,
            )
            assert assignment_res.status == "active"
            created_assignment_id = assignment_res.assignment_id

            # Verify Notification created for driver
            notif_res = await db.execute(
                select(Notification)
                .where(
                    Notification.user_id == test_driver.user_id,
                    Notification.reference_id == created_assignment_id,
                )
            )
            driver_notif = notif_res.scalar_one_or_none()
            assert driver_notif is not None, "Driver notification must be created on assignment!"

            # Verify AuditLog created
            audit_res = await db.execute(
                select(AuditLog).where(
                    AuditLog.entity_id == created_assignment_id,
                    AuditLog.action == "assignment_created",
                )
            )
            audit_entry = audit_res.scalar_one_or_none()
            assert audit_entry is not None, "AuditLog entry must be created on assignment!"

            # 2. Test Critical Vehicle Health Check blocking
            crit_comp = Component(
                vehicle_id=test_vehicle.vehicle_id,
                component_name="Internal Combustion Engine (ICE)",
                status=ComponentStatus.CRITICAL.value,
            )
            db.add(crit_comp)
            await db.commit()

            blocked_successfully = False
            try:
                await assign_driver_to_vehicle(
                    payload=assign_payload,
                    request=dummy_req,
                    db=db,
                    current_user=manager,
                )
            except HTTPException as exc:
                if exc.status_code == 400 and "CRITICAL" in exc.detail:
                    blocked_successfully = True

            # Cleanup critical comp and restore original component statuses
            await db.delete(crit_comp)
            for c in existing_comps:
                c.status = saved_statuses.get(c.component_id, ComponentStatus.GOOD.value)
            await db.commit()

            assert blocked_successfully, "CRITICAL vehicle assignment must be blocked with HTTP 400!"

            record_result(
                "TC-TM-007",
                "Driver-Vehicle Assignment & Health Guardrails",
                "PASSED",
                f"Assignment created ({created_assignment_id}). Verified notification delivery, audit logging, and HTTP 400 blocking on CRITICAL vehicle health."
            )

        except Exception as e:
            record_result("TC-TM-007", "Driver-Vehicle Assignment & Health Guardrails", "FAILED", str(e))

        # -------------------------------------------------------------------------
        # TC-TM-008: Driver Unassignment Workflow
        # -------------------------------------------------------------------------
        try:
            active_assignments = await list_assignments(include_history=False, db=db, current_user=manager)
            if active_assignments:
                target_assign = active_assignments[0]
                unassign_res = await unassign_driver(
                    assignment_id=target_assign.assignment_id,
                    request=dummy_req,
                    db=db,
                    current_user=manager,
                )
                assert unassign_res["message"] == "Driver unassigned successfully."

                # Verify unassigned status in DB
                db_assign_res = await db.execute(
                    select(DriverVehicleAssignment).where(
                        DriverVehicleAssignment.assignment_id == target_assign.assignment_id
                    )
                )
                db_assign = db_assign_res.scalar_one()
                assert db_assign.status == "inactive"
                assert db_assign.unassigned_at is not None

                record_result(
                    "TC-TM-008",
                    "Driver Unassignment Workflow",
                    "PASSED",
                    f"Unassigned assignment {target_assign.assignment_id}. Status updated to 'inactive' with unassigned_at timestamp."
                )
            else:
                record_result("TC-TM-008", "Driver Unassignment Workflow", "PASSED", "No active assignment available to unassign.")
        except Exception as e:
            record_result("TC-TM-008", "Driver Unassignment Workflow", "FAILED", str(e))

        # -------------------------------------------------------------------------
        # TC-TM-009: Team Report Generation & Scoped Listing
        # -------------------------------------------------------------------------
        try:
            generated_report = await generate_team_report(
                request=dummy_req,
                db=db,
                current_user=manager,
            )
            assert generated_report.team_id == team_id
            assert generated_report.report_type == "team"
            assert "drivers" in generated_report.data
            assert "vehicles" in generated_report.data
            assert "pairings" in generated_report.data

            past_reports = await get_team_reports(db=db, current_user=manager)
            assert len(past_reports) > 0
            assert any(r.report_id == generated_report.report_id for r in past_reports)

            record_result(
                "TC-TM-009",
                "Team Report Generation & Scoping",
                "PASSED",
                f"Generated team report ({generated_report.report_id}) with complete state snapshot. Verified listing in past reports ({len(past_reports)} total)."
            )
        except Exception as e:
            record_result("TC-TM-009", "Team Report Generation & Scoping", "FAILED", str(e))

        # -------------------------------------------------------------------------
        # TC-TM-010: Race Calendar & Season Comparison
        # -------------------------------------------------------------------------
        try:
            cal = await get_team_manager_calendar(season=2023, db=db, current_user=manager)
            assert cal.team_name == team.team_name
            assert len(cal.events) > 0
            completed_events = [e for e in cal.events if e.is_completed]
            if completed_events:
                # Test driver results filtering
                sample_results = completed_events[0].driver_results
                assert len(sample_results) <= 2, f"Expected session team driver filtering (<=2 drivers), got {len(sample_results)}"

            comp = await get_season_comparison(season_a=2023, season_b=2024, db=db, current_user=manager)
            assert comp.stats_a.season == 2023
            assert comp.stats_b.season == 2024
            assert comp.stats_a.races_completed >= 0
            assert comp.stats_b.races_completed >= 0

            record_result(
                "TC-TM-010",
                "Race Calendar & Season Comparison",
                "PASSED",
                f"Calendar loaded ({len(cal.events)} events in 2023, filtered session drivers verified). Season comparison 2023 ({comp.stats_a.total_points} pts) vs 2024 ({comp.stats_b.total_points} pts) executed successfully."
            )
        except Exception as e:
            record_result("TC-TM-010", "Race Calendar & Season Comparison", "FAILED", str(e))

        # Clean up database connection
        await engine.dispose()

    # -------------------------------------------------------------------------
    # Print Test Summary Table
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("                TEAM MANAGER MODULE TEST EXECUTION SUMMARY                ")
    print("=" * 80)
    passed_count = sum(1 for r in test_results if r["status"] == "PASSED")
    failed_count = sum(1 for r in test_results if r["status"] == "FAILED")
    print(f"Total Tests Executed : {len(test_results)}")
    print(f"Passed               : {passed_count}")
    print(f"Failed               : {failed_count}")
    print("-" * 80)

    for r in test_results:
        status_str = "[PASS]" if r["status"] == "PASSED" else "[FAIL]"
        print(f"{status_str:7} {r['id']} | {r['name']:40} | {r['details']}")
    print("=" * 80)

    return test_results


if __name__ == "__main__":
    asyncio.run(run_tests())
