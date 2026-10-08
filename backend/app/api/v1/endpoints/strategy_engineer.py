"""
FastAPI endpoints for Strategy Engineer workspace.
Prefix: /api/v1/strategy-engineer

RIDSS Phase 1 scope: pre-race planning and post-race analysis only.
There is no live timing feed in Phase 1. All session data is sourced from the
FastF1 historical dataset via the Race Engineer service layer.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import pandas as pd
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
    EventDriversResponse,
    EventDriverEntry,
    HistoricalStrategyReviewResponse,
    PreRacePlanningReference,
    RaceStrategyCreate,
    RaceStrategyResponse,
    StintPlan,
    StrategyComparisonResponse,
    StrategyEngineerDashboard,
    StrategyReportCreate,
    StrategyReportResponse,
    TireAnalysisResponse,
    UpcomingEvent,
    UpcomingEventsResponse,
)
from app.services.audit import log_audit_event
from app.services.race_telemetry import (
    get_processed_session_overview,
    get_team_driver_codes,
    get_team_name_by_id,
)
from app.services.strategy_analysis import (
    build_pre_race_planning_reference,
    calculate_tire_degradation_for_laps,
    compare_race_strategies,
    get_circuit_pit_loss,
    summarize_historical_cross_season,
)
from app.services.telemetry_provider import telemetry_provider

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/strategy-engineer", tags=["strategy-engineer"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ensure_strategy_team(user: User) -> str:
    """Ensure current user has an assigned team_id."""
    if not user.team_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to any team. Contact an Administrator.",
        )
    return user.team_id


def _current_season() -> int:
    """Dynamically returns the current season year, consistent with the rest of RIDSS."""
    return datetime.now(timezone.utc).year


def _is_upcoming(event_date_str: Optional[str]) -> bool:
    """
    Returns True if `event_date_str` is today or in the future (UTC).
    Reuses the same date-comparison logic as the Team Manager Race Calendar.
    """
    if not event_date_str:
        return False
    try:
        dt = pd.to_datetime(event_date_str)
        if dt.tz is None:
            dt = dt.tz_localize("UTC")
        else:
            dt = dt.tz_convert("UTC")
        now_utc = datetime.now(timezone.utc)
        # "today or later": compare date portion only to avoid timezone edge-cases at midnight
        return dt.date() >= now_utc.date()
    except Exception:
        return False


async def _get_upcoming_events_list(season: int) -> List[Dict[str, Any]]:
    """
    Returns race events in `season` whose race date is today or later.
    Excludes testing events. Uses the shared FastF1 event schedule.
    """
    schedule = telemetry_provider.get_event_schedule(season)
    upcoming = []
    for ev in schedule:
        if not _is_upcoming(ev.get("event_date")):
            continue
        # get_event_schedule already excludes testing rounds (round_number <= 0 / format == "testing")
        upcoming.append(ev)
    return upcoming


def _build_strategy_response(s: RaceStrategy, creator_name: str) -> RaceStrategyResponse:
    """Convert a RaceStrategy ORM row to its Pydantic response, flagging legacy rows."""
    is_legacy = s.season is None or s.round is None
    plan_raw = s.plan or {}
    if isinstance(plan_raw, dict):
        stints_raw = plan_raw.get("stints", [])
        title = plan_raw.get("title")
        driver_code = plan_raw.get("driver_code")
    elif isinstance(plan_raw, list):
        stints_raw = plan_raw
        title = None
        driver_code = None
    else:
        stints_raw = []
        title = None
        driver_code = None

    try:
        stints = [StintPlan(**sp) for sp in stints_raw]
    except Exception:
        stints = []

    return RaceStrategyResponse(
        id=s.id,
        team_id=s.team_id,
        session_id=s.session_id,
        season=s.season,
        round=s.round,
        created_by=s.created_by,
        creator_name=creator_name,
        title=title,
        driver_code=driver_code,
        plan=stints,
        created_at=s.created_at,
        is_legacy=is_legacy,
    )


# ── 1. Strategy Dashboard ─────────────────────────────────────────────────────
@router.get("/dashboard", response_model=StrategyEngineerDashboard)
async def get_strategy_engineer_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("strategy:read")),
) -> StrategyEngineerDashboard:
    team_id = _ensure_strategy_team(current_user)

    team_res = await db.execute(select(Team).where(Team.team_id == team_id))
    team = team_res.scalar_one_or_none()
    team_name = team.team_name if team else "My Team"

    season = _current_season()
    driver_codes = await get_team_driver_codes(
        db, team_id=team_id, season=season, circuit_name="Bahrain", session_type="Race"
    )
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

    strat_res = await db.execute(
        select(RaceStrategy)
        .options(selectinload(RaceStrategy.creator))
        .where(RaceStrategy.team_id == team_id)
        .order_by(RaceStrategy.created_at.desc())
        .limit(5)
    )
    strategies_db = strat_res.scalars().all()
    recent_strategies = [
        _build_strategy_response(s, s.creator.full_name if s.creator else "Strategy Engineer")
        for s in strategies_db
    ]

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
        {"title": "Historical Circuit Review", "url": "/strategy-engineer/historical"},
        {"title": "Strategy Reports", "url": "/strategy-engineer/reports"},
    ]

    return StrategyEngineerDashboard(
        team_id=team_id,
        team_name=team_name,
        active_drivers=active_drivers_summary,
        recent_strategies=recent_strategies,
        recent_reports=recent_reports,
        available_seasons=telemetry_provider.get_seasons(),
        quick_links=quick_links,
    )


# ── 2. Upcoming Events ────────────────────────────────────────────────────────
@router.get("/upcoming-events", response_model=UpcomingEventsResponse)
async def get_upcoming_events(
    current_user: User = Depends(require_permission("strategy:read")),
) -> UpcomingEventsResponse:
    """
    Returns upcoming race events for strategy planning.

    1. Checks current season. Returns race events whose race date is today or later.
    2. If no events remain in current season, attempts fallback to next season when FastF1's
       schedule for next season is available. Labels each event with its season ("2027 season – Round 1 ...").
    3. If current season is complete and next season's schedule is unavailable, returns an empty list
       with reason_code="SEASON_COMPLETE_NEXT_UNAVAILABLE" and a descriptive message.
    """
    current_season = _current_season()
    raw_events = await _get_upcoming_events_list(current_season)

    if raw_events:
        events = [
            UpcomingEvent(
                round=ev["round_number"],
                event_name=ev["event_name"],
                circuit=ev.get("location", ev["event_name"]),
                country=ev.get("country", ""),
                race_date=ev.get("event_date"),
                season=current_season,
                label=f"Round {ev['round_number']}: {ev['event_name']} ({ev.get('location', ev['event_name'])})",
            )
            for ev in raw_events
        ]
        return UpcomingEventsResponse(season=current_season, events=events, is_fallback_season=False)

    # Fallback to next season if current season has no remaining events
    next_season = current_season + 1
    try:
        next_raw_events = await _get_upcoming_events_list(next_season)
    except Exception as exc:
        logger.warning("Could not load next season schedule for %s: %s", next_season, exc)
        next_raw_events = []

    if next_raw_events:
        events = [
            UpcomingEvent(
                round=ev["round_number"],
                event_name=ev["event_name"],
                circuit=ev.get("location", ev["event_name"]),
                country=ev.get("country", ""),
                race_date=ev.get("event_date"),
                season=next_season,
                label=f"{next_season} season – Round {ev['round_number']}: {ev['event_name']} ({ev.get('location', ev['event_name'])})",
            )
            for ev in next_raw_events
        ]
        return UpcomingEventsResponse(season=next_season, events=events, is_fallback_season=True)

    # Empty state when current season is complete and next season schedule is not available
    return UpcomingEventsResponse(
        season=current_season,
        events=[],
        is_fallback_season=False,
        reason_code="SEASON_COMPLETE_NEXT_UNAVAILABLE",
        message=f"No upcoming events: the {current_season} season is complete and next season's schedule isn't published yet.",
    )


# ── 3. Upcoming Event Drivers ─────────────────────────────────────────────────
@router.get("/upcoming-events/{round}/drivers", response_model=EventDriversResponse)
async def get_event_drivers(
    round: int,
    season: Optional[int] = Query(None, description="Optional target event season"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("strategy:read")),
) -> EventDriversResponse:
    """
    Returns the team's driver roster for a selected upcoming event round.

    If season is specified (e.g. for next season events), uses that season.
    For next-season events (or when current season is complete), derives the roster from
    the previous season's final race and labels it ("Roster based on [event], [season]").
    """
    team_id = _ensure_strategy_team(current_user)
    team_name = await get_team_name_by_id(db, team_id)
    if not team_name:
        raise HTTPException(status_code=400, detail="Could not resolve team name.")

    current_season = _current_season()
    target_season = season if season is not None else current_season
    all_events = telemetry_provider.get_event_schedule(target_season)

    target_event_name = f"Round {round}"
    for ev in all_events:
        if ev.get("round_number") == round:
            target_event_name = ev.get("event_name", target_event_name)
            break

    search_seasons = [target_season, target_season - 1, current_season - 1]

    roster_basis_event: Optional[str] = None
    roster_basis_season: Optional[int] = None
    driver_codes: List[str] = []

    async def _try_load(s_yr: int, circuit: str) -> List[str]:
        try:
            overview = await asyncio.to_thread(
                telemetry_provider.get_session_overview,
                s_yr, circuit, "Race", None, team_name
            )
            codes = []
            if overview.session_results:
                codes = [r.driver_code.upper() for r in overview.session_results if r.driver_code]
            return codes
        except Exception as exc:
            logger.warning("Could not load roster from %s %s season %s: %s", circuit, s_yr, s_yr, exc)
            return []

    for s_yr in search_seasons:
        if driver_codes:
            break
        ev_sched = telemetry_provider.get_event_schedule(s_yr)
        completed = [
            ev for ev in ev_sched
            if ev.get("round_number", 0) > 0 and not _is_upcoming(ev.get("event_date"))
        ]
        completed_sorted = sorted(completed, key=lambda e: e.get("round_number", 0), reverse=True)
        if completed_sorted:
            latest = completed_sorted[0]
            circuit = latest.get("location") or latest.get("event_name", "")
            codes = await _try_load(s_yr, circuit)
            if codes:
                driver_codes = codes
                roster_basis_event = latest.get("event_name", circuit)
                roster_basis_season = s_yr

    drivers = [EventDriverEntry(driver_code=code) for code in driver_codes]

    return EventDriversResponse(
        season=target_season,
        round=round,
        event_name=target_event_name,
        drivers=drivers,
        roster_basis_event=(
            f"Roster based on {roster_basis_event}, {roster_basis_season}"
            if roster_basis_event else None
        ),
        roster_basis_season=roster_basis_season,
    )


# ── 4. Pre-race Planning Reference ───────────────────────────────────────────
@router.get("/upcoming-events/{round}/planning-reference", response_model=PreRacePlanningReference)
async def get_planning_reference(
    round: int,
    season: Optional[int] = Query(None, description="Optional target event season"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("strategy:read")),
) -> PreRacePlanningReference:
    """
    Returns per-compound planning guidance for the selected upcoming event.
    Accepts optional season query parameter.
    """
    team_id = _ensure_strategy_team(current_user)
    current_season = _current_season()
    target_season = season if season is not None else current_season
    all_events = telemetry_provider.get_event_schedule(target_season)

    event_name = f"Round {round}"
    circuit = "Unknown"
    for ev in all_events:
        if ev.get("round_number") == round:
            event_name = ev.get("event_name", event_name)
            circuit = ev.get("location") or ev.get("event_name", circuit)
            break

    # Pit loss for this circuit
    pit_loss = await get_circuit_pit_loss(db, circuit)

    # Historical data: most recent 3 seasons at this circuit prior to target_season
    available_seasons = telemetry_provider.get_seasons()
    past_seasons = [s for s in available_seasons if s < target_season][-3:]
    if not past_seasons:
        past_seasons = [s for s in available_seasons if s <= target_season][-3:]

    overviews = []
    for s in past_seasons:
        try:
            ov = await get_processed_session_overview(
                db=db, season=s, circuit_name=circuit, session_type="Race", team_id=team_id
            )
            overviews.append(ov)
        except Exception as exc:
            logger.warning("Could not load historical overview for %s %s: %s", circuit, s, exc)

    historical_review = summarize_historical_cross_season(circuit, past_seasons, overviews)

    # Default lap count: from most recent historical edition
    default_total_laps = 57
    if overviews:
        most_recent = overviews[-1]
        if most_recent.total_laps and most_recent.total_laps > 0:
            try:
                max_driver_laps = max(
                    len(laps) for laps in most_recent.driver_lap_summaries.values()
                ) if most_recent.driver_lap_summaries else 0
                if max_driver_laps > 0:
                    default_total_laps = max_driver_laps
            except Exception:
                pass

    ref = build_pre_race_planning_reference(
        event_name=event_name,
        circuit_name=circuit,
        season=target_season,
        round_number=round,
        pit_loss_seconds=pit_loss,
        default_total_laps=default_total_laps,
        historical_review=historical_review,
    )
    return ref


# ── 5. Tire Degradation Analysis (post-race / historical) ────────────────────
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
    Tire degradation analysis for a completed session.
    Fits a linear trend (OLS) of LapTime vs TyreLife per stint, excluding
    deleted laps and Safety Car / VSC / Yellow Flag periods.
    """
    team_id = _ensure_strategy_team(current_user)

    parts = session_id.split("_")
    target_season = int(parts[0]) if parts and parts[0].isdigit() else 2024
    target_circuit = parts[1].title() if len(parts) > 1 else "Bahrain"
    target_session_type = parts[2].title() if len(parts) > 2 else "Race"

    if season:
        target_season = season
    if circuit:
        target_circuit = circuit
    if session_type:
        target_session_type = session_type

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

    if overview.weather_summary:
        result.track_temp = overview.weather_summary.track_temp
        result.rainfall = overview.weather_summary.rainfall
        result.air_temp = overview.weather_summary.air_temp
        result.humidity = overview.weather_summary.humidity

    return result


