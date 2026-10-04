"""
FastAPI endpoints for Team Manager workspace.
Prefix: /api/v1/team-manager
"""
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.rbac import require_permission
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.driver import Driver
from app.models.driver_vehicle_assignment import DriverVehicleAssignment
from app.models.notification import Notification
from app.models.report import Report
from app.models.role import Role
from app.models.team import Team
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.team_manager import (
    AssignmentCreate,
    CalendarDriverResult,
    DriverSummary,
    DriverUpdateSchema,
    DriverVehicleAssignmentResponse,
    RaceCalendarEvent,
    RacePointsItem,
    RecentActivityItem,
    SeasonComparisonResponse,
    SeasonStats,
    StaffMemberItem,
    StaffUpdateSchema,
    TeamDashboardSummary,
    TeamDriverItem,
    TeamManagerCalendarResponse,
    TeamReportResponse,
    TeamVehicleItem,
    VehiclePairingHistoryItem,
    VehicleSummary,
)
from app.services.audit import log_audit_event
from app.services.mechanic_health import get_vehicle_health
from app.services.race_telemetry import get_team_driver_codes
from app.services.telemetry_provider import telemetry_provider

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/team-manager", tags=["team-manager"])


def _ensure_manager_team(user: User) -> str:
    """Helper to ensure current user has an assigned team_id."""
    if not user.team_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to any team. Contact an Administrator.",
        )
    return user.team_id


def _compute_season_stats(season: int, events: List[Dict[str, Any]]) -> SeasonStats:
    """Helper to compute season stats and race-by-race cumulative points progression."""
    race_by_race: List[RacePointsItem] = []
    running_points = 0.0
    wins_count = 0
    podiums_count = 0
    positions: List[int] = []
    races_completed = 0

    for ev in events:
        is_completed = ev.get("is_completed", False)
        driver_results = ev.get("driver_results", [])

        race_pts = 0.0
        for res in driver_results:
            pts = res.get("points")
            if pts is not None:
                try:
                    race_pts += float(pts)
                except (ValueError, TypeError):
                    pass

            if is_completed:
                pos = res.get("position")
                if pos is not None:
                    try:
                        pos_num = int(pos)
                        positions.append(pos_num)
                        if pos_num == 1:
                            wins_count += 1
                        if 1 <= pos_num <= 3:
                            podiums_count += 1
                    except (ValueError, TypeError):
                        pass

        if is_completed:
            races_completed += 1
            running_points += race_pts

        race_by_race.append(
            RacePointsItem(
                round_number=ev.get("round_number", 0),
                event_name=ev.get("event_name", "Unknown Event"),
                official_event_name=ev.get("official_event_name"),
                event_date=ev.get("event_date"),
                is_completed=is_completed,
                race_points=round(race_pts, 1),
                cumulative_points=round(running_points, 1),
            )
        )

    total_races = len(events)
    avg_pos = round(sum(positions) / len(positions), 1) if positions else None
    is_partial = races_completed < total_races

    return SeasonStats(
        season=season,
        total_points=round(running_points, 1),
        avg_finishing_position=avg_pos,
        wins_count=wins_count,
        podiums_count=podiums_count,
        races_completed=races_completed,
        total_races=total_races,
        is_partial=is_partial,
        race_by_race_points=race_by_race,
    )


