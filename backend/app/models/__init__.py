"""
Re-export all SQLAlchemy models for Base.metadata discovery.
"""
from app.models.base import Base
from app.models.role import Role
from app.models.permission import Permission
from app.models.role_permission import RolePermission
from app.models.team import Team
from app.models.user import User, UserStatus, UserRoleEnum
from app.models.driver import Driver
from app.models.vehicle import Vehicle, VehicleStatus
from app.models.race_circuit import Circuit, Race
from app.models.component_maintenance import Component, Maintenance, ComponentStatus, MaintenanceStatus
from app.models.notification import Notification, NotificationStatus
from app.models.report import Report
from app.models.driver_vehicle_assignment import DriverVehicleAssignment
from app.models.audit import AuditLog
from app.models.settings import SystemSettings, SettingCategory

__all__ = [
    "Base",
    "Role",
    "Permission",
    "RolePermission",
    "Team",
    "User",
    "UserStatus",
    "UserRoleEnum",
    "Driver",
    "Vehicle",
    "VehicleStatus",
    "Circuit",
    "Race",
    "Component",
    "Maintenance",
    "ComponentStatus",
    "MaintenanceStatus",
    "Notification",
    "NotificationStatus",
    "Report",
    "DriverVehicleAssignment",
    "AuditLog",
    "SystemSettings",
    "SettingCategory",
]

