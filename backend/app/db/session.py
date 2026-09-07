"""Async SQLAlchemy session factory and database health check."""
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=False,
    future=True,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:  # type: ignore[return]
    """FastAPI dependency that yields an async database session."""
    async with AsyncSessionLocal() as session:
        yield session


async def check_db_connection() -> None:
    """
    Startup health check: executes `SELECT 1`.
    Fails loudly with a clear RuntimeError if PostgreSQL RIDSS is unreachable.
    """
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("Database connection to RIDSS verified successfully.")
    except Exception as exc:
        logger.critical("CRITICAL: Failed to connect to PostgreSQL RIDSS database: %s", exc)
        raise RuntimeError(f"RIDSS Database Connection Failure: Could not execute 'SELECT 1'. Details: {exc}") from exc