# ── 1. Dashboard Endpoint ──────────────────────────────────────────────────────
@router.get("/dashboard", response_model=TeamDashboardSummary)
async def get_team_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("teams:read")),
) -> TeamDashboardSummary:
    team_id = _ensure_manager_team(current_user)

    # Fetch Team Name
    team_res = await db.execute(select(Team).where(Team.team_id == team_id))
    team = team_res.scalar_one_or_none()
    team_name = team.team_name if team else "My Team"

    # Fetch Drivers for Team (active users only)
    drivers_res = await db.execute(
        select(Driver).join(User).where(User.team_id == team_id, User.status == "active")
    )
    drivers = drivers_res.scalars().all()
    driver_count = len(drivers)

    # Fetch Vehicles for Team
    vehicles_res = await db.execute(
        select(Vehicle).where(Vehicle.team_id == team_id)
    )
    vehicles = vehicles_res.scalars().all()
    vehicle_count = len(vehicles)

    # Fetch Active Assignments for Team
    assignments_res = await db.execute(
        select(DriverVehicleAssignment).where(
            DriverVehicleAssignment.team_id == team_id,
            DriverVehicleAssignment.status == "active",
        )
    )
    active_assignments = assignments_res.scalars().all()
    active_pairings_count = len(active_assignments)

    paired_driver_ids = {a.driver_id for a in active_assignments}
    paired_vehicle_ids = {a.vehicle_id for a in active_assignments}

    unassigned_drivers_count = max(0, driver_count - len(paired_driver_ids))
    unassigned_vehicles_count = max(0, vehicle_count - len(paired_vehicle_ids))

    # Fetch Recent Activity from AuditLog filtered by team_id
    audit_res = await db.execute(
        select(AuditLog)
        .options(selectinload(AuditLog.user))
        .where(
            or_(
                AuditLog.details.like(f'%"team_id": "{team_id}"%'),
                AuditLog.user_id == current_user.user_id,
            )
        )
        .order_by(AuditLog.created_at.desc())
        .limit(15)
    )
    logs = audit_res.scalars().all()

    recent_activity: List[RecentActivityItem] = []
    for log in logs:
        parsed_details = None
        if log.details:
            try:
                parsed_details = json.loads(log.details)
            except Exception:
                parsed_details = {"raw": log.details}

        recent_activity.append(
            RecentActivityItem(
                log_id=log.log_id,
                user_id=log.user_id,
                user_name=log.user.full_name if log.user else "System",
                action=log.action,
                entity_type=log.entity_type,
                entity_id=log.entity_id,
                details=parsed_details,
                created_at=log.created_at,
            )
        )

    return TeamDashboardSummary(
        team_id=team_id,
        team_name=team_name,
        driver_count=driver_count,
        vehicle_count=vehicle_count,
        active_pairings_count=active_pairings_count,
        unassigned_drivers_count=unassigned_drivers_count,
        unassigned_vehicles_count=unassigned_vehicles_count,
        recent_activity=recent_activity,
    )


# ── 2. Team Drivers Endpoints ──────────────────────────────────────────────────
@router.get("/drivers", response_model=List[TeamDriverItem])
async def get_team_drivers(
    include_departed: bool = Query(False, description="Include departed / inactive team drivers"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("teams:read")),
) -> List[TeamDriverItem]:
    team_id = _ensure_manager_team(current_user)

    # Query Drivers belonging to this manager's team
    query = (
        select(Driver)
        .options(selectinload(Driver.user))
        .join(User)
        .where(User.team_id == team_id)
    )

    if not include_departed:
        query = query.where(User.status == "active", Driver.is_active == True)

    result = await db.execute(query)
    drivers = result.scalars().all()

    # Query Active Assignments for this team
    assignments_res = await db.execute(
        select(DriverVehicleAssignment)
        .options(selectinload(DriverVehicleAssignment.vehicle))
        .where(
            DriverVehicleAssignment.team_id == team_id,
            DriverVehicleAssignment.status == "active",
        )
    )
    active_assignments = {a.driver_id: a for a in assignments_res.scalars().all()}

    driver_items: List[TeamDriverItem] = []
    for d in drivers:
        assignment = active_assignments.get(d.driver_id)
        current_vehicle = None
        current_assignment_id = None
        if assignment and assignment.vehicle:
            v = assignment.vehicle
            v_health = await get_vehicle_health(db, v.vehicle_id)
            current_vehicle = VehicleSummary(
                vehicle_id=v.vehicle_id,
                chassis=v.chassis,
                engine=v.engine,
                status=v.status,
                health_status=v_health["health_status"],
            )
            current_assignment_id = assignment.assignment_id

        driver_items.append(
            TeamDriverItem(
                driver_id=d.driver_id,
                user_id=d.user_id,
                driver_number=d.driver_number,
                nationality=d.nationality,
                full_name=d.user.full_name if d.user else "Unknown",
                email=d.user.email if d.user else "",
                team_since=d.user.team_since if d.user else None,
                is_active=d.is_active,
                current_vehicle=current_vehicle,
                current_assignment_id=current_assignment_id,
            )
        )

    return driver_items


