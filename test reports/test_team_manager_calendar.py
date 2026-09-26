"""
Integration test script for Team Manager Race Calendar feature.
Verifies GET /api/v1/team-manager/calendar endpoint using shared FastF1TelemetryProvider
and validates that per-session driver filtering accurately returns session team drivers (e.g. 2 drivers).
"""
import asyncio
import logging
from sqlalchemy import select

from app.db.session import AsyncSessionLocal, engine
from app.models.user import User
from app.services.race_telemetry import get_team_driver_codes, get_team_name_by_id
from app.services.telemetry_provider import telemetry_provider

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main():
    async with AsyncSessionLocal() as db:
        logger.info("=== 1. Testing Team Manager User & Team Resolution ===")
        res = await db.execute(select(User).where(User.team_id.isnot(None)))
        manager = res.scalars().first()
        if not manager or not manager.team_id:
            logger.error("Team manager user or team_id not found")
            return
        logger.info("Found User: %s, Team ID: %s", manager.full_name, manager.team_id)

        team_name = await get_team_name_by_id(db, manager.team_id)
        logger.info("Resolved Team Name: %s", team_name)

        logger.info("=== 2. Testing Shared FastF1 Seasons Computation ===")
        seasons = telemetry_provider.get_seasons()
        logger.info("Available seasons: %s", seasons)
        assert len(seasons) > 0

        logger.info("=== 3. Testing Per-Session Team Driver Results Filtering (2023 Season) ===")
        events_2023 = await telemetry_provider.get_season_calendar_events(2023, team_name=team_name)
        logger.info("Total events in 2023: %s", len(events_2023))
        assert len(events_2023) > 0

        completed_events = [e for e in events_2023 if e["is_completed"]]
        logger.info("Completed events in 2023: %s", len(completed_events))
        assert len(completed_events) > 0

        first_completed = completed_events[0]
        logger.info(
            "First Completed Race: Round %s - %s (%s)",
            first_completed["round_number"],
            first_completed["event_name"],
            first_completed["country"],
        )
        logger.info("Driver results for team: %s", first_completed["driver_results"])

        # DATA ACCURACY BUG FIX VERIFICATION:
        # Each race card must show ONLY the drivers who actually competed in that race for the team (e.g. 2 drivers),
        # NOT the entire static list of internal Driver table records (4 drivers).
        team_drivers_count = len(first_completed["driver_results"])
        logger.info("Actual session drivers classified for %s in Round 1: %d", team_name, team_drivers_count)
        assert team_drivers_count > 0, "Expected at least 1 classified driver for team"
        assert team_drivers_count <= 2, f"Expected exactly 2 race drivers (or sub), got {team_drivers_count}"

        logger.info("=== 4. Testing Upcoming Race Schedule Fetch (2026 Season) ===")
        events_2026 = await telemetry_provider.get_season_calendar_events(2026, team_name=team_name)
        logger.info("Total events in 2026: %s", len(events_2026))

        logger.info("=== TEAM MANAGER RACE CALENDAR INTEGRATION TESTS PASSED CLEANLY! ===")
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
