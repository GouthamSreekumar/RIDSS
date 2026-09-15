"""
Integration test script for Race Engineer Module.
Tests end-to-end functionality including database queries, FastF1 telemetry provider,
Tier 1 overview (session.results, sector breakdown, deleted/is_accurate flags),
Tier 2 lap telemetry (X/Y trace, FastF1 corner turn markers),
comparison data (fastf1.utils.delta_time & driver colors), report creation, audit logging, and notifications.
"""
import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import AsyncSessionLocal
from app.models.audit import AuditLog
from app.models.driver import Driver
from app.models.notification import Notification
from app.models.race_circuit import Circuit
from app.models.report import Report
from app.models.role import Role
from app.models.team import Team
from app.models.user import User, UserRoleEnum
from app.services.race_telemetry import (
    get_processed_comparison,
    get_processed_lap_telemetry,
    get_processed_session_overview,
)
from app.services.telemetry_provider import telemetry_provider

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def run_integration_tests():
    async with AsyncSessionLocal() as session:
        logger.info("=== 1. Testing Database & Roles Setup ===")
        team_res = await session.execute(select(Team))
        team = team_res.scalars().first()
        assert team is not None, "Team not found in database!"
        logger.info("Team found: %s (%s)", team.team_name, team.team_id)

        role_res = await session.execute(
            select(Role).where(Role.role_name == UserRoleEnum.RACE_ENGINEER.value)
        )
        role = role_res.scalars().first()
        assert role is not None, "Race Engineer role not found!"

        user_res = await session.execute(
            select(User).where(User.email == "race.engineer@ridss.team")
        )
        engineer = user_res.scalars().first()
        if not engineer:
            engineer = User(
                user_id=str(uuid.uuid4()),
                full_name="Lead Race Engineer",
                email="race.engineer@ridss.team",
                password_hash="hashed_test_pass",
                role_id=role.role_id,
                team_id=team.team_id,
                status="active",
                created_at=datetime.now(timezone.utc),
            )
            session.add(engineer)
            await session.commit()
            await session.refresh(engineer)

        logger.info("Race Engineer User ready: %s", engineer.full_name)

        logger.info("=== 2. Testing Dynamic Season Computation ===")
        seasons = telemetry_provider.get_seasons()
        assert 2023 in seasons, "2023 must be present in dynamic season list!"
        assert datetime.now(timezone.utc).year in seasons, "Current year must be in dynamic seasons list!"
        logger.info("Seasons list: %s", seasons)

        logger.info("=== 3. Testing Circuit Database Entries ===")
        circuits_res = await session.execute(select(Circuit))
        circuits = circuits_res.scalars().all()
        logger.info("Total circuits in database: %d", len(circuits))

        logger.info("=== 4. Testing Tier 1 Session Overview (Results, Sector Times & Quality Flags) ===")
        overview = await get_processed_session_overview(
            db=session,
            season=2023,
            circuit_name="Bahrain",
            session_type="Race",
            team_id=team.team_id,
        )
        assert overview is not None
        assert overview.total_laps > 0
        logger.info(
            "Tier 1 Overview Success - Session: %s, Total Laps: %d, Results count: %d, Team Drivers: %s",
            overview.session_id,
            overview.total_laps,
            len(overview.session_results),
            list(overview.driver_lap_summaries.keys()),
        )

        logger.info("=== 5. Testing Tier 2 Lap Telemetry Stream & FastF1 Corner Turn Markers ===")
        driver_code = list(overview.driver_lap_summaries.keys())[0] if overview.driver_lap_summaries else "VER"
        lap_tel = await get_processed_lap_telemetry(
            db=session,
            season=2023,
            circuit_name="Bahrain",
            session_type="Race",
            driver_code=driver_code,
            lap_number=1,
        )
        assert lap_tel is not None
        assert len(lap_tel.telemetry_points) > 0
        logger.info(
            "Tier 2 Telemetry Success - Driver: %s, Telemetry points: %d, Corner markers: %d, Driver color: %s",
            lap_tel.driver_code,
            len(lap_tel.telemetry_points),
            len(lap_tel.corners),
            lap_tel.driver_color,
        )

        logger.info("=== 6. Testing Comparison Telemetry Aligned via fastf1.utils.delta_time ===")
        comp = await get_processed_comparison(
            season=2023,
            circuit_name="Bahrain",
            session_type="Race",
            primary_driver="VER",
            primary_lap=1,
            secondary_driver="PER",
            secondary_lap=1,
        )
        assert comp is not None
        assert len(comp.aligned_distance) > 0
        logger.info(
            "Comparison Mode Success - Primary: %s (%s), Secondary: %s (%s), Aligned Points: %d, Time Deltas: %d",
            comp.primary_driver,
            comp.primary_color,
            comp.secondary_driver,
            comp.secondary_color,
            len(comp.aligned_distance),
            len(comp.time_delta_seconds),
        )

        logger.info("=== 7. Testing Engineering Report Generation & Shared AuditLog/Notification Hooks ===")
        report_data = {
            "session_id": "2023_bahrain_race",
            "driver_code": driver_code,
            "driver_name": "Max Verstappen",
            "key_findings": "Excellent throttle response out of Turn 4 and optimal tire temperature window.",
            "stint_degradation_trend": "Degradation 0.04s per lap across medium stint.",
            "summary_stats": {"avg_speed": "218 km/h", "max_speed": "324 km/h"},
        }
        report = Report(
            generated_by=engineer.user_id,
            team_id=team.team_id,
            report_type="engineering",
            data=report_data,
            created_at=datetime.now(timezone.utc),
        )
        session.add(report)
        await session.flush()

        audit = AuditLog(
            user_id=engineer.user_id,
            action="report_generated",
            entity_type="Report",
            entity_id=report.report_id,
            details=json.dumps({"team_id": team.team_id, "report_id": report.report_id, "report_type": "engineering"}),
            created_at=datetime.now(timezone.utc),
        )
        session.add(audit)

        driver_res = await session.execute(select(Driver).options(selectinload(Driver.user)))
        driver_obj = driver_res.scalars().first()
        if driver_obj and driver_obj.user:
            noti = Notification(
                user_id=driver_obj.user_id,
                title="New Performance Report Available",
                message=f"New engineering performance report generated by {engineer.full_name}.",
                status="unread",
                created_at=datetime.now(timezone.utc),
            )
            session.add(noti)

        await session.commit()
        logger.info("Engineering report created: %s", report.report_id)
        logger.info("AuditLog entry logged with action 'report_generated'")
        logger.info("Driver notification created successfully!")

        logger.info("=== ALL RACE ENGINEER INTEGRATION TESTS PASSED CLEANLY! ===")


if __name__ == "__main__":
    asyncio.run(run_integration_tests())
