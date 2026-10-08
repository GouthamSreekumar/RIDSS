"""
Pydantic response and request schemas for Strategy Engineer module.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator


# ── Tire degradation ─────────────────────────────────────────────────────────

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
        None, description="Tire degradation rate in seconds per lap (slope of OLS linear fit)"
    )
    base_pace: Optional[float] = Field(
        None, description="Estimated base pace on fresh tires (intercept of OLS linear fit)"
    )
    laps: List[TireDegradationLap] = Field(default_factory=list)


class TireAnalysisResponse(BaseModel):
    session_id: str
    season: int
    circuit_name: str
    session_type: str
    driver_code: str
    stints: List[StintDegradation] = Field(default_factory=list)
    track_temp: Optional[float] = Field(None, description="Average track temperature in °C during session")
    rainfall: Optional[bool] = Field(None, description="Rainfall indicator during session")
    air_temp: Optional[float] = Field(None, description="Average air temperature in °C during session")
    humidity: Optional[float] = Field(None, description="Average humidity percentage during session")


# ── Pre-race planning reference ───────────────────────────────────────────────

class CompoundPlanningGuide(BaseModel):
    """Per-compound pre-race planning guidance for the upcoming event."""
    compound: str
    degradation_rate: Optional[float] = Field(
        None, description="Projected degradation rate in seconds per lap"
    )
    base_pace: Optional[float] = Field(
        None, description="Projected fresh-tyre base pace in seconds"
    )
    degradation_source: str = Field(
        "default_fallback",
        description="Data tier used: 'practice_session', 'historical_circuit', or 'default_fallback'"
    )
    source_detail: Optional[str] = Field(
        None, description="Human-readable description of the data source (e.g. 'Avg of 3 past races at Bahrain')"
    )
    estimated_viable_stint_min: Optional[int] = Field(
        None, description="Lower bound of viable stint length in laps based on degradation model"
    )
    estimated_viable_stint_max: Optional[int] = Field(
        None, description="Upper bound of viable stint length in laps based on degradation model"
    )
    degradation_rate_unreliable: bool = Field(
        False,
        description=(
            "True when the source degradation rate is zero or negative (fuel-burn / track-evolution artefact). "
            "Stint-length estimates from this compound should not be trusted."
        )
    )
    reliability_caution: Optional[str] = Field(
        None,
        description="Human-readable reliability warning shown in the UI when degradation_rate_unreliable is True"
    )


class PreRacePlanningReference(BaseModel):
    """Pre-race planning reference shown inside the Compose Strategy Plan dialog."""
    event_name: str
    circuit_name: str
    season: int
    round: int
    pit_loss_seconds: float = Field(22.0, description="Configured per-circuit pit stop time loss constant")
    default_total_laps: int = Field(
        57, description=(
            "Default total race distance in laps derived from the most recent edition of this event. "
            "The engineer can override this in the plan."
        )
    )
    compounds: List[CompoundPlanningGuide] = Field(default_factory=list)
    data_basis_note: str = Field(
        "Phase 1 deterministic estimate — based on historical circuit data and/or compound baseline models. "
        "Not a guarantee of race-day performance.",
        description="Explanatory note displayed prominently above the compound table"
    )


# ── Upcoming-events ───────────────────────────────────────────────────────────

class UpcomingEvent(BaseModel):
    """A race event in the current or next season whose race date is today or later."""
    round: int
    event_name: str
    circuit: str
    country: str
    race_date: Optional[str] = None  # ISO date string
    season: Optional[int] = None
    label: Optional[str] = None


class UpcomingEventsResponse(BaseModel):
    season: int
    events: List[UpcomingEvent]
    is_fallback_season: bool = False
    reason_code: Optional[str] = None
    message: Optional[str] = None


class EventDriverEntry(BaseModel):
    driver_code: str
    full_name: Optional[str] = None
    driver_number: Optional[int] = None


class EventDriversResponse(BaseModel):
    season: int
    round: int
    event_name: str
    drivers: List[EventDriverEntry]
    roster_basis_event: Optional[str] = Field(
        None,
        description=(
            "If no completed race exists in the current season, "
            "describes the fallback race used to infer the roster"
        )
    )
    roster_basis_season: Optional[int] = None


# ── Historical cross-season review ───────────────────────────────────────────

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
    track_temp: Optional[float] = Field(None, description="Track temperature in °C for that season")
    rainfall: Optional[bool] = Field(None, description="Rainfall flag for that season")


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
    season_weather: Dict[int, Dict[str, Any]] = Field(
        default_factory=dict, description="Track temp and weather data per season"
    )


# ── Strategy scenario comparison ─────────────────────────────────────────────

class StintEstimate(BaseModel):
    stint_number: int
    compound: str
    start_lap: int
    end_lap: int
    stint_length: int
    target_pit_lap: Optional[int] = None
    degradation_rate: float
    base_pace: float
    stint_projected_time_seconds: float
    degradation_source: str = Field(
        "historical", description="Data source used: 'actual_session', 'historical', or 'default_fallback'"
    )


class StrategyComparisonItem(BaseModel):
    strategy_id: str
    title: Optional[str] = None
    driver_code: Optional[str] = None
    created_by_name: str
    stops_count: int
    pit_loss_total_seconds: float
    total_projected_time_seconds: float
    total_projected_time_str: str
    stint_estimates: List[StintEstimate] = Field(default_factory=list)
    is_lowest_time: bool = False
    estimation_label: str = Field(
        "Phase 1 estimate — based on historical degradation model, not a guarantee",
        description="Phase 1 deterministic estimate framing label"
    )


class StrategyComparisonResponse(BaseModel):
    season: int
    round: int
    circuit_name: str
    pit_loss_seconds: float
    compared_strategies: List[StrategyComparisonItem] = Field(default_factory=list)
    disclaimer: str = Field(
        "Phase 1 estimate — based on historical degradation model, not a guarantee",
        description="Global disclaimer label for deterministic estimate"
    )


# ── Strategy plan CRUD ────────────────────────────────────────────────────────

class StintPlan(BaseModel):
    stint_number: int = Field(..., ge=1)
    compound: str = Field(..., min_length=1)
    start_lap: int = Field(..., ge=1)
    end_lap: int = Field(..., ge=1)
    target_pit_lap: Optional[int] = Field(None, ge=1)
    notes: Optional[str] = None


class RaceStrategyCreate(BaseModel):
    """
    Creates a strategy plan for an UPCOMING race in the current season.
    `season` and `round` are resolved server-side from the selected upcoming event.
    """
    season: int = Field(..., description="Current season year")
    round: int = Field(..., ge=1, description="Race round number within the season")
    driver_code: Optional[str] = Field(None, description="Target driver code e.g. VER")
    title: Optional[str] = Field(None, description="Strategy plan title e.g. 2-Stop Soft-Medium-Hard")
    total_laps: Optional[int] = Field(
        None, ge=1,
        description="Total race distance in laps; defaults to most recent edition of the event if omitted"
    )
    plan: List[StintPlan] = Field(..., min_length=1, description="Stint-by-stint strategy plan")


class RaceStrategyResponse(BaseModel):
    id: str
    team_id: str
    # Legacy plans use session_id; new plans use season + round
    session_id: Optional[str] = None
    season: Optional[int] = None
    round: Optional[int] = None
    created_by: str
    creator_name: str
    title: Optional[str] = None
    driver_code: Optional[str] = None
    plan: List[StintPlan] = Field(default_factory=list)
    created_at: datetime
    is_legacy: bool = Field(
        False,
        description="True for plans authored against the old free-text session_id; shown under Legacy Plans"
    )

    class Config:
        from_attributes = True


# ── Strategy reports ─────────────────────────────────────────────────────────

class StrategyReportCreate(BaseModel):
    session_id: str = Field(..., description="Session identifier e.g. 2024_Monaco_Race")
    driver_code: Optional[str] = Field(None, description="Driver abbreviation code")
    driver_id: Optional[str] = Field(None, description="Driver database UUID")
    tire_degradation_summary: str = Field(..., description="Summary of tire degradation analysis")
    pit_window_reasoning: str = Field(..., description="Pit-window calculation and reasoning")
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


# ── Dashboard ─────────────────────────────────────────────────────────────────

class StrategyEngineerDashboard(BaseModel):
    team_id: str
    team_name: str
    active_drivers: List[Dict[str, Any]]
    recent_strategies: List[RaceStrategyResponse]
    recent_reports: List[StrategyReportResponse]
    available_seasons: List[int]
    quick_links: List[Dict[str, str]]
