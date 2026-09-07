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


# Season-specific Red Bull Racing driver roster matrix
SEASON_TEAM_DRIVER_MAP: Dict[int, List[str]] = {
    2023: ["VER", "PER"],
    2024: ["VER", "PER"],
    2025: ["VER", "LAW", "TSU"],
    2026: ["VER", "HAD"],
}


async def get_team_driver_codes(
    db: AsyncSession, team_id: str, season: Optional[int] = None
) -> List[str]:
    """Helper to resolve FastF1 driver codes for active drivers in a team, scoped by season."""
    if season and season in SEASON_TEAM_DRIVER_MAP:
        return SEASON_TEAM_DRIVER_MAP[season]

    res = await db.execute(
        select(Driver)
        .options(selectinload(Driver.user))
        .join(User)
        .where(User.team_id == team_id, User.status == "active")
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
    If team_id is provided, server-side filtering is enforced so only that team's drivers for that season are returned.
    This function is reusable directly by the Strategy Engineer module.
    """
    filter_codes = None
    if team_id:
        filter_codes = await get_team_driver_codes(db, team_id, season=season)

    overview = telemetry_provider.get_session_overview(
        season=season,
        circuit_name=circuit_name,
        session_type=session_type,
        filter_driver_codes=filter_codes,
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
    Tier 2 full telemetry stream for one lap, enriched with the circuit's GeoJSON track geometry.
    """
    lap_tel = telemetry_provider.get_lap_telemetry(
        season=season,
        circuit_name=circuit_name,
        session_type=session_type,
        driver_code=driver_code,
        lap_number=lap_number,
    )

    # Enrich with track_geometry from DB if available
    res = await db.execute(
        select(Circuit).where(Circuit.circuit_name.ilike(f"%{circuit_name}%"))
    )
    circuit = res.scalars().first()
    if circuit and circuit.track_geometry:
        lap_tel.track_geometry = circuit.track_geometry

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
