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
from app.schemas.settings import SystemSettingResponse, SystemSettingsUpdate
from app.services.audit import log_audit_event

router = APIRouter(prefix="/settings", tags=["settings"])


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
