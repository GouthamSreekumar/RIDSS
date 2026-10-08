import asyncio
import logging
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import AsyncSessionLocal
from app.models.team import Team
from app.models.user import User
from app.models.race_strategy import RaceStrategy

logger = logging.getLogger(__name__)

SAMPLE_STRATEGIES = [
    {
        "session_id": "2024_bahrain_race",
        "driver_code": "VER",
        "title": "Conservative 1-Stop (Medium-Hard)",
        "plan": {
            "title": "Conservative 1-Stop (Medium-Hard)",
            "driver_code": "VER",
            "stints": [
                {"stint_number": 1, "compound": "MEDIUM", "start_lap": 1, "end_lap": 24, "target_pit_lap": 24, "notes": "Long initial stint to gain track position"},
                {"stint_number": 2, "compound": "HARD", "start_lap": 25, "end_lap": 57, "target_pit_lap": None, "notes": "Hard compound to race finish"},
            ]
        }
    },
    {
        "session_id": "2024_bahrain_race",
        "driver_code": "VER",
        "title": "Aggressive 2-Stop Sprint (Soft-Medium-Soft)",
        "plan": {
            "title": "Aggressive 2-Stop Sprint (Soft-Medium-Soft)",
            "driver_code": "VER",
            "stints": [
                {"stint_number": 1, "compound": "SOFT", "start_lap": 1, "end_lap": 15, "target_pit_lap": 15, "notes": "Aggressive launch stint on fresh softs"},
                {"stint_number": 2, "compound": "MEDIUM", "start_lap": 16, "end_lap": 38, "target_pit_lap": 38, "notes": "Solid mid-race pace stint"},
                {"stint_number": 3, "compound": "SOFT", "start_lap": 39, "end_lap": 57, "target_pit_lap": None, "notes": "Final soft tire sprint for fastest lap"},
            ]
        }
    },
    {
        "session_id": "2024_bahrain_race",
        "driver_code": "PER",
        "title": "Balanced 2-Stop (Medium-Hard-Soft)",
        "plan": {
            "title": "Balanced 2-Stop (Medium-Hard-Soft)",
            "driver_code": "PER",
            "stints": [
                {"stint_number": 1, "compound": "MEDIUM", "start_lap": 1, "end_lap": 18, "target_pit_lap": 18, "notes": "Standard opening stint"},
                {"stint_number": 2, "compound": "HARD", "start_lap": 19, "end_lap": 42, "target_pit_lap": 42, "notes": "Long middle stint"},
                {"stint_number": 3, "compound": "SOFT", "start_lap": 43, "end_lap": 57, "target_pit_lap": None, "notes": "Short final stint"},
            ]
        }
    },
    {
        "session_id": "2024_bahrain_race",
        "driver_code": "VER",
        "title": "Undercut Alternate (Soft-Hard-Medium)",
        "plan": {
            "title": "Undercut Alternate (Soft-Hard-Medium)",
            "driver_code": "VER",
            "stints": [
                {"stint_number": 1, "compound": "SOFT", "start_lap": 1, "end_lap": 12, "target_pit_lap": 12, "notes": "Early undercut pit stop"},
                {"stint_number": 2, "compound": "HARD", "start_lap": 13, "end_lap": 36, "target_pit_lap": 36, "notes": "Middle stint holding position"},
                {"stint_number": 3, "compound": "MEDIUM", "start_lap": 37, "end_lap": 57, "target_pit_lap": None, "notes": "Medium stint to race finish"},
            ]
        }
    },
    {
        "session_id": "2024_monaco_race",
        "driver_code": "VER",
        "title": "Monaco Track Position 1-Stop (Hard-Medium)",
        "plan": {
            "title": "Monaco Track Position 1-Stop (Hard-Medium)",
            "driver_code": "VER",
            "stints": [
                {"stint_number": 1, "compound": "HARD", "start_lap": 1, "end_lap": 50, "target_pit_lap": 50, "notes": "Ultra long hard stint to cover safety car"},
                {"stint_number": 2, "compound": "MEDIUM", "start_lap": 51, "end_lap": 78, "target_pit_lap": None, "notes": "Final medium stint"},
            ]
        }
    },
    {
        "session_id": "2024_monaco_race",
        "driver_code": "PER",
        "title": "Monaco Early Pit Window 1-Stop (Medium-Hard)",
        "plan": {
            "title": "Monaco Early Pit Window 1-Stop (Medium-Hard)",
            "driver_code": "PER",
            "stints": [
                {"stint_number": 1, "compound": "MEDIUM", "start_lap": 1, "end_lap": 22, "target_pit_lap": 22, "notes": "Early pit stop into clear air"},
                {"stint_number": 2, "compound": "HARD", "start_lap": 23, "end_lap": 78, "target_pit_lap": None, "notes": "Defend position on hard tire"},
            ]
        }
    },
]


async def seed_diverse_strategies():
    async with AsyncSessionLocal() as session:
        # Find Red Bull team or any team
        team_res = await session.execute(select(Team))
        teams = team_res.scalars().all()
        if not teams:
            logger.error("No teams found in database. Seed teams first.")
            return

        team = teams[0]

        # Find Strategy Engineer or active user
        user_res = await session.execute(select(User).where(User.team_id == team.team_id))
        users = user_res.scalars().all()
        if not users:
            user_res = await session.execute(select(User))
            users = user_res.scalars().all()

        if not users:
            logger.error("No users found in database.")
            return

        user = users[0]

        logger.info("Seeding sample strategy plans for Team ID: %s by User: %s (%s)", team.team_id, user.full_name, user.email)

        created_count = 0
        for strat_data in SAMPLE_STRATEGIES:
            # Check if strategy with same title already exists for team
            existing_res = await session.execute(
                select(RaceStrategy).where(
                    RaceStrategy.team_id == team.team_id,
                    RaceStrategy.session_id == strat_data["session_id"],
                )
            )
            existing_strats = existing_res.scalars().all()
            already_exists = False
            for s in existing_strats:
                t = s.plan.get("title") if isinstance(s.plan, dict) else ""
                if t == strat_data["title"]:
                    already_exists = True
                    break

            if not already_exists:
                new_strat = RaceStrategy(
                    team_id=team.team_id,
                    session_id=strat_data["session_id"],
                    created_by=user.user_id,
                    plan=strat_data["plan"],
                    created_at=datetime.now(timezone.utc),
                )
                session.add(new_strat)
                created_count += 1

        await session.commit()
        logger.info("Successfully seeded %d new diverse strategy plans!", created_count)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed_diverse_strategies())