@router.patch("/drivers/{driver_id}", response_model=TeamDriverItem)
async def update_team_driver(
    driver_id: str,
    payload: DriverUpdateSchema,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("teams:assign_driver")),
) -> TeamDriverItem:
    team_id = _ensure_manager_team(current_user)

    result = await db.execute(
        select(Driver)
        .options(selectinload(Driver.user))
        .join(User)
        .where(Driver.driver_id == driver_id, User.team_id == team_id)
    )
    driver = result.scalar_one_or_none()
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found or does not belong to your team.",
        )

    fields_set = payload.model_fields_set if hasattr(payload, "model_fields_set") else set()

    if payload.driver_number is not None:
        driver.driver_number = payload.driver_number
    if payload.nationality is not None or "nationality" in fields_set:
        driver.nationality = payload.nationality
    if (payload.team_since is not None or "team_since" in fields_set) and driver.user:
        driver.user.team_since = payload.team_since
    if payload.is_active is not None or "is_active" in fields_set:
        driver.is_active = payload.is_active

    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="driver_updated",
        entity_type="Driver",
        entity_id=driver.driver_id,
        details={
            "driver_id": driver.driver_id,
            "driver_name": driver.user.full_name if driver.user else None,
            "team_since": str(driver.user.team_since) if (driver.user and driver.user.team_since) else None,
            "driver_number": driver.driver_number,
            "is_active": driver.is_active,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(driver)

    # Fetch active assignment if any
    assignment_res = await db.execute(
        select(DriverVehicleAssignment)
        .options(selectinload(DriverVehicleAssignment.vehicle))
        .where(
            DriverVehicleAssignment.driver_id == driver.driver_id,
            DriverVehicleAssignment.status == "active",
        )
    )
    active_assignment = assignment_res.scalar_one_or_none()
    current_vehicle = None
    current_assignment_id = None
    if active_assignment and active_assignment.vehicle:
        v = active_assignment.vehicle
        v_health = await get_vehicle_health(db, v.vehicle_id)
        current_vehicle = VehicleSummary(
            vehicle_id=v.vehicle_id,
            chassis=v.chassis,
            engine=v.engine,
            status=v.status,
            health_status=v_health["health_status"],
        )
        current_assignment_id = active_assignment.assignment_id

    return TeamDriverItem(
        driver_id=driver.driver_id,
        user_id=driver.user_id,
        driver_number=driver.driver_number,
        nationality=driver.nationality,
        full_name=driver.user.full_name if driver.user else "Unknown",
        email=driver.user.email if driver.user else "",
        team_since=driver.user.team_since if driver.user else None,
        is_active=driver.is_active,
        current_vehicle=current_vehicle,
        current_assignment_id=current_assignment_id,
    )


# ── 2b. Team Staff Directory Endpoints ───────────────────────────────────────
@router.get("/staff", response_model=List[StaffMemberItem])
async def get_team_staff(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("teams:read")),
) -> List[StaffMemberItem]:
    """
    Get all operational staff members assigned to the Team Manager's team.
    Excludes users with the Administrator role by default (team-scoped staff view).
    """
    team_id = _ensure_manager_team(current_user)

    query = (
        select(User)
        .options(selectinload(User.role), selectinload(User.driver_profile))
        .join(Role)
        .where(
            User.team_id == team_id,
            Role.role_name != "Administrator",
        )
        .order_by(Role.role_name, User.full_name)
    )

    result = await db.execute(query)
    users = result.scalars().all()

    staff_list: List[StaffMemberItem] = []
    for u in users:
        d_profile = u.driver_profile
        staff_list.append(
            StaffMemberItem(
                user_id=u.user_id,
                full_name=u.full_name,
                email=u.email,
                role_id=u.role_id,
                role_name=u.role.role_name if u.role else "Staff",
                status=u.status,
                team_since=u.team_since,
                driver_number=d_profile.driver_number if d_profile else None,
                fastf1_code=d_profile.fastf1_code if d_profile else None,
                nationality=d_profile.nationality if d_profile else None,
            )
        )

    return staff_list


