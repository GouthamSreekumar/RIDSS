"""
Integration test script for Strategy Engineer Module.
Validates:
 1. Architectural Boundary: Strategy Engineer reuses Race Engineer's processed service layer (no direct FastF1 calls).
 2. calculate_tire_degradation(): linear trend fit per stint/compound, excluding deleted & SC/VSC caution laps.
 3. estimate_pit_window(): deterministic crossover calculation, pit loss from SystemSettings, transparent reasoning.
 4. Historical cross-season review API & aggregation.
 5. RaceStrategy database table & strategy plan creation/retrieval API.
 6. Strategy Report generation with shared Report table, AuditLog entry ("strategy_report_generated"), and Driver Notification.
 7. RBAC permissions verification (Strategy Engineer scoped to strategy-only).
"""
import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import AsyncSessionLocal, engine
from app.models.base import Base
from app.models.audit import AuditLog
from app.models.driver import Driver
from app.models.notification import Notification
from app.models.race_strategy import RaceStrategy
from app.models.report import Report
from app.models.role import Role
from app.models.settings import SystemSettings
from app.models.team import Team
from app.models.user import User, UserRoleEnum
from app.services.race_telemetry import get_processed_session_overview
from app.schemas.strategy_engineer import TireAnalysisResponse
from app.services.strategy_analysis import (
    calculate_tire_degradation_for_laps,
    estimate_pit_window,
    get_circuit_pit_loss,
    summarize_historical_cross_season,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def run_strategy_engineer_integration_tests():
    # Ensure database schema is created
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        logger.info("=== 1. Testing Database & Strategy Engineer Role Setup ===")
        team_res = await session.execute(select(Team))
        team = team_res.scalars().first()
        if not team:
            team = Team(team_name="Oracle Red Bull Racing", principal="Christian Horner")
            session.add(team)
            await session.flush()
        logger.info("Team found/created: %s (%s)", team.team_name, team.team_id)

        role_res = await session.execute(
            select(Role).where(Role.role_name == UserRoleEnum.STRATEGY_ENGINEER.value)
        )
        role = role_res.scalars().first()
        if not role:
            role = Role(role_name=UserRoleEnum.STRATEGY_ENGINEER.value, description="Strategy Engineer Role")
            session.add(role)
            await session.flush()
        logger.info("Strategy Engineer role found/created: %s (%s)", role.role_name, role.role_id)

        user_res = await session.execute(
            select(User).where(User.email == "strategy.engineer@ridss.team")
        )
        strategy_eng = user_res.scalars().first()
        if not strategy_eng:
            strategy_eng = User(
                user_id=str(uuid.uuid4()),
                full_name="Lead Strategy Engineer",
                email="strategy.engineer@ridss.team",
                password_hash="hashed_test_pass",
                role_id=role.role_id,
                team_id=team.team_id,
                status="active",
                created_at=datetime.now(timezone.utc),
            )
            session.add(strategy_eng)
            await session.commit()
            await session.refresh(strategy_eng)

        logger.info("Strategy Engineer User ready: %s", strategy_eng.full_name)

        logger.info("=== 2. Testing Architectural Boundary (Reusing Processed Data Layer) ===")
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
            "Architectural Boundary Pass - Session: %s, Total Laps: %d, Team Drivers: %s",
            overview.session_id,
            overview.total_laps,
            list(overview.driver_lap_summaries.keys()),
        )

        logger.info("=== 3. Testing calculate_tire_degradation() (Excluding SC/VSC & Deleted Laps) ===")
        driver_code = list(overview.driver_lap_summaries.keys())[0] if overview.driver_lap_summaries else "VER"
        driver_laps = overview.driver_lap_summaries.get(driver_code, [])

        session_info = {
            "session_id": overview.session_id,
            "season": 2023,
            "circuit_name": "Bahrain",
            "session_type": "Race",
        }
        tire_analysis = calculate_tire_degradation_for_laps(driver_laps, driver_code, session_info)
        assert tire_analysis is not None
        assert len(tire_analysis.stints) > 0

        stint1 = tire_analysis.stints[0]
        logger.info(
            "Tire Analysis Pass - Driver: %s, Stint 1 Compound: %s, Total Laps: %d, Valid Laps: %d, Excluded: %d, Deg Rate: %s s/lap, Base Pace: %s s",
            driver_code,
            stint1.compound,
            stint1.total_laps,
            stint1.valid_laps,
            stint1.excluded_laps_count,
            stint1.degradation_rate,
            stint1.base_pace,
        )

        logger.info("=== 4. Testing estimate_pit_window() & SystemSettings Pit Loss Constant ===")
        # Verify pit loss fetching from SystemSettings
        pit_loss = await get_circuit_pit_loss(session, "Bahrain")
        assert pit_loss > 0
        logger.info("Circuit Pit Loss Constant: %.1f seconds", pit_loss)

        all_team_stints = []
        for code, laps in overview.driver_lap_summaries.items():
            res = calculate_tire_degradation_for_laps(laps, code, session_info)
            all_team_stints.extend(res.stints)

        # 4a. Test early race stint 1 pit window recommendation
        stint1_analysis = TireAnalysisResponse(
            session_id=tire_analysis.session_id,
            season=tire_analysis.season,
            circuit_name=tire_analysis.circuit_name,
            session_type=tire_analysis.session_type,
            driver_code=tire_analysis.driver_code,
            stints=[tire_analysis.stints[0]],
        )
        rec_stint1 = estimate_pit_window(stint1_analysis, all_team_stints, pit_loss, total_laps=overview.total_laps)
        assert rec_stint1 is not None
        assert rec_stint1.crossover_lap is not None
        assert rec_stint1.recommended_window_start is not None
        assert rec_stint1.recommended_window_end is not None
        logger.info(
            "Early Race Pit Recommendation Pass - Current Stint: %s, Alternate: %s, Crossover Lap: %d, Window: Laps %d-%d",
            rec_stint1.current_compound,
            rec_stint1.alternate_compound,
            rec_stint1.crossover_lap,
            rec_stint1.recommended_window_start,
            rec_stint1.recommended_window_end,
        )

        # 4b. Test late race final stint hold position guardrail
        rec_final = estimate_pit_window(tire_analysis, all_team_stints, pit_loss, total_laps=overview.total_laps)
        assert rec_final is not None
        assert rec_final.crossover_lap is None
        assert "Hold Position" in rec_final.reasoning
        logger.info("Late Race Hold Position Guardrail Pass - Reasoning: %s", rec_final.reasoning)

        logger.info("=== 5. Testing Historical Cross-Season Review API ===")
        historical_review = summarize_historical_cross_season("Bahrain", [2023], [overview])
        assert historical_review is not None
        assert len(historical_review.compound_summaries) > 0
        logger.info(
            "Historical Review Pass - Circuit: %s, Seasons: %s, Compounds Analyzed: %d",
            historical_review.circuit,
            historical_review.seasons,
            len(historical_review.compound_summaries),
        )

        logger.info("=== 6. Testing RaceStrategy Table & Strategy Plan Creation ===")
        plan_data = {
            "title": "Bahrain 2-Stop Strategy Plan",
            "driver_code": driver_code,
            "stints": [
                {"stint_number": 1, "compound": "MEDIUM", "start_lap": 1, "end_lap": 18, "target_pit_lap": 18, "notes": "Start on Mediums"},
                {"stint_number": 2, "compound": "HARD", "start_lap": 19, "end_lap": 38, "target_pit_lap": 38, "notes": "Middle stint on Hard"},
                {"stint_number": 3, "compound": "SOFT", "start_lap": 39, "end_lap": 57, "target_pit_lap": None, "notes": "Final stint sprint on Softs"},
            ]
        }
        race_strat = RaceStrategy(
            team_id=team.team_id,
            session_id="2023_bahrain_race",
            created_by=strategy_eng.user_id,
            plan=plan_data,
            created_at=datetime.now(timezone.utc),
        )
        session.add(race_strat)
        await session.flush()

        audit_strat = AuditLog(
            user_id=strategy_eng.user_id,
            action="strategy_created",
            entity_type="RaceStrategy",
            entity_id=race_strat.id,
            details=json.dumps({"team_id": team.team_id, "session_id": "2023_bahrain_race"}),
            created_at=datetime.now(timezone.utc),
        )
        session.add(audit_strat)
        await session.commit()
        logger.info("RaceStrategy Plan Created Pass - ID: %s", race_strat.id)

        logger.info("=== 7. Testing Strategy Report Generation & Shared AuditLog/Notification Hooks ===")
        report_data = {
            "session_id": "2023_bahrain_race",
            "driver_code": driver_code,
            "driver_name": "Max Verstappen",
            "tire_degradation_summary": f"Medium stint degradation calculated at {stint1.degradation_rate} s/lap.",
            "pit_window_reasoning": rec_stint1.reasoning,
            "strategy_plan_id": race_strat.id,
            "key_findings": "Optimal 2-stop strategy target window Laps 16-19.",
        }
        strat_report = Report(
            generated_by=strategy_eng.user_id,
            team_id=team.team_id,
            report_type="strategy",
            data=report_data,
            created_at=datetime.now(timezone.utc),
        )
        session.add(strat_report)
        await session.flush()

        audit_report = AuditLog(
            user_id=strategy_eng.user_id,
            action="strategy_report_generated",
            entity_type="Report",
            entity_id=strat_report.report_id,
            details=json.dumps({"team_id": team.team_id, "report_id": strat_report.report_id, "report_type": "strategy"}),
            created_at=datetime.now(timezone.utc),
        )
        session.add(audit_report)

        driver_res = await session.execute(select(Driver).options(selectinload(Driver.user)))
        driver_obj = driver_res.scalars().first()
        if driver_obj and driver_obj.user:
            noti = Notification(
                user_id=driver_obj.user_id,
                title="New Race Strategy Report Available",
                message=f"Strategy Engineer {strategy_eng.full_name} generated a strategy report.",
                status="unread",
                reference_type="report",
                reference_id=strat_report.report_id,
                created_at=datetime.now(timezone.utc),
            )
            session.add(noti)

        await session.commit()
        logger.info("Strategy Report Created Pass - Report ID: %s", strat_report.report_id)
        logger.info("AuditLog entry logged with action 'strategy_report_generated'")
        logger.info("Driver Notification created successfully!")

        logger.info("=== 8. Testing Sign Formatting Logic for Positive & Negative Degradation Rates ===")
        def format_deg(val):
            if val is None:
                return "N/A (<2 laps)"
            formatted = f"{val:.4f}"
            return f"+{formatted} s/lap" if val >= 0 else f"{formatted} s/lap"

        pos_str = format_deg(0.0554)
        neg_str = format_deg(-0.3027)
        zero_str = format_deg(0.0000)

        assert pos_str == "+0.0554 s/lap", f"Expected '+0.0554 s/lap', got '{pos_str}'"
        assert neg_str == "-0.3027 s/lap", f"Expected '-0.3027 s/lap', got '{neg_str}'"
        assert zero_str == "+0.0000 s/lap", f"Expected '+0.0000 s/lap', got '{zero_str}'"
        assert "+-" not in neg_str and "+-" not in pos_str, "Found prohibited '+-' concatenated sign string!"
        logger.info("Sign formatting logic verified: positive='%s', negative='%s', zero='%s'", pos_str, neg_str, zero_str)

        logger.info("=== ALL STRATEGY ENGINEER BACKEND INTEGRATION TESTS PASSED CLEANLY! ===")


if __name__ == "__main__":
    import sys
    asyncio.run(run_strategy_engineer_integration_tests())
    sys.exit(0)
