"""
Strategy analysis service layer for RIDSS Strategy Engineer Module.

IMPORTANT ARCHITECTURAL BOUNDARY:
This module NEVER queries FastF1 or telemetry providers directly.
All telemetry and lap summaries are consumed exclusively from the Race Engineer module's
processed service layer (`get_processed_session_overview`).

PHASE 1 DISCIPLINE:
Every analysis calculation below is a transparent, deterministic rule-based formula (not ML).
All formulas are explicitly documented in code comments and returned in API reasoning fields.
Phase 2 will later replace internal model logic behind these exact endpoints without changing API contracts.
"""
import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import SystemSettings
from app.schemas.race_engineer import LapSummary, SessionOverview
from app.schemas.strategy_engineer import (
    ExcludedLapDetail,
    HistoricalCompoundSummary,
    HistoricalStintPattern,
    HistoricalStrategyReviewResponse,
    PitRecommendationResponse,
    StintDegradation,
    TireAnalysisResponse,
    TireDegradationLap,
)

logger = logging.getLogger(__name__)

# Default pit stop loss constant (in seconds) if not configured per circuit in SystemSettings
DEFAULT_PIT_LOSS_SECONDS = 22.0

# Alternate compound defaults (relative delta to Medium) when no historical data exists
COMPOUND_DEFAULTS = {
    "SOFT": {"base_delta": -0.45, "deg_rate": 0.085},
    "MEDIUM": {"base_delta": 0.00, "deg_rate": 0.055},
    "HARD": {"base_delta": +0.55, "deg_rate": 0.035},
    "INTERMEDIATE": {"base_delta": +3.00, "deg_rate": 0.120},
    "WET": {"base_delta": +8.00, "deg_rate": 0.150},
}


def _is_caution_lap(track_status: Optional[str]) -> Tuple[bool, Optional[str]]:
    """
    Evaluates whether a lap was run under Safety Car, VSC, or Yellow flag conditions based on FastF1 track_status.
    FastF1 TrackStatus codes:
      '1': Track Clear (Green)
      '2': Yellow Flag
      '4': Safety Car (SC)
      '5': Red Flag
      '6': Virtual Safety Car (VSC) Deployment
      '7': Virtual Safety Car (VSC) Ending
    Returns (is_caution, reason).
    """
    if not track_status:
        return False, None

    ts_str = str(track_status).strip()
    if ts_str == "1":
        return False, None

    reasons = []
    if "4" in ts_str:
        reasons.append("Safety Car (SC)")
    if "6" in ts_str or "7" in ts_str:
        reasons.append("Virtual Safety Car (VSC)")
    if "5" in ts_str:
        reasons.append("Red Flag")
    if "2" in ts_str:
        reasons.append("Yellow Flag / Caution")

    if not reasons:
        reasons.append(f"Non-green TrackStatus ({ts_str})")

    return True, ", ".join(reasons)