@router.patch("/staff/{user_id}", response_model=StaffMemberItem)
async def update_team_staff_member(
    user_id: str,
    payload: StaffUpdateSchema,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("teams:assign_driver")),
) -> StaffMemberItem:
    """
    Update staff member details (including team_since tenure date).
    """
    team_id = _ensure_manager_team(current_user)

    result = await db.execute(
        select(User)
        .options(selectinload(User.role), selectinload(User.driver_profile))
        .where(User.user_id == user_id, User.team_id == team_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff member not found or does not belong to your team.",
        )

    fields_set = payload.model_fields_set if hasattr(payload, "model_fields_set") else set()

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.status is not None:
        user.status = payload.status
    if payload.team_since is not None or "team_since" in fields_set:
        user.team_since = payload.team_since

    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="staff_tenure_updated",
        entity_type="User",
        entity_id=user.user_id,
        details={
            "user_id": user.user_id,
            "full_name": user.full_name,
            "role": user.role.role_name if user.role else None,
            "team_since": str(user.team_since) if user.team_since else None,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(user)

    d_profile = user.driver_profile
    return StaffMemberItem(
        user_id=user.user_id,
        full_name=user.full_name,
        email=user.email,
        role_id=user.role_id,
        role_name=user.role.role_name if user.role else "Staff",
        status=user.status,
        team_since=user.team_since,
        driver_number=d_profile.driver_number if d_profile else None,
        fastf1_code=d_profile.fastf1_code if d_profile else None,
        nationality=d_profile.nationality if d_profile else None,
    )


# ── 3. Team Vehicles Endpoints ──────────────────────────────────────────────────
@router.get("/vehicles", response_model=List[TeamVehicleItem])
async def get_team_vehicles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("teams:read")),
) -> List[TeamVehicleItem]:
    team_id = _ensure_manager_team(current_user)

    # Query Vehicles belonging to this manager's team
    result = await db.execute(select(Vehicle).where(Vehicle.team_id == team_id))
    vehicles = result.scalars().all()

    # Query Active Assignments for this team
    assignments_res = await db.execute(
        select(DriverVehicleAssignment)
        .options(
            selectinload(DriverVehicleAssignment.driver).selectinload(Driver.user)
        )
        .where(
            DriverVehicleAssignment.team_id == team_id,
            DriverVehicleAssignment.status == "active",
        )
    )
    active_assignments = {a.vehicle_id: a for a in assignments_res.scalars().all()}

    vehicle_items: List[TeamVehicleItem] = []
    for v in vehicles:
        assignment = active_assignments.get(v.vehicle_id)
        v_health = await get_vehicle_health(db, v.vehicle_id)
        current_driver = None
        current_assignment_id = None
        if assignment and assignment.driver:
            d = assignment.driver
            current_driver = DriverSummary(
                driver_id=d.driver_id,
                user_id=d.user_id,
                driver_number=d.driver_number,
                nationality=d.nationality,
                team_since=d.user.team_since if d.user else None,
                full_name=d.user.full_name if d.user else "Unknown",
            )
            current_assignment_id = assignment.assignment_id

        vehicle_items.append(
            TeamVehicleItem(
                vehicle_id=v.vehicle_id,
                team_id=v.team_id,
                chassis=v.chassis,
                engine=v.engine,
                status=v.status,
                health_status=v_health["health_status"],
                current_driver=current_driver,
                current_assignment_id=current_assignment_id,
            )
        )

    return vehicle_items


@router.get("/vehicles/{vehicle_id}/pairing-history", response_model=List[VehiclePairingHistoryItem])
async def get_vehicle_pairing_history(
    vehicle_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("teams:read")),
) -> List[VehiclePairingHistoryItem]:
    """Returns all assignment records (active and inactive) for a specific vehicle ordered most recent first."""
    team_id = _ensure_manager_team(current_user)

    v_res = await db.execute(select(Vehicle).where(Vehicle.vehicle_id == vehicle_id, Vehicle.team_id == team_id))
    vehicle = v_res.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found or does not belong to your team.",
        )

    query = (
        select(DriverVehicleAssignment)
        .options(
            selectinload(DriverVehicleAssignment.driver).selectinload(Driver.user)
        )
        .where(
            DriverVehicleAssignment.vehicle_id == vehicle_id,
            DriverVehicleAssignment.team_id == team_id,
        )
        .order_by(DriverVehicleAssignment.assigned_at.desc())
    )

    result = await db.execute(query)
    assignments = result.scalars().all()

    history: List[VehiclePairingHistoryItem] = []
    for a in assignments:
        driver_name = "Unknown Driver"
        driver_num = 0
        if a.driver:
            driver_num = a.driver.driver_number
            if a.driver.user:
                driver_name = a.driver.user.full_name

        history.append(
            VehiclePairingHistoryItem(
                assignment_id=a.assignment_id,
                vehicle_id=a.vehicle_id,
                driver_id=a.driver_id,
                driver_name=driver_name,
                driver_number=driver_num,
                assigned_at=a.assigned_at,
                unassigned_at=a.unassigned_at,
                status=a.status,
                season=a.season,
            )
        )

    return history


