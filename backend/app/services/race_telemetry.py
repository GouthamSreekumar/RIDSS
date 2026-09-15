"""
Race telemetry business service layer.
Provides high-level processed session analysis for API route handlers and downstream modules
(such as Strategy Engineer), preventing raw FastF1 queries outside this layer.
"""
import logging
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.driver import Driver
from app.models.race_circuit import Circuit
from app.models.user import User
from app.schemas.race_engineer import (
    ComparisonData,
    LapTelemetry,
    SessionOverview,
)
from app.services.telemetry_provider import telemetry_provider

logger = logging.getLogger(__name__)


from app.models.driver import Driver
from app.models.race_circuit import Circuit
from app.models.team import Team
from app.models.user import User
from app.schemas.race_engineer import (
    ComparisonData,
    LapTelemetry,
    SessionOverview,
)
from app.services.telemetry_provider import telemetry_provider

logger = logging.getLogger(__name__)


async def get_team_name_by_id(db: AsyncSession, team_id: str) -> Optional[str]:
    """Helper to fetch team_name for a given team_id."""
    res = await db.execute(select(Team).where(Team.team_id == team_id))
    team = res.scalar_one_or_none()
    return team.team_name if team else None


async def get_team_driver_codes(
    db: AsyncSession,
    team_id: str,
    season: Optional[int] = None,
    circuit_name: Optional[str] = None,
    session_type: Optional[str] = None,
) -> List[str]:
    """
    Resolves FastF1 driver codes dynamically per session based on team_name matching.
    Falls back to current active team drivers in DB if season/circuit context is omitted.
    """
    team_name = await get_team_name_by_id(db, team_id)

    if season and circuit_name and session_type and team_name:
        overview = telemetry_provider.get_session_overview(
            season=season,
            circuit_name=circuit_name,
            session_type=session_type,
            team_name=team_name,
        )
        session_codes = []
        if overview.session_results:
            session_codes = [res.driver_code.upper() for res in overview.session_results if res.driver_code]
        elif overview.driver_lap_summaries:
            session_codes = [k.upper() for k in overview.driver_lap_summaries.keys()]

        if session_codes:
            return session_codes

    res = await db.execute(
        select(Driver)
        .options(selectinload(Driver.user))
        .join(User)
        .where(User.team_id == team_id, User.status == "active", Driver.is_active == True)
    )
    drivers = res.scalars().all()
    codes = []
    for d in drivers:
        if d.fastf1_code:
            codes.append(d.fastf1_code.upper())
        elif d.user and d.user.full_name:
            parts = d.user.full_name.split()
            last_name = parts[-1] if parts else d.user.full_name
            codes.append(last_name[:3].upper())
    return codes


async def get_processed_session_overview(
    db: AsyncSession,
    season: int,
    circuit_name: str,
    session_type: str,
    team_id: Optional[str] = None,
) -> SessionOverview:
    """
    Tier 1 lap-level summary for a session.
    If team_id is provided, server-side filtering is enforced matching FastF1 session results by team_name.
    """
    team_name = None
    if team_id:
        team_name = await get_team_name_by_id(db, team_id)

    overview = telemetry_provider.get_session_overview(
        season=season,
        circuit_name=circuit_name,
        session_type=session_type,
        team_name=team_name,
    )
    return overview


async def get_processed_lap_telemetry(
    db: AsyncSession,
    season: int,
    circuit_name: str,
    session_type: str,
    driver_code: str,
    lap_number: int,
) -> LapTelemetry:
    """
    Tier 2 full telemetry stream for one lap.
    """
    lap_tel = telemetry_provider.get_lap_telemetry(
        season=season,
        circuit_name=circuit_name,
        session_type=session_type,
        driver_code=driver_code,
        lap_number=lap_number,
    )
    return lap_tel


async def get_processed_comparison(
    season: int,
    circuit_name: str,
    session_type: str,
    primary_driver: str,
    primary_lap: int,
    secondary_driver: str,
    secondary_lap: int,
    secondary_season: Optional[int] = None,
) -> ComparisonData:
    """
    Comparison telemetry data between two drivers or cross-season laps aligned on Distance.
    """
    sec_season = secondary_season if secondary_season else season

    primary_dict = {
        "season": season,
        "circuit_name": circuit_name,
        "session_type": session_type,
        "driver_code": primary_driver,
        "lap_number": primary_lap,
    }
    secondary_dict = {
        "season": sec_season,
        "circuit_name": circuit_name,
        "session_type": session_type,
        "driver_code": secondary_driver,
        "lap_number": secondary_lap,
    }

    comp = telemetry_provider.get_comparison(primary_dict, secondary_dict)
    return comp
