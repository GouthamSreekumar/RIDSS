import asyncio
import logging
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.db.session import AsyncSessionLocal
from app.models.driver import Driver
from app.models.team import Team
from app.models.user import User
from app.models.role import Role
from app.core.security import hash_password

logger = logging.getLogger(__name__)

RED_BULL_DRIVERS = [
    {
        "full_name": "Max Verstappen",
        "email": "verstappen@redbull.team",
        "fastf1_code": "VER",
        "driver_number": 1,
        "nationality": "Dutch",
    },
    {
        "full_name": "Sergio Pérez",
        "email": "perez@redbull.team",
        "fastf1_code": "PER",
        "driver_number": 11,
        "nationality": "Mexican",
    },
    {
        "full_name": "Liam Lawson",
        "email": "lawson@redbull.team",
        "fastf1_code": "LAW",
        "driver_number": 30,
        "nationality": "New Zealander",
    },
    {
        "full_name": "Yuki Tsunoda",
        "email": "tsunoda@redbull.team",
        "fastf1_code": "TSU",
        "driver_number": 22,
        "nationality": "Japanese",
    },
    {
        "full_name": "Isack Hadjar",
        "email": "hadjar@redbull.team",
        "fastf1_code": "HAD",
        "driver_number": 6,
        "nationality": "French",
    },
]


async def seed_redbull_drivers():
    async with AsyncSessionLocal() as session:
        # Resolve Oracle Red Bull Racing team
        team_res = await session.execute(select(Team).where(Team.team_name.ilike("%Red Bull%")))
        team = team_res.scalars().first()

        if not team:
            team = Team(team_name="Oracle Red Bull Racing")
            session.add(team)
            await session.flush()

        # Resolve Driver Role
        role_res = await session.execute(select(Role).where(Role.role_name.ilike("%Driver%")))
        role = role_res.scalars().first()

        logger.info("Seeding Red Bull Drivers for Team ID: %s", team.team_id)

        for d_info in RED_BULL_DRIVERS:
            # 1. Query Driver by fastf1_code
            drv_res = await session.execute(
                select(Driver)
                .options(selectinload(Driver.user))
                .where(Driver.fastf1_code == d_info["fastf1_code"])
            )
            driver = drv_res.scalars().first()

            # 2. Query User by email
            user_res = await session.execute(
                select(User)
                .options(selectinload(User.driver_profile))
                .where(User.email == d_info["email"])
            )
            user = user_res.scalars().first()

            if driver and driver.user:
                user = driver.user

            if user:
                logger.info("Updating user credentials for %s: %s", d_info["full_name"], d_info["email"])
                user.email = d_info["email"]
                user.full_name = d_info["full_name"]
                user.password_hash = hash_password("Driver@2025!")
                if role:
                    user.role_id = role.role_id
                user.team_id = team.team_id
                user.status = "active"

                if not driver and user.driver_profile:
                    driver = user.driver_profile

                if driver:
                    driver.user_id = user.user_id
                    driver.driver_number = d_info["driver_number"]
                    driver.fastf1_driver_number = d_info["driver_number"]
                    driver.fastf1_code = d_info["fastf1_code"]
                    driver.nationality = d_info["nationality"]
                    driver.is_active = True
                else:
                    driver = Driver(
                        user_id=user.user_id,
                        driver_number=d_info["driver_number"],
                        fastf1_driver_number=d_info["driver_number"],
                        fastf1_code=d_info["fastf1_code"],
                        nationality=d_info["nationality"],
                        is_active=True,
                    )
                    session.add(driver)
            else:
                logger.info("Creating new user & driver for: %s (%s)", d_info["full_name"], d_info["email"])
                user = User(
                    email=d_info["email"],
                    password_hash=hash_password("Driver@2025!"),
                    full_name=d_info["full_name"],
                    role_id=role.role_id if role else None,
                    team_id=team.team_id,
                    status="active",
                )
                session.add(user)
                await session.flush()

                if driver:
                    driver.user_id = user.user_id
                    driver.driver_number = d_info["driver_number"]
                    driver.fastf1_driver_number = d_info["driver_number"]
                    driver.fastf1_code = d_info["fastf1_code"]
                    driver.nationality = d_info["nationality"]
                    driver.is_active = True
                else:
                    driver = Driver(
                        user_id=user.user_id,
                        driver_number=d_info["driver_number"],
                        fastf1_driver_number=d_info["driver_number"],
                        fastf1_code=d_info["fastf1_code"],
                        nationality=d_info["nationality"],
                        is_active=True,
                    )
                    session.add(driver)

        await session.commit()
        logger.info("Red Bull drivers seeded successfully!")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed_redbull_drivers())