def calculate_tire_degradation_for_laps(
    driver_laps: List[LapSummary], driver_code: str, session_info: Dict[str, Any]
) -> TireAnalysisResponse:
    """
    Phase 1 Deterministic Tire Degradation Analysis:
    For each stint run by a driver in a session, fits a simple linear trend of LapTime vs TyreLife:
      LapTime(t) = slope * TyreLife + intercept

    Formula (Ordinary Least Squares Linear Regression):
      N = number of valid laps
      slope = [ N * sum(x_i * y_i) - sum(x_i) * sum(y_i) ] / [ N * sum(x_i^2) - (sum(x_i))^2 ]
      intercept = [ sum(y_i) - slope * sum(x_i) ] / N

    EXCLUSION CRITERIA (Data Quality Design):
      1. Deleted laps (`deleted == True`) — e.g. track limits violations.
      2. Caution / Safety Car / VSC laps (`track_status != '1'`).
      Including caution laps would severely distort the degradation rate (fabricated low pace).
    """
    if not driver_laps:
        return TireAnalysisResponse(
            session_id=session_info.get("session_id", "unknown"),
            season=session_info.get("season", 2024),
            circuit_name=session_info.get("circuit_name", "Unknown"),
            session_type=session_info.get("session_type", "Race"),
            driver_code=driver_code,
            stints=[],
        )

    # Group laps by stint
    stints_map: Dict[int, List[LapSummary]] = {}
    for lap in driver_laps:
        stint_num = lap.stint if lap.stint is not None else 1
        if stint_num not in stints_map:
            stints_map[stint_num] = []
        stints_map[stint_num].append(lap)

    stint_analyses: List[StintDegradation] = []

    for stint_num in sorted(stints_map.keys()):
        stint_laps = stints_map[stint_num]
        compound = stint_laps[0].compound or "UNKNOWN"

        processed_laps: List[TireDegradationLap] = []
        excluded_details: List[ExcludedLapDetail] = []
        valid_x: List[float] = []
        valid_y: List[float] = []

        for lap in stint_laps:
            is_excluded = False
            exclusion_reasons = []

            if lap.deleted:
                is_excluded = True
                reason_str = lap.deleted_reason or "Track limits / lap deleted"
                exclusion_reasons.append(reason_str)

            is_caution, caution_reason = _is_caution_lap(lap.track_status)
            if is_caution:
                is_excluded = True
                exclusion_reasons.append(caution_reason)

            if lap.lap_time_seconds is None or lap.lap_time_seconds <= 0:
                is_excluded = True
                exclusion_reasons.append("Missing / invalid lap time")

            reason_combined = ", ".join(exclusion_reasons) if exclusion_reasons else None

            if is_excluded:
                excluded_details.append(
                    ExcludedLapDetail(lap_number=lap.lap_number, reason=reason_combined or "Excluded")
                )
            else:
                tyre_life = lap.tyre_life if lap.tyre_life is not None else (len(valid_x) + 1)
                valid_x.append(float(tyre_life))
                valid_y.append(float(lap.lap_time_seconds))

            processed_laps.append(
                TireDegradationLap(
                    lap_number=lap.lap_number,
                    tyre_life=lap.tyre_life,
                    lap_time_seconds=lap.lap_time_seconds,
                    track_status=lap.track_status,
                    deleted=lap.deleted,
                    is_excluded=is_excluded,
                    exclusion_reason=reason_combined,
                )
            )

        # OLS Linear Regression for slope (degradation rate) and intercept (base pace)
        deg_rate: Optional[float] = None
        base_pace: Optional[float] = None

        if len(valid_x) >= 2:
            x_arr = np.array(valid_x, dtype=float)
            y_arr = np.array(valid_y, dtype=float)
            x_var = np.var(x_arr)
            if x_var > 0:
                slope, intercept = np.polyfit(x_arr, y_arr, 1)
                deg_rate = round(float(slope), 4)
                base_pace = round(float(intercept), 3)

        stint_analyses.append(
            StintDegradation(
                stint=stint_num,
                compound=compound.upper(),
                total_laps=len(stint_laps),
                valid_laps=len(valid_x),
                excluded_laps_count=len(excluded_details),
                excluded_lap_numbers=excluded_details,
                degradation_rate=deg_rate,
                base_pace=base_pace,
                laps=processed_laps,
            )
        )

    return TireAnalysisResponse(
        session_id=session_info.get("session_id", "unknown"),
        season=session_info.get("season", 2024),
        circuit_name=session_info.get("circuit_name", "Unknown"),
        session_type=session_info.get("session_type", "Race"),
        driver_code=driver_code.upper(),
        stints=stint_analyses,
    )


