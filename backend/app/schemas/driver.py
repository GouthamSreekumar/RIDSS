"""
Pydantic v2 schemas for Driver module.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.notification import NotificationResponse


class DriverReportResponse(BaseModel):
    report_id: str
    team_id: Optional[str] = None
    generated_by: str
    generator_name: str
    report_type: str
    created_at: datetime
    data: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class DriverSessionItem(BaseModel):
    round_number: int
    country: str
    location: str
    event_name: str
    official_event_name: Optional[str] = None
    event_date: Optional[str] = None
    session_type: str = "Race"
    position: Optional[int] = None
    position_text: Optional[str] = None
    points: Optional[float] = None
    status: Optional[str] = None


class DriverSessionHistoryResponse(BaseModel):
    season: int
    available_seasons: List[int]
    driver_code: str
    driver_name: str
    sessions: List[DriverSessionItem]


class DriverDashboardResponse(BaseModel):
    driver_id: str
    user_id: str
    driver_name: str
    fastf1_code: Optional[str] = None
    driver_number: int
    nationality: Optional[str] = None
    current_season_points: float
    last_race_position: Optional[int] = None
    last_race_position_text: Optional[str] = None
    last_session_date: Optional[str] = None
    recent_notifications: List[NotificationResponse]
    recent_reports: List[DriverReportResponse]