# ── 6. Create Race Strategy ───────────────────────────────────────────────────
@router.post("/strategies", response_model=RaceStrategyResponse, status_code=status.HTTP_201_CREATED)
async def create_race_strategy(
    payload: RaceStrategyCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("strategy:create")),
) -> RaceStrategyResponse:
    """
    Creates a pre-race strategy plan for an upcoming event.

    Server-side validation:
      - Accepts current-season events that haven't run yet, OR next-season events
        only when the current season has no events remaining.
      - Stores the plan against the event's own season, not an assumed current one.
    """
    team_id = _ensure_strategy_team(current_user)
    current_season = _current_season()

    curr_upcoming = await _get_upcoming_events_list(current_season)
    target_season = payload.season
    target_round = payload.round

    if curr_upcoming:
        if target_season != current_season:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Strategy plans may only be created for the current season ({current_season}).",
            )
        allowed_rounds = {ev["round_number"] for ev in curr_upcoming}
        if target_round not in allowed_rounds:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Round {target_round} is not an upcoming event in the {current_season} season. "
                    "Strategy plans can only be created for events whose race date is today or later."
                ),
            )
        upcoming_source = curr_upcoming
    else:
        next_season = current_season + 1
        try:
            next_upcoming = await _get_upcoming_events_list(next_season)
        except Exception:
            next_upcoming = []

        if not next_upcoming:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"No upcoming events available: the {current_season} season is complete "
                    "and next season's schedule isn't published yet."
                ),
            )
        if target_season != next_season:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"The {current_season} season is complete. "
                    f"Strategy plans can only be created for upcoming events in the {next_season} season."
                ),
            )
        allowed_rounds = {ev["round_number"] for ev in next_upcoming}
        if target_round not in allowed_rounds:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Round {target_round} is not a valid upcoming event in the {next_season} season schedule.",
            )
        upcoming_source = next_upcoming

    # Derive circuit name for the event_name stored in plan
    event_name = f"Round {target_round}"
    for ev in upcoming_source:
        if ev["round_number"] == target_round:
            event_name = ev.get("event_name", event_name)
            break

    plan_data = {
        "title": payload.title or f"Strategy Plan — {event_name} {target_season}",
        "driver_code": payload.driver_code,
        "stints": [s.model_dump() for s in payload.plan],
        "total_laps": payload.total_laps,
    }

    new_strategy = RaceStrategy(
        team_id=team_id,
        session_id=None,
        season=target_season,
        round=target_round,
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
            "season": target_season,
            "round": target_round,
            "event_name": event_name,
            "driver_code": payload.driver_code,
            "stints_count": len(payload.plan),
        },
        request=request,
    )

    await db.commit()
    await db.refresh(new_strategy)

    return _build_strategy_response(new_strategy, current_user.full_name)


