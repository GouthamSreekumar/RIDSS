"""
FastAPI endpoints for Driver Module workspace.
Prefix: /api/v1/driver
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.rbac import require_permission
from app.db.session import get_db
from app.models.driver import Driver
from app.models.notification import Notification, NotificationStatus
from app.models.report import Report
from app.models.user import User
from app.schemas.driver import (
    DriverDashboardResponse,
    DriverReportResponse,
    DriverSessionHistoryResponse,
    DriverSessionItem,
)
from app.schemas.notification import NotificationResponse
from app.services.telemetry_provider import telemetry_provider

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/driver", tags=["driver"])


async def _get_current_driver(db: AsyncSession, user_id: str) -> Driver:
    """Helper to fetch and validate the driver profile for the logged-in user."""
    res = await db.execute(
        select(Driver)
        .options(selectinload(Driver.user))
        .where(Driver.user_id == user_id)
    )
    driver = res.scalar_one_or_none()
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found for this user account.",
        )
    return driver


# ── 1. Driver Dashboard ────────────────────────────────────────────────────────
@router.get("/dashboard", response_model=DriverDashboardResponse)
async def get_driver_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("driver:read_dashboard")),
) -> DriverDashboardResponse:
    driver = await _get_current_driver(db, current_user.user_id)
    driver_code = (driver.fastf1_code or "").upper()
    driver_num = driver.fastf1_driver_number or driver.driver_number

    # Resolve dynamic season list and active season
    available_seasons = telemetry_provider.get_seasons()
    active_season = available_seasons[-1] if available_seasons else datetime.now(timezone.utc).year

    # Query completed races for the active season using shared telemetry service
    events_raw = await telemetry_provider.get_season_calendar_events(
        active_season, filter_driver_codes=[driver_code] if driver_code else None
    )

    season_points = 0.0
    last_position = None
    last_position_text = None
    last_session_date = None

    # Process season events for driver points and last result
    completed_races_with_driver = []
    for ev in events_raw:
        if not ev.get("is_completed"):
            continue

        raw_results = ev.get("driver_results", [])
        driver_res = None
        for res in raw_results:
            d_c = (res.get("driver_code") or "").upper()
            d_n = res.get("driver_number")
            if driver_code:
                if d_c == driver_code:
                    driver_res = res
                    break
            elif driver_num and d_n == driver_num:
                driver_res = res
                break

        if driver_res:
            pts = driver_res.get("points")
            if pts is not None:
                try:
                    season_points += float(pts)
                except (ValueError, TypeError):
                    pass
            completed_races_with_driver.append((ev, driver_res))

    if completed_races_with_driver:
        last_ev, last_res = completed_races_with_driver[-1]
        last_position = last_res.get("position")
        last_position_text = last_res.get("position_text") or (f"P{last_position}" if last_position else "DNF")
        last_session_date = last_ev.get("event_date")

    # Fetch recent notifications for this driver's user_id only
    notif_res = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.user_id)
        .order_by(Notification.created_at.desc())
        .limit(5)
    )
    recent_notifications = [
        NotificationResponse.model_validate(n) for n in notif_res.scalars().all()
    ]

    # Fetch recent reports for this driver only
    reports_res = await db.execute(
        select(Report)
        .options(selectinload(Report.generator))
        .where(
            Report.report_type == "engineering",
            or_(
                Report.data["target_driver_user_id"].as_string() == current_user.user_id,
                Report.data["driver_code"].as_string().ilike(driver_code),
                Report.data["driver_id"].as_string() == driver.driver_id,
            ),
        )
        .order_by(Report.created_at.desc())
        .limit(5)
    )
    recent_reports = [
        DriverReportResponse(
            report_id=r.report_id,
            team_id=r.team_id,
            generated_by=r.generated_by,
            generator_name=r.generator.full_name if r.generator else "System",
            report_type=r.report_type,
            created_at=r.created_at,
            data=r.data or {},
        )
        for r in reports_res.scalars().all()
    ]

    return DriverDashboardResponse(
        driver_id=driver.driver_id,
        user_id=driver.user_id,
        driver_name=current_user.full_name,
        fastf1_code=driver.fastf1_code,
        driver_number=driver.driver_number,
        nationality=driver.nationality,
        current_season_points=round(season_points, 1),
        last_race_position=last_position,
        last_race_position_text=last_position_text,
        last_session_date=last_session_date,
        recent_notifications=recent_notifications,
        recent_reports=recent_reports,
    )


# ── 2. List Driver Performance Reports ──────────────────────────────────────────
@router.get("/reports", response_model=List[DriverReportResponse])
async def get_driver_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports:own")),
) -> List[DriverReportResponse]:
    driver = await _get_current_driver(db, current_user.user_id)
    driver_code = (driver.fastf1_code or "").upper()

    # STRICT SERVER-SIDE FILTER: Return reports where Report.data references this logged-in driver only
    result = await db.execute(
        select(Report)
        .options(selectinload(Report.generator))
        .where(
            Report.report_type == "engineering",
            or_(
                Report.data["target_driver_user_id"].as_string() == current_user.user_id,
                Report.data["driver_code"].as_string().ilike(driver_code),
                Report.data["driver_id"].as_string() == driver.driver_id,
            ),
        )
        .order_by(Report.created_at.desc())
    )
    reports = result.scalars().all()

    return [
        DriverReportResponse(
            report_id=r.report_id,
            team_id=r.team_id,
            generated_by=r.generated_by,
            generator_name=r.generator.full_name if r.generator else "System",
            report_type=r.report_type,
            created_at=r.created_at,
            data=r.data or {},
        )
        for r in reports
    ]


# ── 3. Get Report Detail View ──────────────────────────────────────────────────
@router.get("/reports/{report_id}", response_model=DriverReportResponse)
async def get_driver_report_detail(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports:own")),
) -> DriverReportResponse:
    driver = await _get_current_driver(db, current_user.user_id)
    driver_code = (driver.fastf1_code or "").upper()

    res = await db.execute(
        select(Report)
        .options(selectinload(Report.generator))
        .where(Report.report_id == report_id)
    )
    report = res.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with ID '{report_id}' not found.",
        )

    # STRICT SERVER-SIDE OWNERSHIP VALIDATION: Check that this report belongs to the logged-in driver
    rep_data = report.data or {}
    target_user_id = rep_data.get("target_driver_user_id")
    rep_driver_code = (rep_data.get("driver_code") or "").upper()
    rep_driver_id = rep_data.get("driver_id")

    is_owner = (
        target_user_id == current_user.user_id
        or (driver_code and rep_driver_code == driver_code)
        or (rep_driver_id and rep_driver_id == driver.driver_id)
    )

    if not is_owner:
        logger.warning(
            "Security violation attempt: User %s (Driver %s) tried to access report %s belonging to another driver.",
            current_user.user_id,
            driver_code,
            report_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only view your own performance reports.",
        )

    return DriverReportResponse(
        report_id=report.report_id,
        team_id=report.team_id,
        generated_by=report.generated_by,
        generator_name=report.generator.full_name if report.generator else "System",
        report_type=report.report_type,
        created_at=report.created_at,
        data=rep_data,
    )


# ── 4. Driver Session History ──────────────────────────────────────────────────
@router.get("/sessions", response_model=DriverSessionHistoryResponse)
async def get_driver_sessions(
    season: Optional[int] = Query(None, description="Season year (defaults to current dynamic season)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("sessions:own")),
) -> DriverSessionHistoryResponse:
    driver = await _get_current_driver(db, current_user.user_id)
    driver_code = (driver.fastf1_code or "").upper()
    driver_num = driver.fastf1_driver_number or driver.driver_number

    available_seasons = telemetry_provider.get_seasons()
    target_season = season
    if not target_season or target_season not in available_seasons:
        target_season = available_seasons[-1] if available_seasons else datetime.now(timezone.utc).year

    # Reuse shared season-aware filtering logic via telemetry_provider
    events_raw = await telemetry_provider.get_season_calendar_events(
        target_season, filter_driver_codes=[driver_code] if driver_code else None
    )

    session_items: List[DriverSessionItem] = []
    for ev in events_raw:
        raw_results = ev.get("driver_results", [])
        driver_res = None
        for res in raw_results:
            d_c = (res.get("driver_code") or "").upper()
            d_n = res.get("driver_number")
            if driver_code:
                if d_c == driver_code:
                    driver_res = res
                    break
            elif driver_num and d_n == driver_num:
                driver_res = res
                break

        pos = driver_res.get("position") if driver_res else None
        pos_text = driver_res.get("position_text") if driver_res else None
        pts = driver_res.get("points") if driver_res else None
        stat = driver_res.get("status") if driver_res else None

        session_items.append(
            DriverSessionItem(
                round_number=ev["round_number"],
                country=ev["country"],
                location=ev["location"],
                event_name=ev["event_name"],
                official_event_name=ev.get("official_event_name"),
                event_date=ev.get("event_date"),
                session_type="Race",
                position=pos,
                position_text=pos_text,
                points=float(pts) if pts is not None else None,
                status=stat,
            )
        )

    return DriverSessionHistoryResponse(
        season=target_season,
        available_seasons=available_seasons,
        driver_code=driver.fastf1_code or str(driver.driver_number),
        driver_name=current_user.full_name,
        sessions=session_items,
    )


# ── 5. Driver Notifications List ───────────────────────────────────────────────
@router.get("/notifications", response_model=List[NotificationResponse])
async def get_driver_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("notifications:own")),
) -> List[NotificationResponse]:
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.user_id)
        .order_by(Notification.created_at.desc())
    )
    notifications = result.scalars().all()
    return [NotificationResponse.model_validate(n) for n in notifications]


# ── 6. Mark Notification as Read ───────────────────────────────────────────────
@router.patch("/notifications/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_as_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("notifications:own")),
) -> NotificationResponse:
    res = await db.execute(
        select(Notification).where(Notification.notification_id == notification_id)
    )
    notification = res.scalar_one_or_none()

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification with ID '{notification_id}' not found.",
        )

    # STRICT SERVER-SIDE OWNERSHIP VALIDATION
    if notification.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only update your own notifications.",
        )

    notification.status = NotificationStatus.READ.value
    await db.commit()
    await db.refresh(notification)

    return NotificationResponse.model_validate(notification)
