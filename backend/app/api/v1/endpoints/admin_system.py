"""
System Health and User Login History API endpoints.
Administrator-only read-only monitoring.
"""
import logging
import os
import time
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.db.session import get_db
from app.models.cache_status import CacheStatus
from app.models.login_history import LoginHistory
from app.models.user import User
from app.schemas.login_history import LoginHistoryResponse
from app.schemas.system_health import (
    CacheHealth,
    DatabaseHealth,
    MigrationHealth,
    SystemHealthResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin-system"])


def _format_bytes(bytes_count: int) -> str:
    """Format bytes count into human readable string."""
    if bytes_count <= 0:
        return "0 B"
    units = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    size = float(bytes_count)
    while size >= 1024.0 and i < len(units) - 1:
        size /= 1024.0
        i += 1
    return f"{size:.2f} {units[i]}"


@router.get("/system-health", response_model=SystemHealthResponse)
async def get_system_health(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_permission("system:read")),
) -> SystemHealthResponse:
    """
    Returns system health and status across database, FastF1 cache, and database migrations.
    Gracefully handles database failures to report 'Critical/Unreachable' status rather than crashing.
    """
    now = datetime.now(timezone.utc)

    # 1. Database Connectivity Check
    db_status = "Healthy"
    db_response_time_ms: Optional[float] = None
    db_details = ""
    db_healthy = False

    try:
        start_t = time.perf_counter()
        await db.execute(text("SELECT 1"))
        db_response_time_ms = round((time.perf_counter() - start_t) * 1000, 2)
        db_status = "Healthy"
        db_details = f"Database connected successfully in {db_response_time_ms} ms."
        db_healthy = True
    except Exception as exc:
        logger.error("System health database check failed: %s", exc)
        db_status = "Unreachable"
        db_details = f"Database connectivity failure: {str(exc)}"
        db_healthy = False

    # 2. FastF1 Cache Status Check
    backend_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "..")
    )
    cache_dir = os.path.join(backend_dir, ".fastf1_cache")
    cache_bytes = 0
    if os.path.exists(cache_dir):
        for root, _, files in os.walk(cache_dir):
            for f in files:
                try:
                    fp = os.path.join(root, f)
                    if os.path.isfile(fp):
                        cache_bytes += os.path.getsize(fp)
                except OSError:
                    pass

    cache_formatted = _format_bytes(cache_bytes)
    last_prewarm_at: Optional[datetime] = None
    cache_status_str = "Healthy"
    cache_details = ""

    if db_healthy:
        try:
            res = await db.execute(select(CacheStatus).where(CacheStatus.id == "default"))
            cs = res.scalar_one_or_none()
            if cs and cs.last_prewarm_at:
                last_prewarm_at = cs.last_prewarm_at
                cache_status_str = "Healthy"
                cache_details = f"Pre-warm last recorded at {last_prewarm_at.isoformat()}. Total cache size on disk: {cache_formatted}."
            else:
                cache_status_str = "Degraded"
                cache_details = f"No pre-warm record found. Total cache size on disk: {cache_formatted}."
        except Exception as exc:
            logger.warning("CacheStatus table query failed: %s", exc)
            cache_status_str = "Degraded"
            cache_details = f"Could not fetch pre-warm record. Disk size: {cache_formatted}."
    else:
        cache_status_str = "Degraded"
        cache_details = f"Database unreachable. Cache disk size: {cache_formatted}."

    # 3. Pending Migrations Check
    applied_version = "Unknown"
    if db_healthy:
        try:
            ver_res = await db.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
            row = ver_res.fetchone()
            if row:
                applied_version = row[0]
        except Exception as exc:
            logger.warning("Alembic version query failed: %s", exc)
            applied_version = "Unapplied/None"

    current_head = "0008_system_health_login_history"
    try:
        from alembic.script import ScriptDirectory
        alembic_dir = os.path.join(backend_dir, "alembic")
        script = ScriptDirectory(alembic_dir)
        heads = script.get_heads()
        if heads:
            current_head = heads[0]
    except Exception as exc:
        logger.warning("Could not resolve Alembic script heads: %s", exc)

    pending_migrations = (applied_version != current_head)
    migration_status_str = "Degraded" if pending_migrations else "Healthy"
    if pending_migrations:
        migration_details = f"Pending migrations detected. Applied: {applied_version}, Head: {current_head}."
    else:
        migration_details = f"Database schema is fully up to date at head {current_head}."

    # 4. Overall Status Summary Rollup
    if not db_healthy:
        overall_status = "Critical"
    elif cache_status_str == "Degraded" or migration_status_str == "Degraded":
        overall_status = "Degraded"
    else:
        overall_status = "Healthy"

    return SystemHealthResponse(
        status=overall_status,
        timestamp=now,
        database=DatabaseHealth(
            status=db_status,
            response_time_ms=db_response_time_ms,
            details=db_details,
        ),
        cache=CacheHealth(
            status=cache_status_str,
            size_bytes=cache_bytes,
            size_formatted=cache_formatted,
            last_prewarm_at=last_prewarm_at,
            details=cache_details,
        ),
        migrations=MigrationHealth(
            status=migration_status_str,
            current_head=current_head,
            applied_version=applied_version,
            pending=pending_migrations,
            details=migration_details,
        ),
    )


@router.get("/users/{user_id}/login-history", response_model=List[LoginHistoryResponse])
async def get_user_login_history(
    user_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_permission("users:read")),
) -> List[LoginHistoryResponse]:
    """
    Fetch a user's login and session history, ordered by most recent first.
    Administrator-only.
    """
    skip_val = skip if isinstance(skip, int) else 0
    limit_val = limit if isinstance(limit, int) else 50

    user_res = await db.execute(select(User).where(User.user_id == user_id))
    if not user_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' not found.",
        )

    stmt = (
        select(LoginHistory)
        .where(LoginHistory.user_id == user_id)
        .order_by(LoginHistory.logged_in_at.desc())
        .offset(skip_val)
        .limit(limit_val)
    )
    res = await db.execute(stmt)
    return res.scalars().all()