# ── 7. List Race Strategies ───────────────────────────────────────────────────
@router.get("/strategies", response_model=List[RaceStrategyResponse])
async def get_race_strategies(
    season: Optional[int] = Query(None, description="Filter by season"),
    round: Optional[int] = Query(None, description="Filter by round"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("strategy:read")),
) -> List[RaceStrategyResponse]:
    """
    Returns all strategy plans for the current team.
    Legacy plans (session_id-based) are included and flagged with `is_legacy=True`.
    """
    team_id = _ensure_strategy_team(current_user)

    query = (
        select(RaceStrategy)
        .options(selectinload(RaceStrategy.creator))
        .where(RaceStrategy.team_id == team_id)
    )
    if season is not None and isinstance(season, int):
        query = query.where(RaceStrategy.season == season)
    if round is not None and isinstance(round, int):
        query = query.where(RaceStrategy.round == round)

    query = query.order_by(RaceStrategy.created_at.desc())
    result = await db.execute(query)
    strategies = result.scalars().all()

    return [
        _build_strategy_response(s, s.creator.full_name if s.creator else "Strategy Engineer")
        for s in strategies
    ]


# ── 8. Strategy Comparison ────────────────────────────────────────────────────
@router.get("/strategies/compare", response_model=StrategyComparisonResponse)
async def compare_race_strategies_endpoint(
    strategy_ids: List[str] = Query(..., description="Two or more RaceStrategy UUIDs to compare"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("strategy:read")),
) -> StrategyComparisonResponse:
    """
    Side-by-side strategy scenario comparison.
    Accepts two or more RaceStrategy IDs that must all belong to the same season + round.
    Calculates total projected race time per plan from historical circuit degradation data.
    Legacy plans (session_id only) are supported but compared using default compound models.
    """
    team_id = _ensure_strategy_team(current_user)

    # Flatten comma-separated IDs if passed as a single query param
    cleaned_ids: List[str] = []
    for sid in strategy_ids:
        if "," in sid:
            cleaned_ids.extend([item.strip() for item in sid.split(",") if item.strip()])
        elif sid.strip():
            cleaned_ids.append(sid.strip())

    if len(cleaned_ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least two strategy IDs are required for comparison.",
        )

    res = await db.execute(
        select(RaceStrategy)
        .options(selectinload(RaceStrategy.creator))
        .where(RaceStrategy.id.in_(cleaned_ids), RaceStrategy.team_id == team_id)
    )
    strategies = res.scalars().all()

    if len(strategies) < 2:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Could not find at least two valid strategy plans belonging to your team.",
        )

    # All must share the same season + round (or the same legacy session_id)
    seasons = {s.season for s in strategies if s.season is not None}
    rounds = {s.round for s in strategies if s.round is not None}

    if len(seasons) > 1 or len(rounds) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "All strategy plans selected for comparison must belong to the same event "
                "(same season and round number)."
            ),
        )

    # Determine circuit name for historical lookup
    if seasons and rounds:
        season = next(iter(seasons))
        round_number = next(iter(rounds))
        circuit_name = "Unknown"
        try:
            all_events = telemetry_provider.get_event_schedule(season)
            for ev in all_events:
                if ev.get("round_number") == round_number:
                    circuit_name = ev.get("location") or ev.get("event_name", circuit_name)
                    break
        except Exception:
            pass
    else:
        # Legacy fallback: parse from session_id
        session_id = strategies[0].session_id or ""
        parts = session_id.split("_")
        season = int(parts[0]) if parts and parts[0].isdigit() else _current_season()
        round_number = 0
        circuit_name = parts[1].title() if len(parts) > 1 else "Unknown"

    pit_loss = await get_circuit_pit_loss(db, circuit_name)

    # Load historical data
    available_seasons = telemetry_provider.get_seasons()
    past_seasons = [s for s in available_seasons if s <= season][-3:]
    overviews = []
    for s_yr in past_seasons:
        try:
            ov = await get_processed_session_overview(
                db=db, season=s_yr, circuit_name=circuit_name, session_type="Race", team_id=team_id
            )
            overviews.append(ov)
        except Exception:
            pass

    historical_review = summarize_historical_cross_season(circuit_name, past_seasons, overviews)

    return compare_race_strategies(
        strategies=strategies,
        season=season,
        round_number=round_number,
        circuit_name=circuit_name,
        pit_loss_seconds=pit_loss,
        historical_review=historical_review,
    )


