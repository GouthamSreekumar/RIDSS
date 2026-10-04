"""
Pydantic response and request schemas for Strategy Engineer module.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ExcludedLapDetail(BaseModel):
    lap_number: int
    reason: str


class TireDegradationLap(BaseModel):
    lap_number: int
    tyre_life: Optional[int] = None
    lap_time_seconds: Optional[float] = None
    track_status: Optional[str] = None
    deleted: bool = False
    is_excluded: bool = False
    exclusion_reason: Optional[str] = None


class StintDegradation(BaseModel):
    stint: int
    compound: str
    total_laps: int
    valid_laps: int
    excluded_laps_count: int
    excluded_lap_numbers: List[ExcludedLapDetail] = Field(default_factory=list)
    degradation_rate: Optional[float] = Field(
        None, description="Tire degradation rate in seconds lost per lap (slope of linear fit)"
    )
    base_pace: Optional[float] = Field(
        None, description="Estimated base pace on fresh tires (intercept of linear fit)"
    )
    laps: List[TireDegradationLap] = Field(default_factory=list)


class TireAnalysisResponse(BaseModel):
    session_id: str
    season: int
    circuit_name: str
    session_type: str
    driver_code: str
    stints: List[StintDegradation] = Field(default_factory=list)


class PitRecommendationResponse(BaseModel):
    session_id: str
    season: int
    circuit_name: str
    session_type: str
    driver_code: str
    current_stint: Optional[int] = None
    current_compound: Optional[str] = None
    current_degradation_rate: Optional[float] = Field(
        None, description="Degradation rate of current stint (sec/lap)"
    )
    current_base_pace: Optional[float] = None
    alternate_compound: Optional[str] = None
    alternate_degradation_rate: Optional[float] = Field(
        None, description="Estimated degradation rate for alternate compound"
    )
    alternate_base_pace: Optional[float] = Field(
        None, description="Estimated base pace for alternate compound"
    )
    pit_loss_seconds: float = Field(
        22.0, description="Configured per-circuit pit stop time loss constant from SystemSettings"
    )
    crossover_lap: Optional[int] = Field(
        None, description="Lap number where switching compounds becomes net-faster"
    )
    recommended_window_start: Optional[int] = Field(
        None, description="Recommended pit window start lap range"
    )
    recommended_window_end: Optional[int] = Field(
        None, description="Recommended pit window end lap range"
    )
    reasoning: str = Field(
        ..., description="Transparent, explainable Phase 1 deterministic reasoning calculation"
    )
    fallback_used: bool = Field(
        False, description="Flag indicating if alternate compound pace used historical circuit fallback"
    )


class HistoricalStintPattern(BaseModel):
    season: int
    session_type: str
    driver_code: str
    stint: int
    compound: str
    total_laps: int
    valid_laps: int
    degradation_rate: Optional[float] = None
    base_pace: Optional[float] = None


class HistoricalCompoundSummary(BaseModel):
    compound: str
    sample_stints: int
    avg_degradation_rate: float
    avg_stint_length: float
    avg_base_pace: Optional[float] = None


class HistoricalStrategyReviewResponse(BaseModel):
    circuit: str
    seasons: List[int]
    compound_summaries: List[HistoricalCompoundSummary] = Field(default_factory=list)
    stints: List[HistoricalStintPattern] = Field(default_factory=list)


class StintPlan(BaseModel):
    stint_number: int = Field(..., ge=1)
    compound: str = Field(..., min_length=1)
    start_lap: int = Field(..., ge=1)
    end_lap: int = Field(..., ge=1)
    target_pit_lap: Optional[int] = Field(None, ge=1)
    notes: Optional[str] = None


class RaceStrategyCreate(BaseModel):
    session_id: str = Field(..., description="Target session slug e.g. 2024_Monaco_Race")
    driver_code: Optional[str] = Field(None, description="Target driver code e.g. VER")
    title: Optional[str] = Field(None, description="Strategy plan title e.g. 2-Stop Soft-Medium-Hard")
    plan: List[StintPlan] = Field(..., min_items=1, description="Stint-by-stint strategy plan")


class RaceStrategyResponse(BaseModel):
    id: str
    team_id: str
    session_id: str
    created_by: str
    creator_name: str
    title: Optional[str] = None
    driver_code: Optional[str] = None
    plan: List[StintPlan] = Field(default_factory=list)
    created_at: datetime

    class Config:
        from_attributes = True


class StrategyReportCreate(BaseModel):
    session_id: str = Field(..., description="Session identifier e.g. 2024_Monaco_Race")
    driver_code: Optional[str] = Field(None, description="Driver abbreviation code")
    driver_id: Optional[str] = Field(None, description="Driver database UUID")
    tire_degradation_summary: str = Field(..., description="Summary of tire degradation analysis")
    pit_window_reasoning: str = Field(..., description="Pit window calculation and reasoning")
    strategy_plan_id: Optional[str] = Field(None, description="Associated strategy plan ID if created")
    key_findings: str = Field(..., description="Executive strategy conclusions and recommendations")
    custom_data: Optional[Dict[str, Any]] = None


class StrategyReportResponse(BaseModel):
    report_id: str
    team_id: Optional[str] = None
    generated_by: str
    generator_name: str
    report_type: str = "strategy"
    created_at: datetime
    data: Dict[str, Any]


class StrategyEngineerDashboard(BaseModel):
    team_id: str
    team_name: str
    active_drivers: List[Dict[str, Any]]
    recent_strategies: List[RaceStrategyResponse]
    recent_reports: List[StrategyReportResponse]
    available_seasons: List[int]
    quick_links: List[Dict[str, str]]
