"""
Database seeder: creates tables and inserts one demo user per role.

Judgment call: Passwords are stored with bcrypt (cost factor 12 — OWASP
minimum for interactive logins). Demo passwords are intentionally weak for
development only — the admin MUST change them before any production deploy.

Run via: python -m app.db.seed
"""
import asyncio
import logging

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal, engine
from app.models.user import Base, User, UserRole

logger = logging.getLogger(__name__)

DEMO_USERS = [
    {
        "email": "admin@ridss.team",
        "password": "Admin@2025!",
        "full_name": "System Administrator",
        "role": UserRole.ADMINISTRATOR,
    },
    {
        "email": "manager@ridss.team",
        "password": "Manager@2025!",
        "full_name": "James Whitfield",
        "role": UserRole.TEAM_MANAGER,
    },
    {
        "email": "engineer@ridss.team",
        "password": "Engineer@2025!",
        "full_name": "Sophie Laurent",
        "role": UserRole.RACE_ENGINEER,
    },
    {
        "email": "strategy@ridss.team",
        "password": "Strategy@2025!",
        "full_name": "Marco Ferretti",
        "role": UserRole.STRATEGY_ENGINEER,
    },
    {
        "email": "mechanic@ridss.team",
        "password": "Mechanic@2025!",
        "full_name": "Carlos Mendez",
        "role": UserRole.MECHANIC,
    },
    {
        "email": "driver@ridss.team",
        "password": "Driver@2025!",
        "full_name": "Aria Nakamura",
        "role": UserRole.DRIVER,
    },
]


async def seed() -> None:
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Tables created.")

    async with AsyncSessionLocal() as session:
        for user_data in DEMO_USERS:
            result = await session.execute(
                select(User).where(User.email == user_data["email"])
            )
            existing = result.scalar_one_or_none()
            if existing:
                logger.info("User %s already exists — skipping.", user_data["email"])
                continue

            user = User(
                email=user_data["email"],
                hashed_password=hash_password(user_data["password"]),
                full_name=user_data["full_name"],
                role=user_data["role"].value,
                is_active=True,
            )
            session.add(user)
            logger.info("Created user: %s (%s)", user_data["email"], user_data["role"].value)

        await session.commit()
    logger.info("Seeding complete.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed())