# ── 4. Create Driver-Vehicle Assignment ─────────────────────────────────────────
@router.post(
    "/assignments",
    response_model=DriverVehicleAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def assign_driver_to_vehicle(
    payload: AssignmentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("teams:assign_driver")),
) -> DriverVehicleAssignmentResponse:
    team_id = _ensure_manager_team(current_user)

    # 1. Validate Driver belongs to this manager's team and is currently active
    driver_res = await db.execute(
        select(Driver)
        .options(selectinload(Driver.user))
        .where(Driver.driver_id == payload.driver_id)
    )
    driver = driver_res.scalar_one_or_none()
    if not driver or not driver.user or driver.user.team_id != team_id or driver.user.status != "active" or not driver.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Driver does not exist, is inactive/departed, or does not belong to your team.",
        )

    # 2. Validate Vehicle belongs to this manager's team
    vehicle_res = await db.execute(
        select(Vehicle).where(Vehicle.vehicle_id == payload.vehicle_id)
    )
    vehicle = vehicle_res.scalar_one_or_none()
    if not vehicle or vehicle.team_id != team_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vehicle does not exist or does not belong to your team.",
        )

    # 2b. CRITICAL Integration Check: Block driver assignment if vehicle health is CRITICAL
    health_info = await get_vehicle_health(db, payload.vehicle_id)
    if health_info["health_status"] == "critical":
        crit_list = ", ".join(health_info["critical_components"]) if health_info["critical_components"] else "one or more components"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vehicle '{vehicle.chassis}' cannot be assigned to a driver because its health status is CRITICAL due to component(s): {crit_list}. Complete required maintenance before assignment.",
        )

    now_utc = datetime.now(timezone.utc)

    # 3. Deactivate any existing active assignments for this driver or vehicle
    existing_res = await db.execute(
        select(DriverVehicleAssignment).where(
            DriverVehicleAssignment.team_id == team_id,
            DriverVehicleAssignment.status == "active",
            or_(
                DriverVehicleAssignment.driver_id == payload.driver_id,
                DriverVehicleAssignment.vehicle_id == payload.vehicle_id,
            ),
        )
    )
    existing_assignments = existing_res.scalars().all()
    for existing in existing_assignments:
        existing.status = "inactive"
        existing.unassigned_at = now_utc

    # 4. Create new active assignment
    new_assignment = DriverVehicleAssignment(
        team_id=team_id,
        driver_id=payload.driver_id,
        vehicle_id=payload.vehicle_id,
        season=payload.season or 2026,
        status="active",
        assigned_at=now_utc,
    )
    db.add(new_assignment)
    await db.flush()

    # 5. Log to shared AuditLog table
    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="assignment_created",
        entity_type="DriverVehicleAssignment",
        entity_id=new_assignment.assignment_id,
        details={
            "team_id": team_id,
            "driver_id": payload.driver_id,
            "vehicle_id": payload.vehicle_id,
            "driver_name": driver.user.full_name,
            "vehicle_chassis": vehicle.chassis,
            "season": new_assignment.season,
        },
        request=request,
    )

    # 6. Create Notification for driver's user_id
    notification = Notification(
        user_id=driver.user_id,
        title="Vehicle Assignment Updated",
        message=f"You have been assigned to car #{driver.driver_number} ({vehicle.chassis} / {vehicle.engine}) for season {new_assignment.season}.",
        status="unread",
        reference_type="assignment",
        reference_id=new_assignment.assignment_id,
        created_at=now_utc,
    )
    db.add(notification)

    await db.commit()
    await db.refresh(new_assignment)

    return DriverVehicleAssignmentResponse(
        assignment_id=new_assignment.assignment_id,
        team_id=new_assignment.team_id,
        driver_id=new_assignment.driver_id,
        vehicle_id=new_assignment.vehicle_id,
        status=new_assignment.status,
        assigned_at=new_assignment.assigned_at,
        unassigned_at=new_assignment.unassigned_at,
        season=new_assignment.season,
        driver=DriverSummary(
            driver_id=driver.driver_id,
            user_id=driver.user_id,
            driver_number=driver.driver_number,
            full_name=driver.user.full_name,
            nationality=driver.nationality,
            team_since=driver.user.team_since if driver.user else None,
        ),
        vehicle=VehicleSummary(
            vehicle_id=vehicle.vehicle_id,
            chassis=vehicle.chassis,
            engine=vehicle.engine,
            status=vehicle.status,
        ),
    )