# ── 9. Historical Cross-Season Review ─────────────────────────────────────────
@router.get("/historical", response_model=HistoricalStrategyReviewResponse)
async def get_historical_strategy_review(
    circuit: str = Query("Bahrain", description="Circuit location e.g. Monaco or Bahrain"),
    seasons: Optional[str] = Query(None, description="Comma-separated seasons e.g. 2023,2024"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("strategy:read")),
) -> HistoricalStrategyReviewResponse:
    """
    Summarises compound degradation patterns across multiple past seasons at a given circuit.
    Used by strategy engineers to inform compound selection before an upcoming race at that venue.
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

    overviews = []
    for s in target_seasons:
        try:
            ov = await get_processed_session_overview(
                db=db, season=s, circuit_name=circuit, session_type="Race", team_id=team_id
            )
            overviews.append(ov)
        except Exception as exc:
            logger.warning("Failed to fetch historical overview for %s %s: %s", circuit, s, exc)

    return summarize_historical_cross_season(circuit, target_seasons, overviews)


# ── 10. Strategy Reports ──────────────────────────────────────────────────────
@router.post("/reports", response_model=StrategyReportResponse, status_code=status.HTTP_201_CREATED)
async def generate_strategy_report(
    payload: StrategyReportCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports:strategy")),
) -> StrategyReportResponse:
    """
    Saves a strategy analysis summary as a Report record.
    Writes an AuditLog entry and sends a notification to the relevant driver.
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
            title="New Strategy Analysis Report Available",
            message=(
                f"Strategy Engineer {current_user.full_name} generated a strategy analysis "
                f"report for session {payload.session_id}."
            ),
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
    """Returns all strategy reports for the current team."""
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