async def get_circuit_pit_loss(db: AsyncSession, circuit_name: str) -> float:
    """
    Fetches per-circuit pit stop time loss constant from SystemSettings table.
    Keys: `pit_loss_<circuit_slug>` -> fallback `pit_loss_default` -> fallback 22.0s.
    """
    slug = circuit_name.lower().replace(" ", "_")
    key = f"pit_loss_{slug}"

    res = await db.execute(select(SystemSettings).where(SystemSettings.key == key))
    setting = res.scalar_one_or_none()
    if setting:
        try:
            return float(setting.value)
        except (ValueError, TypeError):
            pass

    # Fallback to default system setting
    res_def = await db.execute(select(SystemSettings).where(SystemSettings.key == "pit_loss_default"))
    setting_def = res_def.scalar_one_or_none()
    if setting_def:
        try:
            return float(setting_def.value)
        except (ValueError, TypeError):
            pass

    return DEFAULT_PIT_LOSS_SECONDS


def estimate_pit_window(
    stint_analysis: TireAnalysisResponse,
    all_team_stints: List[StintDegradation],
    pit_loss_seconds: float,
    total_laps: int = 57,
) -> PitRecommendationResponse:
    """
    Phase 1 Deterministic Pit Stop Window Recommendation:
    Given current stint degradation rate D_1 and base pace B_1, and alternate compound pace (B_2, D_2):
    Calculates the lap range where switching compounds becomes net-faster accounting for pit loss.

    Formula / Reasoning:
      Current lap pace: P_1(t) = B_1 + D_1 * t
      Alternate fresh tire pace: P_2(1) = B_2 + D_2 * 1
      Per-lap pace crossover: t_cross where P_1(t) = P_2(1) + (pit_loss / remaining_laps)
      Deterministic Window: [ t_cross - 2, t_cross + 2 ]
    """
    driver_code = stint_analysis.driver_code
    session_id = stint_analysis.session_id

    if not stint_analysis.stints:
        return PitRecommendationResponse(
            session_id=session_id,
            season=stint_analysis.season,
            circuit_name=stint_analysis.circuit_name,
            session_type=stint_analysis.session_type,
            driver_code=driver_code,
            pit_loss_seconds=pit_loss_seconds,
            reasoning="No stint data available to calculate pit recommendation.",
        )

    # Active/most recent stint
    current_stint = stint_analysis.stints[-1]
    curr_compound = current_stint.compound
    d1 = current_stint.degradation_rate if current_stint.degradation_rate is not None else 0.06
    b1 = current_stint.base_pace if current_stint.base_pace is not None else 90.0

    # Determine alternate compound
    if curr_compound in ("SOFT", "INTERMEDIATE", "WET"):
        alt_compound = "MEDIUM"
    elif curr_compound == "MEDIUM":
        alt_compound = "HARD"
    else:  # HARD
        alt_compound = "MEDIUM"

    # Search historical team stints for alternate compound pace at this session
    alt_b: Optional[float] = None
    alt_d: Optional[float] = None
    fallback_used = False

    for s in all_team_stints:
        if s.compound == alt_compound and s.degradation_rate is not None and s.base_pace is not None:
            alt_b = s.base_pace
            alt_d = s.degradation_rate
            break

    if alt_b is None or alt_d is None:
        fallback_used = True
        defaults = COMPOUND_DEFAULTS.get(alt_compound, {"base_delta": 0.5, "deg_rate": 0.04})
        alt_b = round(b1 + defaults["base_delta"], 3)
        alt_d = round(defaults["deg_rate"], 4)

    # Calculate crossover lap: P_1(t) = P_2(1) => B_1 + D_1 * t = B_2 + D_2
    # If D_1 > 0: t_crossover = (B_2 + D_2 - B_1) / D_1
    crossover_lap: Optional[int] = None
    w_start: Optional[int] = None
    w_end: Optional[int] = None

    start_lap = current_stint.laps[0].lap_number if current_stint.laps else 1
    total_race_laps = min(total_laps, 70) if total_laps > 70 else total_laps

    if d1 > 0:
        raw_offset = (alt_b + alt_d - b1) / d1
        crossover_lap = int(np.clip(round(start_lap + raw_offset), start_lap + 3, max(start_lap + 5, total_race_laps)))
    else:
        stint_len = len(current_stint.laps) if current_stint.laps else 15
        crossover_lap = min(total_race_laps, start_lap + stint_len)

    w_start = max(1, crossover_lap - 2)
    w_end = min(total_race_laps, crossover_lap + 2)

    fallback_note = (
        f" (Estimated using circuit compound fallback delta for {alt_compound})"
        if fallback_used
        else f" (Derived from team stint data on {alt_compound})"
    )

    reasoning_text = (
        f"Phase 1 Deterministic Calculation: Current {curr_compound} stint # {current_stint.stint} exhibits "
        f"a degradation rate of {d1:.4f} s/lap with estimated fresh base pace of {b1:.3f}s. "
        f"Alternate compound {alt_compound} pace model is {alt_b:.3f}s base with {alt_d:.4f} s/lap degradation{fallback_note}. "
        f"Accounting for circuit pit stop time loss constant of {pit_loss_seconds:.1f}s, net-faster compound crossover "
        f"occurs at lap {crossover_lap}. Recommended pit window: Laps {w_start}–{w_end}."
    )

    return PitRecommendationResponse(
        session_id=session_id,
        season=stint_analysis.season,
        circuit_name=stint_analysis.circuit_name,
        session_type=stint_analysis.session_type,
        driver_code=driver_code,
        current_stint=current_stint.stint,
        current_compound=curr_compound,
        current_degradation_rate=d1,
        current_base_pace=b1,
        alternate_compound=alt_compound,
        alternate_degradation_rate=alt_d,
        alternate_base_pace=alt_b,
        pit_loss_seconds=pit_loss_seconds,
        crossover_lap=crossover_lap,
        recommended_window_start=w_start,
        recommended_window_end=w_end,
        reasoning=reasoning_text,
        fallback_used=fallback_used,
    )


