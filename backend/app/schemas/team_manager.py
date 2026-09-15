"""
Pydantic schemas for Team Manager module endpoints.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AssignmentCreate(BaseModel):
    driver_id: str = Field(..., description="ID of the driver to pair")
    vehicle_id: str = Field(..., description="ID of the vehicle to pair")
    season: Optional[int] = Field(2026, description="Competition season year")


class DriverSummary(BaseModel):
    driver_id: str
    user_id: str
    driver_number: int
    full_name: str
    nationality: Optional[str] = None

    class Config:
        from_attributes = True


class VehicleSummary(BaseModel):
    vehicle_id: str
    chassis: str
    engine: str
    status: str

    class Config:
        from_attributes = True


class DriverVehicleAssignmentResponse(BaseModel):
    assignment_id: str
    team_id: str
    driver_id: str
    vehicle_id: str
    status: str
    assigned_at: datetime
    season: Optional[int] = None
    driver: Optional[DriverSummary] = None
    vehicle: Optional[VehicleSummary] = None

    class Config:
        from_attributes = True


class TeamDriverItem(BaseModel):
    driver_id: str
    user_id: str
    driver_number: int
    nationality: Optional[str] = None
    full_name: str
    email: str
    current_vehicle: Optional[VehicleSummary] = None
    current_assignment_id: Optional[str] = None


class TeamVehicleItem(BaseModel):
    vehicle_id: str
    team_id: str
    chassis: str
    engine: str
    status: str
    current_driver: Optional[DriverSummary] = None
    current_assignment_id: Optional[str] = None


class RecentActivityItem(BaseModel):
    log_id: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    created_at: datetime


class TeamDashboardSummary(BaseModel):
    team_id: str
    team_name: str
    driver_count: int
    vehicle_count: int
    active_pairings_count: int
    unassigned_drivers_count: int
    unassigned_vehicles_count: int
    recent_activity: List[RecentActivityItem] = []


class TeamReportResponse(BaseModel):
    report_id: str
    team_id: Optional[str] = None
    generated_by: str
    generator_name: Optional[str] = None
    report_type: str
    created_at: datetime
    data: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class CalendarDriverResult(BaseModel):
    driver_code: str
    driver_number: int
    full_name: Optional[str] = None
    position: Optional[int] = None
    position_text: Optional[str] = None
    points: Optional[float] = None
    status: Optional[str] = None


class RaceCalendarEvent(BaseModel):
    round_number: int
    country: str
    location: str
    event_name: str
    official_event_name: Optional[str] = None
    event_date: Optional[str] = None
    format: Optional[str] = None
    is_completed: bool
    driver_results: List[CalendarDriverResult] = []


class TeamManagerCalendarResponse(BaseModel):
    season: int
    available_seasons: List[int]
    team_name: str
    events: List[RaceCalendarEvent] = []

