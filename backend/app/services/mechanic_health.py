"""
Vehicle Health Service Layer.
Computes rolled-up vehicle health status from component statuses.
Provides notification dispatch when vehicle health degrades to critical.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.component_maintenance import Component, ComponentStatus
from app.models.notification import Notification
from app.models.role import Role
from app.models.user import User
from app.models.vehicle import Vehicle

logger = logging.getLogger(__name__)


async def get_vehicle_health(db: AsyncSession, vehicle_id: str) -> Dict[str, Any]:
    """
    Computes a vehicle's overall health status derived from its components.
    
    Roll-up Rules:
    - If ANY component is 'critical' -> Vehicle health is 'critical'
    - Else if ANY component is 'needs_attention' or 'worn' -> Vehicle health is 'needs_attention'
    - Else -> Vehicle health is 'good'
    """
    result = await db.execute(
        select(Component).where(Component.vehicle_id == vehicle_id)
    )
    components = result.scalars().all()

    critical_components: List[str] = []
    needs_attention_components: List[str] = []

    for comp in components:
        st = (comp.status or "").lower()
        if st == ComponentStatus.CRITICAL.value:
            critical_components.append(comp.component_name)
        elif st in (ComponentStatus.NEEDS_ATTENTION.value, ComponentStatus.WORN.value):
            needs_attention_components.append(comp.component_name)

    if len(critical_components) > 0:
        health_status = "critical"
    elif len(needs_attention_components) > 0:
        health_status = "needs_attention"
    else:
        health_status = "good"

    return {
        "vehicle_id": vehicle_id,
        "health_status": health_status,
        "critical_components": critical_components,
        "needs_attention_components": needs_attention_components,
        "total_components": len(components),
        "components": components,
    }


async def notify_team_managers_on_critical_health(
    db: AsyncSession,
    vehicle_id: str,
    critical_component_names: List[str],
) -> None:
    """
    Triggers a notification to all active Team Managers associated with the vehicle's team.
    Called when a component status change degrades vehicle health to CRITICAL.
    """
    try:
        vehicle_res = await db.execute(
            select(Vehicle).where(Vehicle.vehicle_id == vehicle_id)
        )
        vehicle = vehicle_res.scalar_one_or_none()
        if not vehicle:
            return

        # Find Team Manager role_id
        role_res = await db.execute(
            select(Role).where(Role.role_name == "Team Manager")
        )
        tm_role = role_res.scalar_one_or_none()
        if not tm_role:
            return

        # Find Team Managers for this team
        managers_res = await db.execute(
            select(User).where(
                User.role_id == tm_role.role_id,
                User.team_id == vehicle.team_id,
                User.status == "active",
            )
        )
        managers = managers_res.scalars().all()

        comp_str = ", ".join(critical_component_names) if critical_component_names else "one or more components"
        title = f"Vehicle Health CRITICAL — {vehicle.chassis}"
        message = (
            f"Vehicle {vehicle.chassis} ({vehicle.engine}) has reached CRITICAL health due to component(s): {comp_str}. "
            f"Driver assignments for this vehicle are currently blocked until maintenance resolves the critical status."
        )

        for mgr in managers:
            notification = Notification(
                user_id=mgr.user_id,
                title=title,
                message=message,
                status="unread",
                reference_type="vehicle",
                reference_id=vehicle_id,
                created_at=datetime.now(timezone.utc),
            )
            db.add(notification)
            logger.info("Queued critical vehicle notification for Team Manager %s", mgr.email)

    except Exception as exc:
        logger.error("Error creating critical health notification: %s", exc)