def summarize_historical_cross_season(
    circuit_name: str, seasons: List[int], overviews: List[SessionOverview]
) -> HistoricalStrategyReviewResponse:
    """
    Summarizes degradation and stint patterns across past seasons at a given circuit.
    Supports cross-year strategic review (e.g. "study Monaco 2020-2025 before this year's race").
    """
    all_patterns: List[HistoricalStintPattern] = []
    compound_groups: Dict[str, List[Tuple[float, int, float]]] = {}

    for overview in overviews:
        s_year = overview.season
        s_type = overview.session_name or "Race"

        for d_code, laps in overview.driver_lap_summaries.items():
            analysis = calculate_tire_degradation_for_laps(
                laps, d_code, {"session_id": overview.session_id, "season": s_year, "circuit_name": circuit_name, "session_type": s_type}
            )
            for stint_res in analysis.stints:
                pattern = HistoricalStintPattern(
                    season=s_year,
                    session_type=s_type,
                    driver_code=d_code,
                    stint=stint_res.stint,
                    compound=stint_res.compound,
                    total_laps=stint_res.total_laps,
                    valid_laps=stint_res.valid_laps,
                    degradation_rate=stint_res.degradation_rate,
                    base_pace=stint_res.base_pace,
                )
                all_patterns.append(pattern)

                comp = stint_res.compound
                if comp not in compound_groups:
                    compound_groups[comp] = []

                if stint_res.degradation_rate is not None:
                    b_pace = stint_res.base_pace if stint_res.base_pace is not None else 0.0
                    compound_groups[comp].append((stint_res.degradation_rate, stint_res.total_laps, b_pace))

    compound_summaries: List[HistoricalCompoundSummary] = []
    for comp, items in compound_groups.items():
        if items:
            degs = [it[0] for it in items]
            lengths = [it[1] for it in items]
            bases = [it[2] for it in items if it[2] > 0]

            compound_summaries.append(
                HistoricalCompoundSummary(
                    compound=comp,
                    sample_stints=len(items),
                    avg_degradation_rate=round(float(np.mean(degs)), 4),
                    avg_stint_length=round(float(np.mean(lengths)), 1),
                    avg_base_pace=round(float(np.mean(bases)), 3) if bases else None,
                )
            )

    return HistoricalStrategyReviewResponse(
        circuit=circuit_name,
        seasons=seasons,
        compound_summaries=compound_summaries,
        stints=all_patterns,
    )