# ── 5. Delete (Unassign) Driver-Vehicle Assignment ──────────────────────────────
@router.delete("/assignments/{assignment_id}")
async def unassign_driver(
    assignment_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("teams:assign_driver")),
) -> Dict[str, str]:
    team_id = _ensure_manager_team(current_user)

    result = await db.execute(
        select(DriverVehicleAssignment)
        .options(
            selectinload(DriverVehicleAssignment.driver).selectinload(Driver.user),
            selectinload(DriverVehicleAssignment.vehicle),
        )
        .where(
            DriverVehicleAssignment.assignment_id == assignment_id,
            DriverVehicleAssignment.team_id == team_id,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found or does not belong to your team.",
        )

    now_utc = datetime.now(timezone.utc)
    assignment.status = "inactive"
    assignment.unassigned_at = now_utc

    # Log to shared AuditLog
    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="assignment_removed",
        entity_type="DriverVehicleAssignment",
        entity_id=assignment.assignment_id,
        details={
            "team_id": team_id,
            "driver_id": assignment.driver_id,
            "vehicle_id": assignment.vehicle_id,
            "driver_name": assignment.driver.user.full_name if assignment.driver and assignment.driver.user else None,
            "vehicle_chassis": assignment.vehicle.chassis if assignment.vehicle else None,
        },
        request=request,
    )

    # Create notification for driver
    if assignment.driver and assignment.driver.user:
        notification = Notification(
            user_id=assignment.driver.user_id,
            title="Vehicle Assignment Updated",
            message=f"Your vehicle assignment (Chassis: {assignment.vehicle.chassis if assignment.vehicle else 'N/A'}) has been unassigned.",
            status="unread",
            reference_type="assignment",
            reference_id=assignment.assignment_id,
            created_at=now_utc,
        )
        db.add(notification)

    await db.commit()

    return {"message": "Driver unassigned successfully."}


# ── 6. List Assignments Endpoint ────────────────────────────────────────────────
@router.get("/assignments", response_model=List[DriverVehicleAssignmentResponse])
async def list_assignments(
    include_history: bool = Query(False, description="Include past inactive assignments"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("teams:read")),
) -> List[DriverVehicleAssignmentResponse]:
    team_id = _ensure_manager_team(current_user)

    query = (
        select(DriverVehicleAssignment)
        .options(
            selectinload(DriverVehicleAssignment.driver).selectinload(Driver.user),
            selectinload(DriverVehicleAssignment.vehicle),
        )
        .where(DriverVehicleAssignment.team_id == team_id)
    )

    if not include_history:
        query = query.where(DriverVehicleAssignment.status == "active")

    query = query.order_by(DriverVehicleAssignment.assigned_at.desc())

    result = await db.execute(query)
    assignments = result.scalars().all()

    response_items = []
    for a in assignments:
        d_summary = None
        if a.driver:
            d_summary = DriverSummary(
                driver_id=a.driver.driver_id,
                user_id=a.driver.user_id,
                driver_number=a.driver.driver_number,
                full_name=a.driver.user.full_name if a.driver.user else "Unknown",
                nationality=a.driver.nationality,
                team_since=a.driver.user.team_since if (a.driver and a.driver.user) else None,
            )
        v_summary = None
        if a.vehicle:
            v_summary = VehicleSummary(
                vehicle_id=a.vehicle.vehicle_id,
                chassis=a.vehicle.chassis,
                engine=a.vehicle.engine,
                status=a.vehicle.status,
            )
        response_items.append(
            DriverVehicleAssignmentResponse(
                assignment_id=a.assignment_id,
                team_id=a.team_id,
                driver_id=a.driver_id,
                vehicle_id=a.vehicle_id,
                status=a.status,
                assigned_at=a.assigned_at,
                unassigned_at=a.unassigned_at,
                season=a.season,
                driver=d_summary,
                vehicle=v_summary,
            )
        )

    return response_items


