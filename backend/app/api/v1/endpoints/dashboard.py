"""
Admin Dashboard API endpoints.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import rbac_cache, require_permission
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.race_circuit import Race
from app.models.team import Team
from app.models.user import User
from app.schemas.audit import AuditLogResponse
from app.schemas.dashboard import AdminDashboardResponse

router = APIRouter(prefix="/admin", tags=["admin-dashboard"])


@router.get("/dashboard", response_model=AdminDashboardResponse)
async def get_admin_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("audit-logs:read")),
) -> AdminDashboardResponse:
    """
    Platform overview for Administrators.
    Returns user count, team count, active races, recent activity feed, and system health status.
    """
    # 1. Total User Count
    user_count_res = await db.execute(select(func.count(User.user_id)))
    user_count = user_count_res.scalar() or 0

    # 2. Total Team Count
    team_count_res = await db.execute(select(func.count(Team.team_id)))
    team_count = team_count_res.scalar() or 0

    # 3. Active Races Count (races scheduled for current year or future)
    now = datetime.now(timezone.utc)
    active_races_res = await db.execute(
        select(func.count(Race.race_id)).where(Race.season >= now.year)
    )
    active_races_count = active_races_res.scalar() or 0

    # 4. Recent Activity Feed (Top 10 Audit Logs)
    audit_res = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(10)
    )
    recent_logs = audit_res.scalars().all()
    recent_activity = [
        AuditLogResponse(
            log_id=log.log_id,
            user_id=log.user_id,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            details=log.details,
            ip_address=log.ip_address,
            created_at=log.created_at,
        )
        for log in recent_logs
    ]

    # 5. System Health Check
    system_health = {
        "status": "healthy",
        "database": "connected",
        "rbac_cache": "initialized" if rbac_cache._initialized else "pending",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    return AdminDashboardResponse(
        user_count=user_count,
        team_count=team_count,
        active_races_count=active_races_count,
        recent_activity=recent_activity,
        system_health=system_health,
    )
