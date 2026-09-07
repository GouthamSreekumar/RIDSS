"""
FastAPI application factory for RIDSS Administrator Module & Core API.

Middleware order (Starlette applies in reverse registration order):
  1. CORSMiddleware (outermost — handles preflight before CSRF check)
  2. CSRFMiddleware (validates X-CSRF-Token on state-changing requests)
"""
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as api_v1_router
from app.core.config import get_settings
from app.core.csrf import CSRFMiddleware
from app.core.rbac import rbac_cache
from app.db.session import AsyncSessionLocal, check_db_connection

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan manager:
    1. Verifies PostgreSQL connection with `SELECT 1` health check (fails loudly if unreachable).
    2. Initializes in-memory RBAC Cache from RolePermission database records.
    """
    logger.info("Initializing RIDSS Backend...")
    
    # 1. Verify database connection
    await check_db_connection()

    # 2. Load RBAC Cache in memory
    async with AsyncSessionLocal() as session:
        await rbac_cache.initialize(session)

    logger.info("RIDSS Application initialized and ready.")
    yield
    logger.info("RIDSS Backend shutting down...")


def create_app() -> FastAPI:
    app = FastAPI(
        title="RIDSS API — Race Intelligence Decision Support System",
        description="Enterprise F1 Team Operations Platform — Administrator & Core Module API",
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        lifespan=lifespan,
    )

    # ── CORS ─────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,          # Required for cookie exchange
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-CSRF-Token"],
    )

    # ── CSRF ─────────────────────────────────────────────────────────────────
    app.add_middleware(CSRFMiddleware)

    # ── Routers ──────────────────────────────────────────────────────────────
    app.include_router(api_v1_router)

    return app


app = create_app()
