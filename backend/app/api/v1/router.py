"""API v1 router — aggregates all endpoint modules."""
from fastapi import APIRouter

from app.api.v1.endpoints import (
    audit_logs,
    auth,
    dashboard,
    notifications,
    race_engineer,
    races_circuits,
    roles,
    settings,
    team_manager,
    teams,
    users,
)

router = APIRouter(prefix="/api/v1")

router.include_router(auth.router)
router.include_router(dashboard.router)
router.include_router(users.router)
router.include_router(teams.router)
router.include_router(roles.roles_router)
router.include_router(roles.permissions_router)
router.include_router(races_circuits.races_router)
router.include_router(races_circuits.circuits_router)
router.include_router(notifications.router)
router.include_router(audit_logs.router)
router.include_router(settings.router)
router.include_router(team_manager.router)
router.include_router(race_engineer.router)

