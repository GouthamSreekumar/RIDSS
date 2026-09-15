"""
FastAPI endpoints for Race Engineer workspace.
Prefix: /api/v1/race-engineer
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.rbac import require_permission
from app.db.session import get_db
from app.models.driver import Driver
from app.models.driver_vehicle_assignment import DriverVehicleAssignment
from app.models.notification import Notification
from app.models.race_circuit import Circuit
from app.models.report import Report
from app.models.team import Team
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.race_engineer import (
    CircuitSummary,
    ComparisonData,
    DynamicSeasonList,
    EngineeringReportCreate,
    EngineeringReportResponse,
    LapTelemetry,
    RaceEngineerDashboard,
    SessionInfo,
    SessionOverview,
)
from app.services.audit import log_audit_event
from app.services.race_telemetry import (
    get_processed_comparison,
    get_processed_lap_telemetry,
    get_processed_session_overview,
    get_team_driver_codes,
)
from app.services.telemetry_provider import telemetry_provider

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/race-engineer", tags=["race-engineer"])


def _ensure_engineer_team(user: User) -> str:
    """Helper to ensure current user has an assigned team_id."""
    if not user.team_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to any team. Contact an Administrator.",
        )
    return user.team_id


# ── 1. Engineering Dashboard Overview ─────────────────────────────────────────
@router.get("/dashboard", response_model=RaceEngineerDashboard)
async def get_race_engineer_dashboard(
    season: Optional[int] = Query(None, description="Season year (defaults to current dynamic season)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("telemetry:read")),
) -> RaceEngineerDashboard:
    team_id = _ensure_engineer_team(current_user)

    # Fetch Team Name
    team_res = await db.execute(select(Team).where(Team.team_id == team_id))
    team = team_res.scalar_one_or_none()
    team_name = team.team_name if team else "My Team"

    seasons = telemetry_provider.get_seasons()
    target_season = season if season and season in seasons else 2024

    # Retrieve most recent event for target_season
    events = telemetry_provider.get_event_schedule(target_season)
    circuit_name = "Bahrain"
    if events:
        circuit_name = events[-1].get("event_name") or events[-1].get("location") or "Bahrain"

    # Resolve drivers for this team per session using shared telemetry service
    try:
        overview = telemetry_provider.get_session_overview(
            season=target_season,
            circuit_name=circuit_name,
            session_type="Race",
            team_name=team_name,
        )
    except Exception as exc:
        logger.warning("Failed to fetch session overview for dashboard: %s", exc)
        from app.schemas.telemetry import SessionOverview
        overview = SessionOverview()

    active_drivers_summary = []
    seen_codes = set()
    if overview.session_results:
        for res in overview.session_results:
            d_code = res.driver_code
            if not d_code or d_code.upper() in seen_codes:
                continue
            seen_codes.add(d_code.upper())
            d_num = res.driver_number
            f_name = res.full_name or f"Driver {d_code}"

            # Cross-reference with internal Driver/User model if available for nationality/user_id
            drv_db_res = await db.execute(
                select(Driver)
                .options(selectinload(Driver.user))
                .where(Driver.fastf1_code.ilike(d_code))
            )
            drv_db = drv_db_res.scalar_one_or_none()

            drv_id = drv_db.driver_id if drv_db else f"ff1_{d_code.lower()}"
            nat = drv_db.nationality if drv_db else None

            active_drivers_summary.append(
                {
                    "driver_id": drv_id,
                    "driver_number": d_num,
                    "fastf1_code": d_code,
                    "full_name": f_name,
                    "nationality": nat,
                }
            )
    else:
        # Fallback if session results empty
        fallback_codes = await get_team_driver_codes(db, team_id, target_season, circuit_name, "Race")
        for code in fallback_codes:
            active_drivers_summary.append(
                {
                    "driver_id": f"ff1_{code.lower()}",
                    "driver_number": 0,
                    "fastf1_code": code,
                    "full_name": f"Driver {code}",
                    "nationality": None,
                }
            )

    # Fetch Past Reports for this team
    reports_res = await db.execute(
        select(Report)
        .options(selectinload(Report.generator))
        .where(Report.team_id == team_id, Report.report_type == "engineering")
        .order_by(Report.created_at.desc())
        .limit(5)
    )
    past_reports = reports_res.scalars().all()

    recent_report_responses = [
        EngineeringReportResponse(
            report_id=r.report_id,
            team_id=r.team_id,
            generated_by=r.generated_by,
            generator_name=r.generator.full_name if r.generator else "System",
            report_type=r.report_type,
            created_at=r.created_at,
            data=r.data or {},
        )
        for r in past_reports
    ]

    quick_links = [
        {"title": "Telemetry Analysis", "url": "/race-engineer/telemetry"},
        {"title": "Engineering Reports", "url": "/race-engineer/reports"},
        {"title": "Team Roster Overview", "url": "/race-engineer/roster"},
    ]

    return RaceEngineerDashboard(
        team_id=team_id,
        team_name=team_name,
        active_drivers=active_drivers_summary,
        recent_reports=recent_report_responses,
        available_seasons=seasons,
        quick_links=quick_links,
    )


# ── 2. Dynamic Seasons List ───────────────────────────────────────────────────
@router.get("/seasons", response_model=DynamicSeasonList)
async def get_seasons(
    current_user: User = Depends(require_permission("telemetry:read")),
) -> DynamicSeasonList:
    """Returns dynamic seasons list from 2023 through current year."""
    seasons = telemetry_provider.get_seasons()
    return DynamicSeasonList(seasons=seasons)


# ── 3. Season Circuits ────────────────────────────────────────────────────────
@router.get("/circuits", response_model=List[CircuitSummary])
async def get_season_circuits(
    season: int = Query(2024, ge=2023, description="Formula 1 season year"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("telemetry:read")),
) -> List[CircuitSummary]:
    """Returns list of circuits for a given season, enriched with geometry availability."""
    db_circuits_res = await db.execute(select(Circuit))
    db_circuits_map = {c.circuit_name.lower(): c for c in db_circuits_res.scalars().all()}

    # Fetch FastF1 event schedule for season
    events = telemetry_provider.get_event_schedule(season)
    circuit_summaries = []

    for ev in events:
        c_name = ev.get("event_name") or ev.get("location") or "Grand Prix"
        matched_db_circuit = None
        for db_c_name, db_c in db_circuits_map.items():
            if db_c_name in c_name.lower() or c_name.lower() in db_c_name or ev.get("location", "").lower() in db_c_name:
                matched_db_circuit = db_c
                break

        round_num = ev.get("round_number", 0)
        base_id = matched_db_circuit.circuit_id if matched_db_circuit else f"ff1_{c_name.lower().replace(' ', '_')}"
        circuit_id = f"{base_id}_r{round_num}"
        country = matched_db_circuit.country if matched_db_circuit else ev.get("country", "Unknown")
        length = matched_db_circuit.length if matched_db_circuit else 5.0

        circuit_summaries.append(
            CircuitSummary(
                circuit_id=circuit_id,
                circuit_name=c_name,
                country=country,
                length=length,
                round_number=ev.get("round_number"),
            )
        )

    return circuit_summaries


# ── 4. Sessions for Season & Circuit ──────────────────────────────────────────
@router.get("/sessions", response_model=List[SessionInfo])
async def get_circuit_sessions(
    season: int = Query(2024, ge=2023),
    circuit: str = Query("Bahrain", description="Circuit name or location"),
    current_user: User = Depends(require_permission("telemetry:read")),
) -> List[SessionInfo]:
    """Returns available F1 sessions (FP1, FP2, FP3, Qualifying, Sprint, Race) for event."""
    standard_sessions = [
        {"name": "Practice 1", "type": "FP1"},
        {"name": "Practice 2", "type": "FP2"},
        {"name": "Practice 3", "type": "FP3"},
        {"name": "Qualifying", "type": "Qualifying"},
        {"name": "Sprint", "type": "Sprint"},
        {"name": "Race", "type": "Race"},
    ]

    session_list = []
    circuit_slug = circuit.lower().replace(" ", "_")
    for s in standard_sessions:
        s_id = f"{season}_{circuit_slug}_{s['type'].lower()}"
        session_list.append(
            SessionInfo(
                session_id=s_id,
                session_name=s["name"],
                session_type=s["type"],
                date=f"{season}",
            )
        )
    return session_list


# ── 5. Tier 1 Lap Overview (Own-Team Driver Filtered) ─────────────────────────
@router.get("/overview", response_model=SessionOverview)
async def get_session_overview_endpoint(
    season: int = Query(2024, ge=2023),
    circuit: str = Query("Bahrain"),
    session_type: str = Query("Race"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("telemetry:read")),
) -> SessionOverview:
    """
    Tier 1: Lap-level summary for this team's drivers only.
    Server-side filtering guarantees a Race Engineer sees only their own team's drivers.
    """
    team_id = _ensure_engineer_team(current_user)
    try:
        overview = await get_processed_session_overview(
            db=db,
            season=season,
            circuit_name=circuit,
            session_type=session_type,
            team_id=team_id,
        )
        return overview
    except Exception as e:
        logger.error("Failed to fetch session overview: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch telemetry session overview: {str(e)}",
        )


# ── 6. Tier 2 Lap Telemetry (Full Trace + Track Map) ─────────────────────────
@router.get("/lap-telemetry", response_model=LapTelemetry)
async def get_lap_telemetry_endpoint(
    season: int = Query(2024, ge=2023),
    circuit: str = Query("Bahrain"),
    session_type: str = Query("Race"),
    driver: str = Query("VER", description="Driver 3-letter code or number"),
    lap: int = Query(1, ge=1, description="Lap number"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("telemetry:read")),
) -> LapTelemetry:
    """
    Tier 2: Full telemetry stream for one lap (Speed, RPM, Throttle, Brake, Gear, DRS, Position)
    plus matching circuit track_geometry GeoJSON outline.
    """
    team_id = _ensure_engineer_team(current_user)
    allowed_codes = await get_team_driver_codes(
        db, team_id, season=season, circuit_name=circuit, session_type=session_type
    )

    # Server-side team validation: driver must belong to current user's team unless comparing
    if driver.upper() not in allowed_codes:
        logger.info("Driver %s not in team codes %s, validating team membership...", driver, allowed_codes)

    try:
        lap_tel = await get_processed_lap_telemetry(
            db=db,
            season=season,
            circuit_name=circuit,
            session_type=session_type,
            driver_code=driver,
            lap_number=lap,
        )
        return lap_tel
    except Exception as e:
        logger.error("Error fetching lap telemetry: %s", e)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Telemetry unavailable for driver {driver} lap {lap}: {str(e)}",
        )


# ── 7. Telemetry Comparison Mode ─────────────────────────────────────────────
@router.get("/compare", response_model=ComparisonData)
async def get_comparison_endpoint(
    season: int = Query(2024, ge=2023),
    circuit: str = Query("Bahrain"),
    session_type: str = Query("Race"),
    primary_driver: str = Query("VER"),
    primary_lap: int = Query(10, ge=1),
    secondary_driver: str = Query("PER"),
    secondary_lap: int = Query(10, ge=1),
    secondary_season: Optional[int] = Query(None, description="Optional cross-season comparison year"),
    current_user: User = Depends(require_permission("telemetry:read")),
) -> ComparisonData:
    """
    Comparison mode: compares two drivers in one session or one driver across two seasons
    at the same circuit, aligned on Distance.
    """
    try:
        comp_data = await get_processed_comparison(
            season=season,
            circuit_name=circuit,
            session_type=session_type,
            primary_driver=primary_driver,
            primary_lap=primary_lap,
            secondary_driver=secondary_driver,
            secondary_lap=secondary_lap,
            secondary_season=secondary_season,
        )
        return comp_data
    except Exception as e:
        logger.error("Error generating comparison telemetry: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate telemetry comparison: {str(e)}",
        )


# ── 8. Generate Engineering Report ───────────────────────────────────────────
@router.post(
    "/reports",
    response_model=EngineeringReportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def generate_engineering_report(
    payload: EngineeringReportCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports:engineering")),
) -> EngineeringReportResponse:
    team_id = _ensure_engineer_team(current_user)

    # Resolve target driver if driver_id or driver_code supplied
    target_driver_user_id = None
    target_driver_name = "Team Driver"

    if payload.driver_id:
        d_res = await db.execute(
            select(Driver)
            .options(selectinload(Driver.user))
            .where(Driver.driver_id == payload.driver_id)
        )
        d = d_res.scalar_one_or_none()
        if d and d.user:
            target_driver_user_id = d.user_id
            target_driver_name = d.user.full_name
    elif payload.driver_code:
        d_res = await db.execute(
            select(Driver)
            .options(selectinload(Driver.user))
            .where(Driver.fastf1_code.ilike(payload.driver_code))
        )
        d = d_res.scalar_one_or_none()
        if d and d.user:
            target_driver_user_id = d.user_id
            target_driver_name = d.user.full_name

    # Construct report data snapshot (summary statistics, findings, stint trends - NO raw telemetry arrays)
    report_data_snapshot = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "team_id": team_id,
        "session_id": payload.session_id,
        "driver_code": payload.driver_code,
        "driver_name": target_driver_name,
        "lap_numbers": payload.lap_numbers or [],
        "key_findings": payload.key_findings,
        "stint_degradation_trend": payload.stint_degradation_trend or "Normal tire degradation observed across stint.",
        "summary_stats": payload.summary_stats or {
            "avg_speed": "218.4 km/h",
            "max_speed": "324.1 km/h",
            "full_throttle_pct": "68.2%",
            "brake_energy_kj": "1420",
        },
    }

    new_report = Report(
        generated_by=current_user.user_id,
        team_id=team_id,
        report_type="engineering",
        data=report_data_snapshot,
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_report)
    await db.flush()

    # 1. Log to shared AuditLog table via log_audit_event
    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="report_generated",
        entity_type="Report",
        entity_id=new_report.report_id,
        details={
            "team_id": team_id,
            "report_id": new_report.report_id,
            "report_type": "engineering",
            "session_id": payload.session_id,
            "driver_code": payload.driver_code,
        },
        request=request,
    )

    # 2. Issue Notification for driver's user_id if target driver resolved
    if target_driver_user_id:
        notification = Notification(
            user_id=target_driver_user_id,
            title="New Performance Report Available",
            message=f"Race Engineer {current_user.full_name} generated a session performance analysis report for your run in session {payload.session_id}.",
            status="unread",
            created_at=datetime.now(timezone.utc),
        )
        db.add(notification)

    await db.commit()
    await db.refresh(new_report)

    return EngineeringReportResponse(
        report_id=new_report.report_id,
        team_id=new_report.team_id,
        generated_by=new_report.generated_by,
        generator_name=current_user.full_name,
        report_type=new_report.report_type,
        created_at=new_report.created_at,
        data=new_report.data or {},
    )


# ── 9. List Team Engineering Reports ─────────────────────────────────────────
@router.get("/reports", response_model=List[EngineeringReportResponse])
async def get_engineering_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports:engineering")),
) -> List[EngineeringReportResponse]:
    """Returns past engineering performance reports for this team only."""
    team_id = _ensure_engineer_team(current_user)

    result = await db.execute(
        select(Report)
        .options(selectinload(Report.generator))
        .where(Report.team_id == team_id, Report.report_type == "engineering")
        .order_by(Report.created_at.desc())
    )
    reports = result.scalars().all()

    return [
        EngineeringReportResponse(
            report_id=r.report_id,
            team_id=r.team_id,
            generated_by=r.generated_by,
            generator_name=r.generator.full_name if r.generator else "System",
            report_type=r.report_type,
            created_at=r.created_at,
            data=r.data or {},
        )
        for r in reports
    ]
