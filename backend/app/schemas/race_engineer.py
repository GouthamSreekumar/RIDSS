"""
Pydantic response and request schemas for Race Engineer module.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DynamicSeasonList(BaseModel):
    seasons: List[int]


class CircuitSummary(BaseModel):
    circuit_id: str
    circuit_name: str
    country: str
    length: float
    round_number: Optional[int] = None
    has_geometry: bool = False


class SessionInfo(BaseModel):
    session_id: str
    session_name: str
    session_type: str
    date: Optional[str] = None


class LapSummary(BaseModel):
    lap_number: int
    driver_code: str
    driver_number: int
    lap_time_seconds: Optional[float] = None
    lap_time_str: Optional[str] = None
    sector_1_seconds: Optional[float] = None
    sector_2_seconds: Optional[float] = None
    sector_3_seconds: Optional[float] = None
    stint: Optional[int] = None
    compound: Optional[str] = None
    tyre_life: Optional[int] = None
    pit_in_time_str: Optional[str] = None
    pit_out_time_str: Optional[str] = None
    track_status: Optional[str] = None
    is_personal_best: bool = False
    speed_st: Optional[float] = None
    speed_fl: Optional[float] = None
    speed_i1: Optional[float] = None
    speed_i2: Optional[float] = None


class TelemetryPoint(BaseModel):
    distance: float
    time_seconds: float
    speed: float
    rpm: int
    throttle: float
    brake: float
    gear: int
    drs: int
    x: float
    y: float


class LapTelemetry(BaseModel):
    session_id: str
    driver_code: str
    driver_number: int
    lap_number: int
    lap_time_seconds: Optional[float] = None
    telemetry_points: List[TelemetryPoint] = Field(default_factory=list)
    track_geometry: Optional[Dict[str, Any]] = None


class WeatherSummary(BaseModel):
    air_temp: Optional[float] = None
    track_temp: Optional[float] = None
    humidity: Optional[float] = None
    rainfall: Optional[bool] = None


class SessionOverview(BaseModel):
    session_id: str
    season: int
    circuit_name: str
    session_name: str
    total_laps: int
    weather_summary: Optional[WeatherSummary] = None
    driver_lap_summaries: Dict[str, List[LapSummary]] = Field(default_factory=dict)


class ComparisonData(BaseModel):
    primary_driver: str
    primary_lap: int
    primary_telemetry: LapTelemetry
    secondary_driver: str
    secondary_lap: int
    secondary_telemetry: LapTelemetry
    aligned_distance: List[float] = Field(default_factory=list)
    speed_delta: List[float] = Field(default_factory=list)
    time_delta_seconds: List[float] = Field(default_factory=list)


class EngineeringReportCreate(BaseModel):
    session_id: str
    driver_id: Optional[str] = None
    driver_code: Optional[str] = None
    lap_numbers: Optional[List[int]] = None
    key_findings: str
    stint_degradation_trend: Optional[str] = None
    summary_stats: Optional[Dict[str, Any]] = None


class EngineeringReportResponse(BaseModel):
    report_id: str
    team_id: Optional[str] = None
    generated_by: str
    generator_name: str
    report_type: str = "engineering"
    created_at: datetime
    data: Dict[str, Any]


class RaceEngineerDashboard(BaseModel):
    team_id: str
    team_name: str
    active_drivers: List[Dict[str, Any]]
    recent_reports: List[EngineeringReportResponse]
    available_seasons: List[int]
    quick_links: List[Dict[str, str]]