# ── 7. Generate Team Report Endpoint ───────────────────────────────────────────
@router.post(
    "/reports",
    response_model=TeamReportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def generate_team_report(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports:team")),
) -> TeamReportResponse:
    team_id = _ensure_manager_team(current_user)

    # Fetch Team Name
    team_res = await db.execute(select(Team).where(Team.team_id == team_id))
    team = team_res.scalar_one_or_none()
    team_name = team.team_name if team else "My Team"

    # Fetch Team Drivers (active users only)
    drivers_res = await db.execute(
        select(Driver)
        .options(selectinload(Driver.user))
        .join(User)
        .where(User.team_id == team_id, User.status == "active")
    )
    drivers = drivers_res.scalars().all()

    # Fetch Team Vehicles
    vehicles_res = await db.execute(
        select(Vehicle).where(Vehicle.team_id == team_id)
    )
    vehicles = vehicles_res.scalars().all()

    # Fetch Active Assignments
    assignments_res = await db.execute(
        select(DriverVehicleAssignment)
        .options(
            selectinload(DriverVehicleAssignment.driver).selectinload(Driver.user),
            selectinload(DriverVehicleAssignment.vehicle),
        )
        .where(
            DriverVehicleAssignment.team_id == team_id,
            DriverVehicleAssignment.status == "active",
        )
    )
    active_assignments = assignments_res.scalars().all()

    # Snapshot JSON content
    data_snapshot = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "team_id": team_id,
        "team_name": team_name,
        "summary": {
            "total_drivers": len(drivers),
            "total_vehicles": len(vehicles),
            "active_pairings": len(active_assignments),
        },
        "drivers": [
            {
                "driver_id": d.driver_id,
                "driver_number": d.driver_number,
                "full_name": d.user.full_name if d.user else "Unknown",
                "email": d.user.email if d.user else "",
                "nationality": d.nationality,
                "team_since": str(d.user.team_since) if (d.user and d.user.team_since) else None,
            }
            for d in drivers
        ],
        "vehicles": [
            {
                "vehicle_id": v.vehicle_id,
                "chassis": v.chassis,
                "engine": v.engine,
                "status": v.status,
            }
            for v in vehicles
        ],
        "pairings": [
            {
                "assignment_id": a.assignment_id,
                "driver_number": a.driver.driver_number if a.driver else None,
                "driver_name": a.driver.user.full_name if a.driver and a.driver.user else "Unknown",
                "vehicle_chassis": a.vehicle.chassis if a.vehicle else "Unknown",
                "vehicle_engine": a.vehicle.engine if a.vehicle else "Unknown",
                "season": a.season,
                "assigned_at": a.assigned_at.isoformat(),
                "unassigned_at": a.unassigned_at.isoformat() if a.unassigned_at else None,
            }
            for a in active_assignments
        ],
    }

    report = Report(
        generated_by=current_user.user_id,
        team_id=team_id,
        report_type="team",
        data=data_snapshot,
        created_at=datetime.now(timezone.utc),
    )
    db.add(report)
    await db.flush()

    # Log to shared AuditLog table
    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="report_generated",
        entity_type="Report",
        entity_id=report.report_id,
        details={
            "team_id": team_id,
            "report_id": report.report_id,
            "report_type": "team",
        },
        request=request,
    )

    await db.commit()
    await db.refresh(report)

    return TeamReportResponse(
        report_id=report.report_id,
        team_id=report.team_id,
        generated_by=report.generated_by,
        generator_name=current_user.full_name,
        report_type=report.report_type,
        created_at=report.created_at,
        data=report.data,
    )


