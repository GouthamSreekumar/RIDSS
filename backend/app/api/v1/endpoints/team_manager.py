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
from app.models.team import Team
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.team_manager import (
    AssignmentCreate,
    DriverSummary,
    DriverVehicleAssignmentResponse,
    RecentActivityItem,
    TeamDashboardSummary,
    TeamDriverItem,
    TeamReportResponse,
    TeamVehicleItem,
    VehicleSummary,
)
from app.services.audit import log_audit_event

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


# ── 2. Team Drivers Endpoint ──────────────────────────────────────────────────
@router.get("/drivers", response_model=List[TeamDriverItem])
async def get_team_drivers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("teams:read")),
) -> List[TeamDriverItem]:
    team_id = _ensure_manager_team(current_user)

    # Query Drivers belonging to this manager's team (active users only)
    result = await db.execute(
        select(Driver)
        .options(selectinload(Driver.user))
        .join(User)
        .where(User.team_id == team_id, User.status == "active")
    )

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
            current_vehicle = VehicleSummary(
                vehicle_id=v.vehicle_id,
                chassis=v.chassis,
                engine=v.engine,
                status=v.status,
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
                current_vehicle=current_vehicle,
                current_assignment_id=current_assignment_id,
            )
        )

    return driver_items


# ── 3. Team Vehicles Endpoint ──────────────────────────────────────────────────
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
        current_driver = None
        current_assignment_id = None
        if assignment and assignment.driver:
            d = assignment.driver
            current_driver = DriverSummary(
                driver_id=d.driver_id,
                user_id=d.user_id,
                driver_number=d.driver_number,
                nationality=d.nationality,
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
                current_driver=current_driver,
                current_assignment_id=current_assignment_id,
            )
        )

    return vehicle_items


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

    # 1. Validate Driver belongs to this manager's team
    driver_res = await db.execute(
        select(Driver)
        .options(selectinload(Driver.user))
        .where(Driver.driver_id == payload.driver_id)
    )
    driver = driver_res.scalar_one_or_none()
    if not driver or not driver.user or driver.user.team_id != team_id or driver.user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Driver does not exist, is disabled, or does not belong to your team.",
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

    # 4. Create new active assignment
    new_assignment = DriverVehicleAssignment(
        team_id=team_id,
        driver_id=payload.driver_id,
        vehicle_id=payload.vehicle_id,
        season=payload.season or 2026,
        status="active",
        assigned_at=datetime.now(timezone.utc),
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
        created_at=datetime.now(timezone.utc),
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
        season=new_assignment.season,
        driver=DriverSummary(
            driver_id=driver.driver_id,
            user_id=driver.user_id,
            driver_number=driver.driver_number,
            full_name=driver.user.full_name,
            nationality=driver.nationality,
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

    assignment.status = "inactive"

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
            created_at=datetime.now(timezone.utc),
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

    # CRITICAL: Filter explicitly by this manager's team_id in the query itself
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
