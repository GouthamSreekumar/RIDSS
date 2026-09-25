"""
FastAPI endpoints for Mechanic Module workspace.
Prefix: /api/v1/mechanic
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
from app.models.component_maintenance import Component, Maintenance, MaintenanceStatus
from app.models.driver import Driver
from app.models.driver_vehicle_assignment import DriverVehicleAssignment
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.mechanic import (
    ComponentCreate,
    ComponentResponse,
    ComponentStatusUpdate,
    MaintenanceCreate,
    MaintenanceResponse,
    MaintenanceUpdate,
    MechanicDashboardSummary,
    VehicleComponentDetailResponse,
    VehicleHealthSummary,
)
from app.services.audit import log_audit_event
from app.services.mechanic_health import (
    get_vehicle_health,
    notify_team_managers_on_critical_health,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/mechanic", tags=["mechanic"])


# ── Helper ───────────────────────────────────────────────────────────────────
def _get_user_team_filter(user: User):
    """Returns team_id if set on user, or None."""
    return user.team_id


# ── 1. Dashboard Endpoint ───────────────────────────────────────────────────
@router.get("/dashboard", response_model=MechanicDashboardSummary)
async def get_mechanic_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("vehicles:read")),
) -> MechanicDashboardSummary:
    team_id = _get_user_team_filter(current_user)

    # Fetch vehicles
    veh_query = select(Vehicle)
    if team_id:
        veh_query = veh_query.where(Vehicle.team_id == team_id)
    veh_res = await db.execute(veh_query)
    vehicles = veh_res.scalars().all()

    total_vehicles = len(vehicles)
    good_count = 0
    needs_attention_count = 0
    critical_count = 0

    for v in vehicles:
        health_info = await get_vehicle_health(db, v.vehicle_id)
        hs = health_info["health_status"]
        if hs == "critical":
            critical_count += 1
        elif hs == "needs_attention":
            needs_attention_count += 1
        else:
            good_count += 1

    # Fetch upcoming maintenance (scheduled or in_progress)
    maint_query = (
        select(Maintenance)
        .options(selectinload(Maintenance.vehicle), selectinload(Maintenance.mechanic))
        .where(Maintenance.status.in_([MaintenanceStatus.SCHEDULED.value, MaintenanceStatus.IN_PROGRESS.value]))
    )
    if team_id:
        maint_query = maint_query.join(Vehicle).where(Vehicle.team_id == team_id)

    maint_query = maint_query.order_by(Maintenance.maintenance_date.asc()).limit(10)
    maint_res = await db.execute(maint_query)
    maintenances = maint_res.scalars().all()

    upcoming_list = [
        MaintenanceResponse(
            maintenance_id=m.maintenance_id,
            vehicle_id=m.vehicle_id,
            vehicle_chassis=m.vehicle.chassis if m.vehicle else None,
            mechanic_id=m.mechanic_id,
            mechanic_name=m.mechanic.full_name if m.mechanic else None,
            maintenance_date=m.maintenance_date,
            description=m.description,
            status=m.status,
        )
        for m in maintenances
    ]

    # Recent Audit Log Activity
    audit_query = (
        select(AuditLog)
        .options(selectinload(AuditLog.user))
        .where(
            or_(
                AuditLog.entity_type.in_(["Component", "Maintenance", "Vehicle"]),
                AuditLog.user_id == current_user.user_id,
            )
        )
        .order_by(AuditLog.created_at.desc())
        .limit(10)
    )
    audit_res = await db.execute(audit_query)
    logs = audit_res.scalars().all()

    recent_activity = []
    for log in logs:
        parsed = None
        if log.details:
            try:
                parsed = json.loads(log.details)
            except Exception:
                parsed = {"raw": log.details}
        recent_activity.append(
            {
                "log_id": log.log_id,
                "user_name": log.user.full_name if log.user else "System",
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "details": parsed,
                "created_at": log.created_at.isoformat(),
            }
        )

    return MechanicDashboardSummary(
        total_vehicles=total_vehicles,
        good_count=good_count,
        needs_attention_count=needs_attention_count,
        critical_count=critical_count,
        upcoming_maintenance_count=len(upcoming_list),
        upcoming_maintenance=upcoming_list,
        recent_activity=recent_activity,
    )


# ── 2. Team Vehicles with Computed Health ──────────────────────────────────
@router.get("/vehicles", response_model=List[VehicleHealthSummary])
async def get_mechanic_vehicles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("vehicles:read")),
) -> List[VehicleHealthSummary]:
    team_id = _get_user_team_filter(current_user)

    query = select(Vehicle)
    if team_id:
        query = query.where(Vehicle.team_id == team_id)
    veh_res = await db.execute(query)
    vehicles = veh_res.scalars().all()

    # Query active assignments for driver names
    assignments_res = await db.execute(
        select(DriverVehicleAssignment)
        .options(selectinload(DriverVehicleAssignment.driver).selectinload(Driver.user))
        .where(DriverVehicleAssignment.status == "active")
    )
    active_assignments = {a.vehicle_id: a for a in assignments_res.scalars().all()}

    items: List[VehicleHealthSummary] = []
    for v in vehicles:
        health_info = await get_vehicle_health(db, v.vehicle_id)
        assignment = active_assignments.get(v.vehicle_id)
        driver_name = (
            assignment.driver.user.full_name
            if assignment and assignment.driver and assignment.driver.user
            else None
        )

        items.append(
            VehicleHealthSummary(
                vehicle_id=v.vehicle_id,
                team_id=v.team_id,
                chassis=v.chassis,
                engine=v.engine,
                status=v.status,
                health_status=health_info["health_status"],
                critical_count=len(health_info["critical_components"]),
                attention_count=len(health_info["needs_attention_components"]),
                total_components=health_info["total_components"],
                current_driver_name=driver_name,
            )
        )

    return items


# ── 3. Vehicle Components Detail Endpoint ───────────────────────────────────
@router.get("/vehicles/{vehicle_id}/components", response_model=VehicleComponentDetailResponse)
async def get_vehicle_components(
    vehicle_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("components:read")),
) -> VehicleComponentDetailResponse:
    veh_res = await db.execute(select(Vehicle).where(Vehicle.vehicle_id == vehicle_id))
    vehicle = veh_res.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found.")

    health_info = await get_vehicle_health(db, vehicle_id)

    component_items = [
        ComponentResponse(
            component_id=c.component_id,
            vehicle_id=c.vehicle_id,
            component_name=c.component_name,
            status=c.status,
        )
        for c in health_info["components"]
    ]

    return VehicleComponentDetailResponse(
        vehicle_id=vehicle.vehicle_id,
        team_id=vehicle.team_id,
        chassis=vehicle.chassis,
        engine=vehicle.engine,
        status=vehicle.status,
        health_status=health_info["health_status"],
        critical_components=health_info["critical_components"],
        needs_attention_components=health_info["needs_attention_components"],
        components=component_items,
    )


# ── 3b. Add Component to Vehicle Endpoint ──────────────────────────────────
@router.post("/vehicles/{vehicle_id}/components", response_model=ComponentResponse, status_code=status.HTTP_201_CREATED)
async def create_vehicle_component(
    vehicle_id: str,
    payload: ComponentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("components:update")),
) -> ComponentResponse:
    veh_res = await db.execute(select(Vehicle).where(Vehicle.vehicle_id == vehicle_id))
    vehicle = veh_res.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found.")

    component = Component(
        vehicle_id=vehicle_id,
        component_name=payload.component_name,
        status=payload.status,
    )
    db.add(component)
    await db.flush()

    health_info = await get_vehicle_health(db, vehicle_id)

    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="component_created",
        entity_type="Component",
        entity_id=component.component_id,
        details={
            "component_name": component.component_name,
            "vehicle_id": vehicle_id,
            "vehicle_chassis": vehicle.chassis,
            "status": component.status,
            "rolled_up_vehicle_health": health_info["health_status"],
        },
        request=request,
    )

    if health_info["health_status"] == "critical":
        await notify_team_managers_on_critical_health(
            db=db,
            vehicle_id=vehicle_id,
            critical_component_names=health_info["critical_components"],
        )

    await db.commit()
    await db.refresh(component)

    return ComponentResponse(
        component_id=component.component_id,
        vehicle_id=component.vehicle_id,
        component_name=component.component_name,
        status=component.status,
    )


# ── 4. Update Component Status Endpoint ──────────────────────────────────────
@router.patch("/components/{component_id}/status", response_model=ComponentResponse)
async def update_component_status(
    component_id: str,
    payload: ComponentStatusUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("components:update")),
) -> ComponentResponse:
    comp_res = await db.execute(select(Component).where(Component.component_id == component_id))
    component = comp_res.scalar_one_or_none()
    if not component:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Component not found.")

    old_status = component.status
    new_status = payload.status
    component.status = new_status

    await db.flush()

    # Recalculate Vehicle Health
    health_info = await get_vehicle_health(db, component.vehicle_id)

    # Log Audit Event
    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="component_status_updated",
        entity_type="Component",
        entity_id=component.component_id,
        details={
            "component_name": component.component_name,
            "vehicle_id": component.vehicle_id,
            "old_status": old_status,
            "new_status": new_status,
            "rolled_up_vehicle_health": health_info["health_status"],
        },
        request=request,
    )

    # Trigger Notification to Team Manager if vehicle health reaches CRITICAL
    if health_info["health_status"] == "critical":
        await notify_team_managers_on_critical_health(
            db=db,
            vehicle_id=component.vehicle_id,
            critical_component_names=health_info["critical_components"],
        )

    await db.commit()
    await db.refresh(component)

    return ComponentResponse(
        component_id=component.component_id,
        vehicle_id=component.vehicle_id,
        component_name=component.component_name,
        status=component.status,
    )


# ── 5. Schedule Maintenance Endpoint ─────────────────────────────────────────
@router.post("/maintenance", response_model=MaintenanceResponse, status_code=status.HTTP_201_CREATED)
async def schedule_maintenance(
    payload: MaintenanceCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("maintenance:create")),
) -> MaintenanceResponse:
    # Verify vehicle exists
    veh_res = await db.execute(select(Vehicle).where(Vehicle.vehicle_id == payload.vehicle_id))
    vehicle = veh_res.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found.")

    mechanic_id = payload.mechanic_id or current_user.user_id

    # Verify mechanic exists
    mech_res = await db.execute(select(User).where(User.user_id == mechanic_id))
    mechanic = mech_res.scalar_one_or_none()
    if not mechanic:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mechanic user not found.")

    maintenance = Maintenance(
        vehicle_id=payload.vehicle_id,
        mechanic_id=mechanic_id,
        maintenance_date=payload.maintenance_date,
        description=payload.description,
        status=MaintenanceStatus.SCHEDULED.value,
    )
    db.add(maintenance)
    await db.flush()

    # Log Audit Event
    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="maintenance_scheduled",
        entity_type="Maintenance",
        entity_id=maintenance.maintenance_id,
        details={
            "vehicle_id": payload.vehicle_id,
            "vehicle_chassis": vehicle.chassis,
            "mechanic_id": mechanic_id,
            "maintenance_date": payload.maintenance_date.isoformat(),
            "description": payload.description,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(maintenance)

    return MaintenanceResponse(
        maintenance_id=maintenance.maintenance_id,
        vehicle_id=maintenance.vehicle_id,
        vehicle_chassis=vehicle.chassis,
        mechanic_id=maintenance.mechanic_id,
        mechanic_name=mechanic.full_name,
        maintenance_date=maintenance.maintenance_date,
        description=maintenance.description,
        status=maintenance.status,
    )


# ── 6. Update Maintenance Status Endpoint ───────────────────────────────────
@router.patch("/maintenance/{maintenance_id}", response_model=MaintenanceResponse)
async def update_maintenance(
    maintenance_id: str,
    payload: MaintenanceUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("maintenance:update")),
) -> MaintenanceResponse:
    maint_res = await db.execute(
        select(Maintenance)
        .options(selectinload(Maintenance.vehicle), selectinload(Maintenance.mechanic))
        .where(Maintenance.maintenance_id == maintenance_id)
    )
    maintenance = maint_res.scalar_one_or_none()
    if not maintenance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Maintenance log not found.")

    old_status = maintenance.status
    maintenance.status = payload.status

    updated_comp_info = None

    # Optionally update component status upon completing maintenance
    if payload.component_id and payload.new_component_status:
        comp_res = await db.execute(
            select(Component).where(Component.component_id == payload.component_id)
        )
        component = comp_res.scalar_one_or_none()
        if component:
            old_c_status = component.status
            component.status = payload.new_component_status
            updated_comp_info = {
                "component_id": component.component_id,
                "component_name": component.component_name,
                "old_status": old_c_status,
                "new_status": payload.new_component_status,
            }

    await db.flush()

    # Recalculate vehicle health
    health_info = await get_vehicle_health(db, maintenance.vehicle_id)

    # Log Audit Event
    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="maintenance_status_updated",
        entity_type="Maintenance",
        entity_id=maintenance.maintenance_id,
        details={
            "vehicle_id": maintenance.vehicle_id,
            "old_status": old_status,
            "new_status": maintenance.status,
            "updated_component": updated_comp_info,
            "rolled_up_vehicle_health": health_info["health_status"],
        },
        request=request,
    )

    await db.commit()
    await db.refresh(maintenance)

    return MaintenanceResponse(
        maintenance_id=maintenance.maintenance_id,
        vehicle_id=maintenance.vehicle_id,
        vehicle_chassis=maintenance.vehicle.chassis if maintenance.vehicle else None,
        mechanic_id=maintenance.mechanic_id,
        mechanic_name=maintenance.mechanic.full_name if maintenance.mechanic else None,
        maintenance_date=maintenance.maintenance_date,
        description=maintenance.description,
        status=maintenance.status,
    )


# ── 7. Maintenance History Endpoint ─────────────────────────────────────────
@router.get("/maintenance/history", response_model=List[MaintenanceResponse])
async def get_maintenance_history(
    vehicle_id: Optional[str] = Query(None, description="Filter maintenance by vehicle ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("maintenance:read")),
) -> List[MaintenanceResponse]:
    team_id = _get_user_team_filter(current_user)

    query = (
        select(Maintenance)
        .options(selectinload(Maintenance.vehicle), selectinload(Maintenance.mechanic))
    )

    if vehicle_id:
        query = query.where(Maintenance.vehicle_id == vehicle_id)
    elif team_id:
        query = query.join(Vehicle).where(Vehicle.team_id == team_id)

    query = query.order_by(Maintenance.maintenance_date.desc())

    res = await db.execute(query)
    maintenances = res.scalars().all()

    return [
        MaintenanceResponse(
            maintenance_id=m.maintenance_id,
            vehicle_id=m.vehicle_id,
            vehicle_chassis=m.vehicle.chassis if m.vehicle else None,
            mechanic_id=m.mechanic_id,
            mechanic_name=m.mechanic.full_name if m.mechanic else None,
            maintenance_date=m.maintenance_date,
            description=m.description,
            status=m.status,
        )
        for m in maintenances
    ]
