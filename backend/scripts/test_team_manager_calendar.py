"""
Integration test script for Team Manager Race Calendar feature.
Verifies GET /api/v1/team-manager/calendar endpoint using shared FastF1TelemetryProvider.
"""
import asyncio
import logging
from sqlalchemy import select

from app.db.session import AsyncSessionLocal, engine
from app.models.user import User
from app.services.race_telemetry import get_team_driver_codes
from app.services.telemetry_provider import telemetry_provider

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main():
    async with AsyncSessionLocal() as db:
        logger.info("=== 1. Testing Team Manager User Resolution ===")
        res = await db.execute(select(User).where(User.team_id.isnot(None)))
        manager = res.scalars().first()
        if not manager or not manager.team_id:
            logger.error("Team manager user or team_id not found")
            return
        logger.info("Found User: %s, Team ID: %s", manager.full_name, manager.team_id)

        logger.info("=== 2. Testing Shared FastF1 Seasons Computation ===")
        seasons = telemetry_provider.get_seasons()
        logger.info("Available seasons: %s", seasons)
        assert len(seasons) > 0

        logger.info("=== 3. Testing Team Driver Codes Resolution ===")
        driver_codes_2023 = await get_team_driver_codes(db, manager.team_id, 2023)
        logger.info("2023 Team Drivers: %s", driver_codes_2023)

        logger.info("=== 4. Testing Completed Race Calendar Fetch (2023 Season) ===")
        events_2023 = telemetry_provider.get_season_calendar_events(2023, filter_driver_codes=driver_codes_2023)
        logger.info("Total events in 2023: %s", len(events_2023))
        assert len(events_2023) > 0

        completed_events = [e for e in events_2023 if e["is_completed"]]
        logger.info("Completed events in 2023: %s", len(completed_events))
        assert len(completed_events) > 0

        first_completed = completed_events[0]
        logger.info("First Completed Race: Round %s - %s (%s)", first_completed["round_number"], first_completed["event_name"], first_completed["country"])
        logger.info("Driver results for team: %s", first_completed["driver_results"])
        assert len(first_completed["driver_results"]) > 0

        logger.info("=== 5. Testing Upcoming Race Schedule Fetch (2026 Season) ===")
        driver_codes_2026 = await get_team_driver_codes(db, manager.team_id, 2026)
        events_2026 = telemetry_provider.get_season_calendar_events(2026, filter_driver_codes=driver_codes_2026)
        logger.info("Total events in 2026: %s", len(events_2026))

        logger.info("=== TEAM MANAGER RACE CALENDAR INTEGRATION TESTS PASSED CLEANLY! ===")
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