# ── 8. List Past Team Reports Endpoint ─────────────────────────────────────────
@router.get("/reports", response_model=List[TeamReportResponse])
async def get_team_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports:team")),
) -> List[TeamReportResponse]:
    team_id = _ensure_manager_team(current_user)

    result = await db.execute(
        select(Report)
        .options(selectinload(Report.generator))
        .where(Report.team_id == team_id, Report.report_type == "team")
        .order_by(Report.created_at.desc())
    )
    reports = result.scalars().all()

    return [
        TeamReportResponse(
            report_id=r.report_id,
            team_id=r.team_id,
            generated_by=r.generated_by,
            generator_name=r.generator.full_name if r.generator else "System",
            report_type=r.report_type,
            created_at=r.created_at,
            data=r.data,
        )
        for r in reports
    ]


# ── 9. Team Manager Race Calendar Endpoint ──────────────────────────────────────
@router.get("/calendar", response_model=TeamManagerCalendarResponse)
async def get_team_manager_calendar(
    season: Optional[int] = Query(None, description="Season year (defaults to current dynamic season)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("teams:read")),
) -> TeamManagerCalendarResponse:
    team_id = _ensure_manager_team(current_user)

    # Fetch Team Name
    team_res = await db.execute(select(Team).where(Team.team_id == team_id))
    team = team_res.scalar_one_or_none()
    team_name = team.team_name if team else "My Team"

    # Get dynamic available seasons
    available_seasons = telemetry_provider.get_seasons()

    target_season = season
    if not target_season or target_season not in available_seasons:
        target_season = available_seasons[-1] if available_seasons else datetime.now(timezone.utc).year

    events_raw = await telemetry_provider.get_season_calendar_events(target_season, team_name=team_name)

    events: List[RaceCalendarEvent] = []
    for ev in events_raw:
        driver_results = [
            CalendarDriverResult(
                driver_code=res["driver_code"],
                driver_number=res["driver_number"],
                full_name=res.get("full_name"),
                position=res.get("position"),
                position_text=res.get("position_text"),
                points=res.get("points"),
                status=res.get("status"),
            )
            for res in ev.get("driver_results", [])
        ]

        events.append(
            RaceCalendarEvent(
                round_number=ev["round_number"],
                country=ev["country"],
                location=ev["location"],
                event_name=ev["event_name"],
                official_event_name=ev.get("official_event_name"),
                event_date=ev.get("event_date"),
                format=ev.get("format"),
                is_completed=ev["is_completed"],
                driver_results=driver_results,
            )
        )

    return TeamManagerCalendarResponse(
        season=target_season,
        available_seasons=available_seasons,
        team_name=team_name,
        events=events,
    )


# ── 10. Season-over-Season Comparison Endpoint ────────────────────────────────
@router.get("/season-comparison", response_model=SeasonComparisonResponse)
async def get_season_comparison(
    season_a: Optional[int] = Query(None, description="First season year to compare"),
    season_b: Optional[int] = Query(None, description="Second season year to compare"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("teams:read")),
) -> SeasonComparisonResponse:
    team_id = _ensure_manager_team(current_user)

    # Fetch Team Name
    team_res = await db.execute(select(Team).where(Team.team_id == team_id))
    team = team_res.scalar_one_or_none()
    team_name = team.team_name if team else "My Team"

    available_seasons = telemetry_provider.get_seasons()

    # Determine dynamic defaults: current season vs. immediately preceding one
    target_a = season_a
    if not target_a or target_a not in available_seasons:
        target_a = available_seasons[-1] if available_seasons else datetime.now(timezone.utc).year

    target_b = season_b
    if not target_b or target_b not in available_seasons:
        if target_a in available_seasons:
            idx = available_seasons.index(target_a)
            if idx > 0:
                target_b = available_seasons[idx - 1]
            else:
                target_b = available_seasons[1] if len(available_seasons) > 1 else (target_a - 1)
        else:
            target_b = target_a - 1

    events_a_raw = await telemetry_provider.get_season_calendar_events(target_a, team_name=team_name)
    events_b_raw = await telemetry_provider.get_season_calendar_events(target_b, team_name=team_name)

    stats_a = _compute_season_stats(target_a, events_a_raw)
    stats_b = _compute_season_stats(target_b, events_b_raw)

    return SeasonComparisonResponse(
        team_id=team_id,
        team_name=team_name,
        season_a=target_a,
        season_b=target_b,
        available_seasons=available_seasons,
        stats_a=stats_a,
        stats_b=stats_b,
    )
