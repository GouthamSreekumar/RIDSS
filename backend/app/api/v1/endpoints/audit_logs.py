"""
Audit Logs API endpoints (search & CSV export).
"""
import csv
import io
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.rbac import require_permission
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogResponse

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


def _build_audit_log_query(
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    user_id: Optional[str] = None,
    search: Optional[str] = None,
):
    stmt = select(AuditLog).options(selectinload(AuditLog.user))

    if action:
        stmt = stmt.where(AuditLog.action.ilike(f"%{action}%"))
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type.ilike(f"%{entity_type}%"))
    if user_id:
        stmt = stmt.where(AuditLog.user_id == user_id)
    if search:
        q = f"%{search}%"
        stmt = stmt.where(
            or_(
                AuditLog.action.ilike(q),
                AuditLog.entity_type.ilike(q),
                AuditLog.user_id.ilike(q),
                AuditLog.entity_id.ilike(q),
                AuditLog.details.ilike(q),
            )
        )

    return stmt.order_by(AuditLog.created_at.desc())


@router.get("", response_model=List[AuditLogResponse])
async def search_audit_logs(
    action: Optional[str] = Query(None, description="Filter by action string (e.g. ROLE_PERMISSIONS_UPDATE)"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type (e.g. User, Role)"),
    user_id: Optional[str] = Query(None, description="Filter by user ID who performed action"),
    search: Optional[str] = Query(None, description="Free text search filter"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_permission("audit-logs:read")),
) -> List[AuditLogResponse]:
    """
    Search and filter system audit log history.
    """
    stmt = _build_audit_log_query(action=action, entity_type=entity_type, user_id=user_id, search=search)
    stmt = stmt.offset(skip).limit(limit)

    res = await db.execute(stmt)
    logs = res.scalars().all()

    return [
        AuditLogResponse(
            log_id=log.log_id,
            user_id=log.user_id,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            details=log.details,
            ip_address=log.ip_address,
            created_at=log.created_at,
            user_email=log.user.email if log.user else None,
        )
        for log in logs
    ]


@router.get("/export")
async def export_audit_logs_csv(
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_permission("audit-logs:read")),
) -> Response:
    """
    Export audit log entries as a CSV download matching current search/filter criteria.
    """
    stmt = _build_audit_log_query(action=action, entity_type=entity_type, user_id=user_id, search=search)
    stmt = stmt.limit(5000)

    res = await db.execute(stmt)
    logs = res.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Log ID",
        "Timestamp",
        "User ID",
        "User Email",
        "Action",
        "Entity Type",
        "Entity ID",
        "IP Address",
        "Details",
    ])

    for log in logs:
        writer.writerow([
            log.log_id,
            log.created_at.isoformat(),
            log.user_id or "",
            log.user.email if log.user else "",
            log.action,
            log.entity_type,
            log.entity_id or "",
            log.ip_address or "",
            log.details or "",
        ])

    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=ridss_audit_logs.csv"},
    )

