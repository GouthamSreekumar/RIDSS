"""
System Settings API endpoints (Administrator only).
"""
from typing import Dict, List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.db.session import get_db
from app.models.settings import SystemSettings
from app.models.user import User
from app.schemas.settings import (
    RetentionPruneResponse,
    RetentionSettingsResponse,
    RetentionSettingsUpdate,
    SystemSettingResponse,
    SystemSettingsUpdate,
)
from app.services.audit import log_audit_event
from app.services.retention import (
    get_retention_policy,
    run_retention_pruning_job,
    update_retention_policy,
)

router = APIRouter(prefix="/settings", tags=["settings"])
admin_settings_router = APIRouter(prefix="/admin/settings", tags=["admin-settings"])



@router.get("", response_model=List[SystemSettingResponse])
async def get_system_settings(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_permission("settings:read")),
) -> List[SystemSettingResponse]:
    """
    Fetch all system settings (Authentication, Email, Session). Administrator only.
    """
    res = await db.execute(select(SystemSettings).order_by(SystemSettings.category.asc(), SystemSettings.key.asc()))
    return res.scalars().all()


@router.put("", response_model=List[SystemSettingResponse])
async def update_system_settings(
    settings_in: SystemSettingsUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("settings:update")),
) -> List[SystemSettingResponse]:
    """
    Update system setting key-value pairs. Administrator only.
    """
    if not settings_in.settings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No settings key-value pairs provided.",
        )

    keys = list(settings_in.settings.keys())
    res = await db.execute(select(SystemSettings).where(SystemSettings.key.in_(keys)))
    existing_settings = {s.key: s for s in res.scalars().all()}

    updated_keys = []
    before_values = {}
    after_values = {}

    for k, v in settings_in.settings.items():
        if k in existing_settings:
            setting = existing_settings[k]
            before_values[k] = setting.value
            setting.value = str(v)
            setting.updated_by = current_user.user_id
            after_values[k] = str(v)
            updated_keys.append(k)

    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="SYSTEM_SETTINGS_UPDATE",
        entity_type="SystemSettings",
        details={"before": before_values, "after": after_values},
        request=request,
    )

    await db.commit()

    all_res = await db.execute(select(SystemSettings).order_by(SystemSettings.category.asc(), SystemSettings.key.asc()))
    return all_res.scalars().all()


@router.get("/retention", response_model=RetentionSettingsResponse)
@admin_settings_router.get("/retention", response_model=RetentionSettingsResponse)
async def get_retention_settings_endpoint(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_permission("settings:read")),
) -> RetentionSettingsResponse:
    """
    Get data retention policy (audit log retention & login history retention in days). Administrator only.
    """
    policy = await get_retention_policy(db)
    return RetentionSettingsResponse(**policy)


@router.patch("/retention", response_model=RetentionSettingsResponse)
@router.put("/retention", response_model=RetentionSettingsResponse)
@admin_settings_router.patch("/retention", response_model=RetentionSettingsResponse)
@admin_settings_router.put("/retention", response_model=RetentionSettingsResponse)
async def update_retention_settings_endpoint(
    payload: RetentionSettingsUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("settings:update")),
) -> RetentionSettingsResponse:
    """
    Update data retention policy. Administrator only.
    Null / absent indicates keep indefinitely.
    """
    new_policy = await update_retention_policy(
        db=db,
        audit_log_retention_days=payload.audit_log_retention_days,
        login_history_retention_days=payload.login_history_retention_days,
        user_id=current_user.user_id,
        request=request,
    )
    return RetentionSettingsResponse(**new_policy)


@router.post("/retention/prune", response_model=RetentionPruneResponse)
@admin_settings_router.post("/retention/prune", response_model=RetentionPruneResponse)
async def trigger_retention_pruning_endpoint(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("settings:update")),
) -> RetentionPruneResponse:
    """
    Manually trigger data retention pruning job. Administrator only.
    Logs execution + record counts to AuditLog under action='retention_pruning_executed'.
    """
    result = await run_retention_pruning_job(
        db=db,
        user_id=current_user.user_id,
        request=request,
    )
    return RetentionPruneResponse(**result)

