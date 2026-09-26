"""
Data Retention Policy service layer & pruning job execution.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Tuple

from fastapi import Request
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.login_history import LoginHistory
from app.models.settings import SettingCategory, SystemSettings
from app.services.audit import log_audit_event

logger = logging.getLogger(__name__)

AUDIT_RETENTION_KEY = "audit_log_retention_days"
LOGIN_RETENTION_KEY = "login_history_retention_days"


async def get_retention_policy(db: AsyncSession) -> Dict[str, Optional[int]]:
    """
    Fetch current retention policy settings.
    Returns None for a key if set to keep indefinitely (nullable).
    """
    res = await db.execute(
        select(SystemSettings).where(
            SystemSettings.key.in_([AUDIT_RETENTION_KEY, LOGIN_RETENTION_KEY])
        )
    )
    rows = {s.key: s.value for s in res.scalars().all()}

    def parse_days(val: Optional[str]) -> Optional[int]:
        if not val or val.lower() in ("null", "none", ""):
            return None
        try:
            days = int(val)
            return days if days > 0 else None
        except ValueError:
            return None

    return {
        "audit_log_retention_days": parse_days(rows.get(AUDIT_RETENTION_KEY)),
        "login_history_retention_days": parse_days(rows.get(LOGIN_RETENTION_KEY)),
    }


async def update_retention_policy(
    db: AsyncSession,
    audit_log_retention_days: Optional[int],
    login_history_retention_days: Optional[int],
    user_id: str,
    request: Optional[Request] = None,
) -> Dict[str, Optional[int]]:
    """
    Update system retention policy settings in database.
    """
    current_policy = await get_retention_policy(db)

    async def _upsert_setting(key: str, val_int: Optional[int]):
        val_str = str(val_int) if val_int is not None and val_int > 0 else "null"
        res = await db.execute(select(SystemSettings).where(SystemSettings.key == key))
        setting = res.scalar_one_or_none()
        if setting:
            setting.value = val_str
            setting.updated_by = user_id
        else:
            db.add(
                SystemSettings(
                    category=SettingCategory.RETENTION.value,
                    key=key,
                    value=val_str,
                    updated_by=user_id,
                )
            )

    await _upsert_setting(AUDIT_RETENTION_KEY, audit_log_retention_days)
    await _upsert_setting(LOGIN_RETENTION_KEY, login_history_retention_days)

    new_policy = {
        "audit_log_retention_days": audit_log_retention_days if audit_log_retention_days and audit_log_retention_days > 0 else None,
        "login_history_retention_days": login_history_retention_days if login_history_retention_days and login_history_retention_days > 0 else None,
    }

    await log_audit_event(
        db=db,
        user_id=user_id,
        action="RETENTION_SETTINGS_UPDATE",
        entity_type="SystemSettings",
        entity_id="retention_policy",
        details={"before": current_policy, "after": new_policy},
        request=request,
    )

    await db.commit()
    return new_policy


async def run_retention_pruning_job(
    db: AsyncSession,
    user_id: Optional[str] = None,
    request: Optional[Request] = None,
) -> Dict[str, int]:
    """
    Executes background pruning job to delete AuditLog and LoginHistory rows older than retention windows.
    Logs its own execution + record count to AuditLog under action='retention_pruning_executed'.
    """
    policy = await get_retention_policy(db)
    audit_days = policy.get("audit_log_retention_days")
    login_days = policy.get("login_history_retention_days")

    now = datetime.now(timezone.utc)
    audit_pruned_count = 0
    login_pruned_count = 0

    # 1. Prune AuditLogs if retention window is set
    if audit_days is not None and audit_days > 0:
        audit_cutoff = now - timedelta(days=audit_days)
        # First count matching records
        cnt_res = await db.execute(
            select(func.count(AuditLog.log_id)).where(AuditLog.created_at < audit_cutoff)
        )
        audit_pruned_count = cnt_res.scalar() or 0
        if audit_pruned_count > 0:
            await db.execute(delete(AuditLog).where(AuditLog.created_at < audit_cutoff))

    # 2. Prune LoginHistory if retention window is set
    if login_days is not None and login_days > 0:
        login_cutoff = now - timedelta(days=login_days)
        cnt_res = await db.execute(
            select(func.count(LoginHistory.id)).where(LoginHistory.logged_in_at < login_cutoff)
        )
        login_pruned_count = cnt_res.scalar() or 0
        if login_pruned_count > 0:
            await db.execute(delete(LoginHistory).where(LoginHistory.logged_in_at < login_cutoff))

    # 3. Always log audit entry for pruning job execution
    await log_audit_event(
        db=db,
        user_id=user_id,
        action="retention_pruning_executed",
        entity_type="SystemSettings",
        entity_id="retention_policy",
        details={
            "audit_logs_pruned": audit_pruned_count,
            "login_history_pruned": login_pruned_count,
            "audit_log_retention_days": audit_days,
            "login_history_retention_days": login_days,
        },
        request=request,
    )

    await db.commit()

    logger.info(
        "Retention pruning job executed successfully: %d audit logs, %d login history records pruned.",
        audit_pruned_count,
        login_pruned_count,
    )

    return {
        "audit_logs_pruned": audit_pruned_count,
        "login_history_pruned": login_pruned_count,
    }
