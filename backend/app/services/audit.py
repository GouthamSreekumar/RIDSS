"""
Audit logging service-layer hook for recording admin and system mutations.
"""
import json
import logging
from typing import Any, Dict, Optional
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog

logger = logging.getLogger(__name__)


async def log_audit_event(
    db: AsyncSession,
    user_id: Optional[str],
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> AuditLog:
    """
    Service-layer hook to automatically persist an AuditLog entry.
    """
    ip_address = None
    if request:
        # Check X-Forwarded-For first, fallback to client host
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            ip_address = forwarded.split(",")[0].strip()
        elif request.client:
            ip_address = request.client.host

    details_str = json.dumps(details) if details is not None else None

    audit_entry = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details_str,
        ip_address=ip_address,
    )
    db.add(audit_entry)
    logger.info("Audit log recorded: [%s] %s on %s (%s)", action, entity_type, entity_id, user_id)
    return audit_entry
