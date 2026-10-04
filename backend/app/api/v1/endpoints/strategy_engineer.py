"""
FastAPI endpoints for Strategy Engineer workspace.
Prefix: /api/v1/strategy-engineer
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
from app.models.notification import Notification
from app.models.race_strategy import RaceStrategy
from app.models.report import Report
from app.models.team import Team
from app.models.user import User
from app.schemas.strategy_engineer import (
    HistoricalStrategyReviewResponse,
    PitRecommendationResponse,
    RaceStrategyCreate,
    RaceStrategyResponse,
    StrategyEngineerDashboard,
    StrategyReportCreate,
    StrategyReportResponse,
    TireAnalysisResponse,
)
from app.services.audit import log_audit_event
from app.services.race_telemetry import (
    get_processed_session_overview,
    get_team_driver_codes,
)
from app.services.strategy_analysis import (
    calculate_tire_degradation_for_laps,
    estimate_pit_window,
    get_circuit_pit_loss,
    summarize_historical_cross_season,
)
from app.services.telemetry_provider import telemetry_provider

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/strategy-engineer", tags=["strategy-engineer"])


def _ensure_strategy_team(user: User) -> str:
    """Helper to ensure current user has an assigned team_id."""
    if not user.team_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to any team. Contact an Administrator.",
        )
    return user.team_id


def _parse_session_slug(session_id: str) -> tuple[int, str, str]:
    """Parses session_id slug e.g. '2024_monaco_race' into season, circuit_name, session_type."""
    parts = session_id.split("_")
    target_season = 2024
    target_circuit = "Bahrain"
    target_session_type = "Race"

    if len(parts) >= 3:
        try:
            target_season = int(parts[0])
        except ValueError:
            target_season = 2024
        target_circuit = parts[1].replace("_", " ").title()
        target_session_type = parts[2].title()
    elif len(parts) == 2:
        try:
            target_season = int(parts[0])
        except ValueError:
            target_season = 2024
        target_circuit = parts[1].replace("_", " ").title()

    return target_season, target_circuit, target_session_type


# ── 1. Strategy Dashboard ─────────────────────────────────────────────────────
@router.get("/dashboard", response_model=StrategyEngineerDashboard)
async def get_strategy_engineer_dashboard(
    season: Optional[int] = Query(None, description="Season year"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("strategy:read")),
) -> StrategyEngineerDashboard:
    team_id = _ensure_strategy_team(current_user)

    team_res = await db.execute(select(Team).where(Team.team_id == team_id))
    team = team_res.scalar_one_or_none()
    team_name = team.team_name if team else "My Team"

    seasons = telemetry_provider.get_seasons()
    target_season = season if season and season in seasons else (seasons[-1] if seasons else 2024)

    # Fetch active drivers for team
    driver_codes = await get_team_driver_codes(db, team_id=team_id, season=target_season, circuit_name="Bahrain", session_type="Race")
    active_drivers_summary = []
    for code in driver_codes:
        drv_db_res = await db.execute(
            select(Driver)
            .options(selectinload(Driver.user))
            .where(Driver.fastf1_code.ilike(code))
        )
        drv_db = drv_db_res.scalar_one_or_none()
        active_drivers_summary.append({
            "driver_id": drv_db.driver_id if drv_db else f"ff1_{code.lower()}",
            "driver_number": drv_db.driver_number if drv_db else 0,
            "fastf1_code": code,
            "full_name": drv_db.user.full_name if (drv_db and drv_db.user) else f"Driver {code}",
        })

    # Fetch recent strategy plans for this team
    strat_res = await db.execute(
        select(RaceStrategy)
        .options(selectinload(RaceStrategy.creator))
        .where(RaceStrategy.team_id == team_id)
        .order_by(RaceStrategy.created_at.desc())
        .limit(5)
    )
    strategies_db = strat_res.scalars().all()
    recent_strategies = [
        RaceStrategyResponse(
            id=s.id,
            team_id=s.team_id,
            session_id=s.session_id,
            created_by=s.created_by,
            creator_name=s.creator.full_name if s.creator else "Strategy Engineer",
            title=s.plan.get("title") if isinstance(s.plan, dict) else None,
            driver_code=s.plan.get("driver_code") if isinstance(s.plan, dict) else None,
            plan=s.plan.get("stints", []) if isinstance(s.plan, dict) else (s.plan if isinstance(s.plan, list) else []),
            created_at=s.created_at,
        )
        for s in strategies_db
    ]

    # Fetch recent strategy reports for this team
    rep_res = await db.execute(
        select(Report)
        .options(selectinload(Report.generator))
        .where(Report.team_id == team_id, Report.report_type == "strategy")
        .order_by(Report.created_at.desc())
        .limit(5)
    )
    reports_db = rep_res.scalars().all()
    recent_reports = [
        StrategyReportResponse(
            report_id=r.report_id,
            team_id=r.team_id,
            generated_by=r.generated_by,
            generator_name=r.generator.full_name if r.generator else "System",
            report_type=r.report_type,
            created_at=r.created_at,
            data=r.data or {},
        )
        for r in reports_db
    ]

    quick_links = [
        {"title": "Tire Degradation Analysis", "url": "/strategy-engineer/tire-analysis"},
        {"title": "Race Strategy Plans", "url": "/strategy-engineer/strategies"},
        {"title": "Historical Cross-Season Review", "url": "/strategy-engineer/historical"},
        {"title": "Strategy Reports", "url": "/strategy-engineer/reports"},
    ]

    return StrategyEngineerDashboard(
        team_id=team_id,
        team_name=team_name,
        active_drivers=active_drivers_summary,
        recent_strategies=recent_strategies,
        recent_reports=recent_reports,
        available_seasons=seasons,
        quick_links=quick_links,
    )


# ── 2. Tire Degradation Analysis ──────────────────────────────────────────────
@router.get("/tire-analysis", response_model=TireAnalysisResponse)
async def get_tire_analysis(
    session_id: str = Query("2024_bahrain_race", description="Session slug e.g. 2024_bahrain_race"),
    driver: str = Query("VER", description="Driver code e.g. VER"),
    season: Optional[int] = Query(None),
    circuit: Optional[str] = Query(None),
    session_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("strategy:read")),
) -> TireAnalysisResponse:
    """
    1. Tire Analysis — calculate_tire_degradation():
    Consumes processed lap summaries exposed by Race Engineer service layer.
    Fits simple linear trend of LapTime vs TyreLife per stint, excluding deleted & SC/VSC caution laps.
    """
    team_id = _ensure_strategy_team(current_user)

    target_season, target_circuit, target_session_type = _parse_session_slug(session_id)
    if season:
        target_season = season
    if circuit:
        target_circuit = circuit
    if session_type:
        target_session_type = session_type

    # CRITICAL BOUNDARY REUSE: Call Race Engineer's processed session service function
    overview = await get_processed_session_overview(
        db=db,
        season=target_season,
        circuit_name=target_circuit,
        session_type=target_session_type,
        team_id=team_id,
    )

    driver_code_upper = driver.upper()
    driver_laps = overview.driver_lap_summaries.get(driver_code_upper, [])

    if not driver_laps:
        # Fallback search case-insensitively
        for k, v in overview.driver_lap_summaries.items():
            if k.upper() == driver_code_upper:
                driver_laps = v
                driver_code_upper = k
                break

    session_info = {
        "session_id": overview.session_id,
        "season": overview.season,
        "circuit_name": overview.circuit_name,
        "session_type": target_session_type,
    }

    result = calculate_tire_degradation_for_laps(driver_laps, driver_code_upper, session_info)
    return result


# ── 3. Pit Stop Recommendations ───────────────────────────────────────────────
@router.get("/pit-recommendation", response_model=PitRecommendationResponse)
async def get_pit_recommendation(
    session_id: str = Query("2024_bahrain_race"),
    driver: str = Query("VER"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("strategy:read")),
) -> PitRecommendationResponse:
    """
    2. Pit stop recommendations — estimate_pit_window():
    Deterministic rule comparing stint degradation vs alternate compound pace,
    accounting for configurable per-circuit pit loss constant from SystemSettings.
    """
    team_id = _ensure_strategy_team(current_user)
    target_season, target_circuit, target_session_type = _parse_session_slug(session_id)

    # Fetch processed overview
    overview = await get_processed_session_overview(
        db=db,
        season=target_season,
        circuit_name=target_circuit,
        session_type=target_session_type,
        team_id=team_id,
    )

    # Calculate tire degradation for target driver
    driver_laps = overview.driver_lap_summaries.get(driver.upper(), [])
    session_info = {
        "session_id": overview.session_id,
        "season": overview.season,
        "circuit_name": overview.circuit_name,
        "session_type": target_session_type,
    }
    target_analysis = calculate_tire_degradation_for_laps(driver_laps, driver.upper(), session_info)

    # Extract all team driver stints in session for alternate compound pace evaluation
    all_team_stints = []
    for d_code, laps in overview.driver_lap_summaries.items():
        d_analysis = calculate_tire_degradation_for_laps(laps, d_code, session_info)
        all_team_stints.extend(d_analysis.stints)

    # Fetch circuit pit stop time loss constant from SystemSettings
    pit_loss = await get_circuit_pit_loss(db, overview.circuit_name)

    rec = estimate_pit_window(
        stint_analysis=target_analysis,
        all_team_stints=all_team_stints,
        pit_loss_seconds=pit_loss,
        total_laps=overview.total_laps or 57,
    )
    return rec


# ── 4. Historical Cross-Season Review ─────────────────────────────────────────
@router.get("/historical", response_model=HistoricalStrategyReviewResponse)
async def get_historical_strategy_review(
    circuit: str = Query("Bahrain", description="Circuit name e.g. Monaco or Bahrain"),
    seasons: Optional[str] = Query(None, description="Comma-separated seasons e.g. 2023,2024"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("strategy:read")),
) -> HistoricalStrategyReviewResponse:
    """
    3. Review historical race data across multiple seasons at a given circuit.
    Reuses Race Engineer's processed data service across seasons for own-team drivers.
    """
    team_id = _ensure_strategy_team(current_user)

    available = telemetry_provider.get_seasons()
    target_seasons: List[int] = []

    if seasons:
        for s in seasons.split(","):
            try:
                val = int(s.strip())
                if val in available:
                    target_seasons.append(val)
            except ValueError:
                pass

    if not target_seasons:
        target_seasons = available[-3:] if len(available) >= 3 else available

    overviews: List[Any] = []
    for s in target_seasons:
        try:
            ov = await get_processed_session_overview(
                db=db,
                season=s,
                circuit_name=circuit,
                session_type="Race",
                team_id=team_id,
            )
            overviews.append(ov)
        except Exception as exc:
            logger.warning("Failed to fetch historical session overview for season %s circuit %s: %s", s, circuit, exc)

    review = summarize_historical_cross_season(circuit, target_seasons, overviews)
    return review


# ── 5. Create & View Race Strategies ──────────────────────────────────────────
@router.post("/strategies", response_model=RaceStrategyResponse, status_code=status.HTTP_201_CREATED)
async def create_race_strategy(
    payload: RaceStrategyCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("strategy:create")),
) -> RaceStrategyResponse:
    """
    4. Create Race Strategy:
    Strategy Engineer composes a stint-by-stint plan for an upcoming session.
    Stored in RaceStrategy table with audit logging.
    """
    team_id = _ensure_strategy_team(current_user)

    plan_data = {
        "title": payload.title or f"Strategy Plan for {payload.session_id}",
        "driver_code": payload.driver_code,
        "stints": [s.model_dump() for s in payload.plan],
    }

    new_strategy = RaceStrategy(
        team_id=team_id,
        session_id=payload.session_id,
        created_by=current_user.user_id,
        plan=plan_data,
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_strategy)
    await db.flush()

    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="strategy_created",
        entity_type="RaceStrategy",
        entity_id=new_strategy.id,
        details={
            "team_id": team_id,
            "strategy_id": new_strategy.id,
            "session_id": payload.session_id,
            "driver_code": payload.driver_code,
            "stints_count": len(payload.plan),
        },
        request=request,
    )

    await db.commit()
    await db.refresh(new_strategy)

    return RaceStrategyResponse(
        id=new_strategy.id,
        team_id=new_strategy.team_id,
        session_id=new_strategy.session_id,
        created_by=new_strategy.created_by,
        creator_name=current_user.full_name,
        title=plan_data.get("title"),
        driver_code=plan_data.get("driver_code"),
        plan=[StintPlan(**s) for s in plan_data.get("stints", [])],
        created_at=new_strategy.created_at,
    )


@router.get("/strategies", response_model=List[RaceStrategyResponse])
async def get_race_strategies(
    session_id: Optional[str] = Query(None, description="Optional session filter"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("strategy:read")),
) -> List[RaceStrategyResponse]:
    """View race strategies for current team."""
    team_id = _ensure_strategy_team(current_user)

    query = (
        select(RaceStrategy)
        .options(selectinload(RaceStrategy.creator))
        .where(RaceStrategy.team_id == team_id)
    )
    if session_id:
        query = query.where(RaceStrategy.session_id == session_id)

    query = query.order_by(RaceStrategy.created_at.desc())

    result = await db.execute(query)
    strategies = result.scalars().all()

    return [
        RaceStrategyResponse(
            id=s.id,
            team_id=s.team_id,
            session_id=s.session_id,
            created_by=s.created_by,
            creator_name=s.creator.full_name if s.creator else "Strategy Engineer",
            title=s.plan.get("title") if isinstance(s.plan, dict) else None,
            driver_code=s.plan.get("driver_code") if isinstance(s.plan, dict) else None,
            plan=[StintPlan(**sp) for sp in s.plan.get("stints", [])] if isinstance(s.plan, dict) and "stints" in s.plan else [],
            created_at=s.created_at,
        )
        for s in strategies
    ]


# ── 6. Strategy Reports ───────────────────────────────────────────────────────
@router.post("/reports", response_model=StrategyReportResponse, status_code=status.HTTP_201_CREATED)
async def generate_strategy_report(
    payload: StrategyReportCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports:strategy")),
) -> StrategyReportResponse:
    """
    5. Strategy Reports — generate_strategy_report():
    Saves strategy analysis summary into existing Report.data JSONB with report_type = "strategy".
    Writes AuditLog entry ("strategy_report_generated") and Notification to relevant driver.
    """
    team_id = _ensure_strategy_team(current_user)

    target_driver_user_id = None
    target_driver_name = "Team Driver"

    if payload.driver_id:
        d_res = await db.execute(
            select(Driver).options(selectinload(Driver.user)).where(Driver.driver_id == payload.driver_id)
        )
        d = d_res.scalar_one_or_none()
        if d and d.user:
            target_driver_user_id = d.user_id
            target_driver_name = d.user.full_name
    elif payload.driver_code:
        d_res = await db.execute(
            select(Driver).options(selectinload(Driver.user)).where(Driver.fastf1_code.ilike(payload.driver_code))
        )
        d = d_res.scalar_one_or_none()
        if d and d.user:
            target_driver_user_id = d.user_id
            target_driver_name = d.user.full_name

    report_data_snapshot = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "team_id": team_id,
        "session_id": payload.session_id,
        "driver_code": payload.driver_code,
        "driver_name": target_driver_name,
        "target_driver_user_id": target_driver_user_id,
        "tire_degradation_summary": payload.tire_degradation_summary,
        "pit_window_reasoning": payload.pit_window_reasoning,
        "strategy_plan_id": payload.strategy_plan_id,
        "key_findings": payload.key_findings,
        "custom_data": payload.custom_data or {},
    }

    new_report = Report(
        generated_by=current_user.user_id,
        team_id=team_id,
        report_type="strategy",
        data=report_data_snapshot,
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_report)
    await db.flush()

    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="strategy_report_generated",
        entity_type="Report",
        entity_id=new_report.report_id,
        details={
            "team_id": team_id,
            "report_id": new_report.report_id,
            "report_type": "strategy",
            "session_id": payload.session_id,
            "driver_code": payload.driver_code,
        },
        request=request,
    )

    if target_driver_user_id:
        notification = Notification(
            user_id=target_driver_user_id,
            title="New Race Strategy Report Available",
            message=f"Strategy Engineer {current_user.full_name} generated a race strategy analysis report for session {payload.session_id}.",
            status="unread",
            reference_type="report",
            reference_id=new_report.report_id,
            created_at=datetime.now(timezone.utc),
        )
        db.add(notification)

    await db.commit()
    await db.refresh(new_report)

    return StrategyReportResponse(
        report_id=new_report.report_id,
        team_id=new_report.team_id,
        generated_by=new_report.generated_by,
        generator_name=current_user.full_name,
        report_type=new_report.report_type,
        created_at=new_report.created_at,
        data=new_report.data or {},
    )


@router.get("/reports", response_model=List[StrategyReportResponse])
async def get_strategy_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports:strategy")),
) -> List[StrategyReportResponse]:
    """Returns past strategy reports for current team only."""
    team_id = _ensure_strategy_team(current_user)

    result = await db.execute(
        select(Report)
        .options(selectinload(Report.generator))
        .where(Report.team_id == team_id, Report.report_type == "strategy")
        .order_by(Report.created_at.desc())
    )
    reports = result.scalars().all()

    return [
        StrategyReportResponse(
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
