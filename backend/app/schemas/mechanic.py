"""
Pydantic schemas for Mechanic Module endpoints.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, validator

from app.models.component_maintenance import ComponentStatus, MaintenanceStatus


class ComponentStatusUpdate(BaseModel):
    status: str = Field(..., description="New component status: good, needs_attention, worn, critical, replaced, new")

    @validator("status")
    def validate_status(cls, v: str) -> str:
        clean = v.strip().lower()
        valid = [s.value for s in ComponentStatus]
        if clean not in valid:
            raise ValueError(f"Invalid status '{v}'. Allowed statuses: {', '.join(valid)}")
        return clean


class ComponentCreate(BaseModel):
    component_name: str = Field(..., description="Name of component")
    status: str = Field("good", description="Initial component status")

    @validator("status")
    def validate_c_status(cls, v: str) -> str:
        clean = v.strip().lower()
        valid = [s.value for s in ComponentStatus]
        if clean not in valid:
            raise ValueError(f"Invalid status '{v}'. Allowed statuses: {', '.join(valid)}")
        return clean


class ComponentResponse(BaseModel):
    component_id: str
    vehicle_id: str
    component_name: str
    status: str

    class Config:
        from_attributes = True


class VehicleHealthSummary(BaseModel):
    vehicle_id: str
    team_id: str
    chassis: str
    engine: str
    status: str
    health_status: str
    critical_count: int = 0
    attention_count: int = 0
    total_components: int = 0
    current_driver_name: Optional[str] = None

    class Config:
        from_attributes = True


class VehicleComponentDetailResponse(BaseModel):
    vehicle_id: str
    team_id: str
    chassis: str
    engine: str
    status: str
    health_status: str
    critical_components: List[str] = []
    needs_attention_components: List[str] = []
    components: List[ComponentResponse] = []

    class Config:
        from_attributes = True


class MaintenanceCreate(BaseModel):
    vehicle_id: str = Field(..., description="Target vehicle ID")
    mechanic_id: Optional[str] = Field(None, description="Assigned mechanic user ID (defaults to current mechanic)")
    maintenance_date: datetime = Field(..., description="Scheduled date and time of maintenance")
    description: Optional[str] = Field(None, description="Description of maintenance work order")


class MaintenanceUpdate(BaseModel):
    status: str = Field(..., description="Updated status: scheduled, in_progress, completed")
    component_id: Optional[str] = Field(None, description="Optional component ID to update status upon completion")
    new_component_status: Optional[str] = Field(None, description="Optional new status for target component")

    @validator("status")
    def validate_m_status(cls, v: str) -> str:
        clean = v.strip().lower()
        valid = [s.value for s in MaintenanceStatus]
        if clean not in valid:
            raise ValueError(f"Invalid status '{v}'. Allowed values: {', '.join(valid)}")
        return clean


class MaintenanceResponse(BaseModel):
    maintenance_id: str
    vehicle_id: str
    vehicle_chassis: Optional[str] = None
    mechanic_id: str
    mechanic_name: Optional[str] = None
    maintenance_date: datetime
    description: Optional[str] = None
    status: str

    class Config:
        from_attributes = True


class MechanicDashboardSummary(BaseModel):
    total_vehicles: int
    good_count: int
    needs_attention_count: int
    critical_count: int
    upcoming_maintenance_count: int
    upcoming_maintenance: List[MaintenanceResponse] = []
    recent_activity: List[Dict[str, Any]] = []
