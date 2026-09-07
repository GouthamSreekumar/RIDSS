"""
Notifications API endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import rbac_cache, require_permission
from app.db.session import get_db
from app.models.notification import Notification, NotificationStatus
from app.models.user import User
from app.schemas.notification import NotificationCreate, NotificationResponse, NotificationStatusUpdate
from app.services.audit import log_audit_event

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=List[NotificationResponse])
async def list_notifications(
    notification_status: Optional[str] = Query(None, alias="status", description="Filter by status (unread/read/archived)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("notifications:read")),
) -> List[NotificationResponse]:
    """
    View notifications. Enforces visibility in service layer: Administrators can view all notifications,
    regular users see only their own notifications.
    """
    stmt = select(Notification)

    # Visibility enforcement
    is_admin = rbac_cache.has_permission(current_user.role_id, "notifications:send")
    if not is_admin:
        stmt = stmt.where(Notification.user_id == current_user.user_id)

    if notification_status:
        stmt = stmt.where(Notification.status == notification_status)

    stmt = stmt.order_by(Notification.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("", response_model=List[NotificationResponse], status_code=status.HTTP_201_CREATED)
async def send_notifications(
    notification_in: NotificationCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("notifications:send")),
) -> List[NotificationResponse]:
    """
    Send notifications to target user(s).
    """
    # Verify user IDs
    users_res = await db.execute(select(User.user_id).where(User.user_id.in_(notification_in.user_ids)))
    found_user_ids = set(users_res.scalars().all())

    if len(found_user_ids) != len(set(notification_in.user_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more target user IDs do not exist.",
        )

    created_notifications = []
    for u_id in found_user_ids:
        n = Notification(
            user_id=u_id,
            title=notification_in.title,
            message=notification_in.message,
            status=NotificationStatus.UNREAD.value,
        )
        db.add(n)
        created_notifications.append(n)

    await db.flush()

    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="NOTIFICATION_SEND",
        entity_type="Notification",
        details={"target_user_ids": list(found_user_ids), "title": notification_in.title},
        request=request,
    )

    await db.commit()
    for n in created_notifications:
        await db.refresh(n)

    return created_notifications


@router.patch("/{notification_id}/archive", response_model=NotificationResponse)
@router.patch("/{notification_id}/status", response_model=NotificationResponse)
async def update_notification_status(
    notification_id: str,
    status_in: Optional[NotificationStatusUpdate] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("notifications:archive")),
) -> NotificationResponse:
    """
    Archive or mark notification as read. Enforces visibility.
    """
    res = await db.execute(select(Notification).where(Notification.notification_id == notification_id))
    notification = res.scalar_one_or_none()
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification with ID '{notification_id}' not found.",
        )

    # Visibility check
    is_admin = rbac_cache.has_permission(current_user.role_id, "notifications:send")
    if not is_admin and notification.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this notification.",
        )

    new_status = status_in.status if status_in else NotificationStatus.ARCHIVED.value
    notification.status = new_status

    await db.commit()
    await db.refresh(notification)
    return notification
