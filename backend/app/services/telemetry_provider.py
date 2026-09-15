"""
Telemetry provider layer for RIDSS.
Provides abstract interface for telemetry sources and FastF1 implementation.
"""
import logging
import os
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
import fastf1
import fastf1.plotting
import fastf1.utils

from app.schemas.race_engineer import (
    ComparisonData,
    CornerMarker,
    DriverResult,
    LapSummary,
    LapTelemetry,
    SessionOverview,
    TelemetryPoint,
    WeatherSummary,
)

logger = logging.getLogger(__name__)

# Ensure disk cache directory exists and is enabled
CACHE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    ".fastf1_cache",
)
os.makedirs(CACHE_DIR, exist_ok=True)
try:
    fastf1.Cache.enable_cache(CACHE_DIR)
    logger.info("FastF1 Cache initialized at: %s", CACHE_DIR)
except Exception as e:
    logger.warning("Could not enable FastF1 disk cache: %s", e)


def is_same_team(ridss_team_name: Optional[str], fastf1_team_name: Optional[str]) -> bool:
    """
    Robust matching between RIDSS's configured team_name and FastF1's TeamName.
    Handles sponsorship / title-name variations across seasons (e.g. 'Oracle Red Bull Racing' vs 'Red Bull Racing').
    """
    if not ridss_team_name or not fastf1_team_name:
        return False

    t1 = str(ridss_team_name).lower().strip()
    t2 = str(fastf1_team_name).lower().strip()

    if t1 == t2 or t1 in t2 or t2 in t1:
        return True

    stopwords = {
        "oracle", "scuderia", "hp", "petronas", "amg", "bwt", "aramco",
        "visa", "cash", "app", "kick", "stake", "alfa", "romeo",
        "formula 1 team", "formula 1", "f1 team", "f1", "racing", "team"
    }

    def get_core_tokens(name: str) -> set:
        cleaned = "".join(c if c.isalnum() else " " for c in name.lower())
        tokens = set(cleaned.split())
        core = tokens - stopwords
        return core if core else tokens

    core1 = get_core_tokens(t1)
    core2 = get_core_tokens(t2)

    if core1 and core2 and (core1.issubset(core2) or core2.issubset(core1) or len(core1 & core2) > 0):
        return True

    return False


def _clean_val(val: Any, default: Any = None) -> Any:
    """Utility to convert pandas/numpy NaN/NaT values to standard Python None/default."""
    if val is None or pd.isna(val):
        return default
    if isinstance(val, (np.integer, np.int64, np.int32)):
        return int(val)
    if isinstance(val, (np.floating, np.float64, np.float32)):
        return float(val)
    if isinstance(val, np.bool_):
        return bool(val)
    return val


def _timedelta_to_seconds(td: Any) -> Optional[float]:
    """Convert pandas/datetime Timedelta to float seconds."""
    if pd.isna(td) or td is None:
        return None
    if hasattr(td, "total_seconds"):
        return round(float(td.total_seconds()), 3)
    return None


def _format_timedelta(td: Any) -> Optional[str]:
    """Format Timedelta to MM:SS.mmm string."""
    if pd.isna(td) or td is None:
        return None
    if hasattr(td, "total_seconds"):
        total_sec = float(td.total_seconds())
        minutes = int(total_sec // 60)
        seconds = total_sec % 60
        if minutes > 0:
            return f"{minutes}:{seconds:06.3f}"
        return f"{seconds:.3f}"
    return None


class AbstractRaceTelemetryProvider(ABC):
    """
    Abstract base class for telemetry data providers.
    """

    @abstractmethod
    def get_seasons(self) -> List[int]:
        """Return available dynamic season years."""
        pass

    @abstractmethod
    def get_event_schedule(self, season: int) -> List[Dict[str, Any]]:
        """Return list of events/circuits for a given season."""
        pass

    @abstractmethod
    def get_session_overview(
        self,
        season: int,
        circuit_name: str,
        session_type: str,
        filter_driver_codes: Optional[List[str]] = None,
    ) -> SessionOverview:
        """Fetch Tier 1 lap-level overview for session, filtered by driver codes."""
        pass

    @abstractmethod
    def get_lap_telemetry(
        self,
        season: int,
        circuit_name: str,
        session_type: str,
        driver_code: str,
        lap_number: int,
    ) -> LapTelemetry:
        """Fetch Tier 2 telemetry stream for a single lap."""
        pass

    @abstractmethod
    def get_comparison(
        self,
        primary_session: Dict[str, Any],
        secondary_session: Dict[str, Any],
    ) -> ComparisonData:
        """Fetch distance-aligned comparison telemetry for two laps using fastf1.utils.delta_time."""
        pass

    @abstractmethod
    def get_season_calendar_events(
        self, season: int, filter_driver_codes: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Fetch full season calendar events with filtered team driver results."""
        pass


class FastF1TelemetryProvider(AbstractRaceTelemetryProvider):
    """
    FastF1 implementation of telemetry provider.
    Handles caching, fetching, and transformation into normalized Pydantic schemas.
    """

    MIN_SEASON = 2023

    def get_seasons(self) -> List[int]:
        current_year = datetime.now(timezone.utc).year
        return list(range(self.MIN_SEASON, current_year + 1))

    def get_event_schedule(self, season: int) -> List[Dict[str, Any]]:
        try:
            schedule = fastf1.events.get_event_schedule(season)
            events = []
            known_formats = {"conventional", "sprint", "sprint_qualifying", "sprint_shootout", "testing"}

            for _, row in schedule.iterrows():
                event_name = _clean_val(row.get("EventName"))
                if not event_name:
                    continue

                round_num_raw = row.get("RoundNumber")
                try:
                    round_num = int(round_num_raw) if round_num_raw is not None and pd.notna(round_num_raw) else 0
                except (ValueError, TypeError):
                    round_num = 0

                event_fmt = str(_clean_val(row.get("EventFormat"), "")).lower()
                event_name_lower = str(event_name).lower()

                # Audit event format for edge cases
                if event_fmt and event_fmt not in known_formats:
                    logger.warning(
                        "Unrecognized FastF1 event format '%s' for event '%s' (Round %s, Season %s)",
                        event_fmt,
                        event_name,
                        round_num,
                        season,
                    )

                # Exclude pre-season testing sessions from race calendar
                if round_num <= 0 or event_fmt == "testing" or "testing" in event_name_lower:
                    logger.info("Excluding testing event from race calendar: %s (Round %s)", event_name, round_num)
                    continue

                # Determine best session/event date (prefer Session5DateUtc for race day, fall back to EventDate)
                event_date = None
                for col in ["Session5DateUtc", "Session5Date", "EventDate"]:
                    val = row.get(col)
                    if pd.notna(val):
                        event_date = str(val)
                        break

                events.append(
                    {
                        "round_number": round_num,
                        "country": _clean_val(row.get("Country"), "Unknown"),
                        "location": _clean_val(row.get("Location"), "Unknown"),
                        "event_name": event_name,
                        "official_event_name": _clean_val(row.get("OfficialEventName")),
                        "event_date": event_date,
                        "format": _clean_val(row.get("EventFormat")),
                    }
                )
            return events
        except Exception as e:
            logger.error("Error fetching event schedule for season %s: %s", season, e)
            return []

    def get_season_calendar_events(
        self, season: int, filter_driver_codes: Optional[List[str]] = None, team_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        events = self.get_event_schedule(season)
        now_utc = datetime.now(timezone.utc)
        upper_codes = [c.upper() for c in filter_driver_codes] if filter_driver_codes else []

        calendar_events = []
        for ev in events:
            ev_date_str = ev.get("event_date")
            is_past = False
            if ev_date_str:
                try:
                    dt_val = pd.to_datetime(ev_date_str)
                    if dt_val.tz is None:
                        dt_val = dt_val.tz_localize("UTC")
                    else:
                        dt_val = dt_val.tz_convert("UTC")
                    is_past = dt_val < now_utc
                except Exception as e:
                    logger.warning("Could not parse date '%s' for event '%s': %s", ev_date_str, ev.get("event_name"), e)
                    is_past = False

            # completed/upcoming status is derived directly from actual date comparison
            is_completed = is_past
            driver_results = []

            if is_completed:
                round_num = ev.get("round_number")
                if round_num and int(round_num) > 0:
                    try:
                        session = fastf1.get_session(season, int(round_num), "Race")
                        session.load(laps=False, telemetry=False, weather=False)
                        if hasattr(session, "results") and session.results is not None and not session.results.empty:
                            for _, res_row in session.results.iterrows():
                                d_code = str(_clean_val(res_row.get("Abbreviation") or res_row.get("Driver"), ""))
                                res_t_name = str(_clean_val(res_row.get("TeamName"), ""))

                                # Team-name matching takes precedence if provided, falling back to upper_codes
                                if team_name:
                                    if not is_same_team(team_name, res_t_name):
                                        continue
                                elif upper_codes and d_code.upper() not in upper_codes:
                                    continue

                                d_num = _clean_val(res_row.get("DriverNumber"), 0)
                                try:
                                    d_num = int(d_num)
                                except (ValueError, TypeError):
                                    d_num = 0

                                pos = _clean_val(res_row.get("Position") or res_row.get("ClassifiedPosition"))
                                pos_text = str(_clean_val(res_row.get("ClassifiedPosition"), "")) if res_row.get("ClassifiedPosition") else (str(int(pos)) if pos is not None else None)
                                pts = _clean_val(res_row.get("Points"))
                                stat = _clean_val(res_row.get("Status"))

                                driver_results.append(
                                    {
                                        "driver_code": d_code,
                                        "driver_number": d_num,
                                        "full_name": _clean_val(res_row.get("FullName")),
                                        "position": int(pos) if pos is not None else None,
                                        "position_text": pos_text,
                                        "points": float(pts) if pts is not None else None,
                                        "status": str(stat) if stat is not None else None,
                                    }
                                )
                    except Exception as e:
                        logger.warning("Could not load race results for round %s season %s: %s", round_num, season, e)

            calendar_events.append(
                {
                    "round_number": ev["round_number"],
                    "country": ev["country"],
                    "location": ev["location"],
                    "event_name": ev["event_name"],
                    "official_event_name": ev.get("official_event_name"),
                    "event_date": ev_date_str,
                    "format": ev.get("format"),
                    "is_completed": is_completed,
                    "driver_results": driver_results,
                }
            )

        return calendar_events

    def _load_fastf1_session(self, season: int, circuit_name: str, session_type: str, telemetry: bool = False):
        """Helper to get and load a FastF1 session object."""
        session = fastf1.get_session(season, circuit_name, session_type)
        session.load(laps=True, telemetry=telemetry, weather=True)
        return session

    def get_session_overview(
        self,
        season: int,
        circuit_name: str,
        session_type: str,
        filter_driver_codes: Optional[List[str]] = None,
        team_name: Optional[str] = None,
    ) -> SessionOverview:
        session = None
        laps_df = pd.DataFrame()
        try:
            session = self._load_fastf1_session(season, circuit_name, session_type, telemetry=False)
            if hasattr(session, "laps") and session.laps is not None:
                laps_df = session.laps
        except Exception as e:
            logger.warning("Could not load FastF1 session data for %s %s %s: %s", season, circuit_name, session_type, e)

        # ── Dynamic Per-Session Team Driver Resolution ──
        session_team_driver_codes: List[str] = []
        if team_name and hasattr(session, "results") and session.results is not None and not session.results.empty:
            avail_teams = set()
            for _, res_row in session.results.iterrows():
                f1_t_name = str(_clean_val(res_row.get("TeamName"), ""))
                if f1_t_name:
                    avail_teams.add(f1_t_name)
                d_code = str(_clean_val(res_row.get("Abbreviation") or res_row.get("Driver"), "")).upper()
                if is_same_team(team_name, f1_t_name) and d_code:
                    session_team_driver_codes.append(d_code)

            if not session_team_driver_codes:
                logger.warning(
                    "[Team Matching Warning] Configured team_name '%s' did not match any FastF1 team names for %s %s %s. FastF1 session team names available: %s",
                    team_name, season, circuit_name, session_type, list(avail_teams)
                )

        target_codes = (
            session_team_driver_codes
            if session_team_driver_codes
            else ([c.upper() for c in filter_driver_codes] if filter_driver_codes else [])
        )

        if target_codes and not laps_df.empty:
            laps_df = laps_df[laps_df["Driver"].astype(str).str.upper().isin(target_codes)]

        driver_lap_map: Dict[str, List[LapSummary]] = {}

        if not laps_df.empty:
            for _, row in laps_df.iterrows():
                driver_code = str(row["Driver"])
                if driver_code not in driver_lap_map:
                    driver_lap_map[driver_code] = []

                driver_num = _clean_val(row.get("DriverNumber"), 0)
                try:
                    driver_num = int(driver_num)
                except (ValueError, TypeError):
                    driver_num = 0

                lap_num = _clean_val(row.get("LapNumber"), 0)

                lap_summary = LapSummary(
                    lap_number=int(lap_num),
                    driver_code=driver_code,
                    driver_number=driver_num,
                    lap_time_seconds=_timedelta_to_seconds(row.get("LapTime")),
                    lap_time_str=_format_timedelta(row.get("LapTime")),
                    sector_1_seconds=_timedelta_to_seconds(row.get("Sector1Time")),
                    sector_2_seconds=_timedelta_to_seconds(row.get("Sector2Time")),
                    sector_3_seconds=_timedelta_to_seconds(row.get("Sector3Time")),
                    stint=_clean_val(row.get("Stint")),
                    compound=_clean_val(row.get("Compound")),
                    tyre_life=_clean_val(row.get("TyreLife")),
                    pit_in_time_str=_format_timedelta(row.get("PitInTime")),
                    pit_out_time_str=_format_timedelta(row.get("PitOutTime")),
                    track_status=str(_clean_val(row.get("TrackStatus"), "")) if row.get("TrackStatus") else None,
                    is_personal_best=bool(_clean_val(row.get("IsPersonalBest"), False)),
                    deleted=bool(_clean_val(row.get("Deleted"), False)),
                    deleted_reason=str(_clean_val(row.get("DeletedReason"))) if _clean_val(row.get("DeletedReason")) else None,
                    is_accurate=bool(_clean_val(row.get("IsAccurate"), True)),
                    speed_st=_clean_val(row.get("SpeedST")),
                    speed_fl=_clean_val(row.get("SpeedFL")),
                    speed_i1=_clean_val(row.get("SpeedI1")),
                    speed_i2=_clean_val(row.get("SpeedI2")),
                )
                driver_lap_map[driver_code].append(lap_summary)

        # Process Session Results (grid position, finish position, points, classification status)
        results_list: List[DriverResult] = []
        if hasattr(session, "results") and session.results is not None and not session.results.empty:
            for _, res_row in session.results.iterrows():
                d_code = str(_clean_val(res_row.get("Abbreviation") or res_row.get("Driver"), ""))
                d_num = _clean_val(res_row.get("DriverNumber"), 0)
                try:
                    d_num = int(d_num)
                except (ValueError, TypeError):
                    d_num = 0

                if target_codes and d_code and d_code.upper() not in target_codes:
                    continue

                grid_pos = _clean_val(res_row.get("GridPosition"))
                pos = _clean_val(res_row.get("Position") or res_row.get("ClassifiedPosition"))
                pts = _clean_val(res_row.get("Points"))
                stat = _clean_val(res_row.get("Status"))

                results_list.append(
                    DriverResult(
                        driver_code=d_code,
                        driver_number=d_num,
                        full_name=_clean_val(res_row.get("FullName")),
                        team_name=_clean_val(res_row.get("TeamName")),
                        grid_position=int(grid_pos) if grid_pos is not None else None,
                        position=int(pos) if pos is not None else None,
                        points=float(pts) if pts is not None else None,
                        status=str(stat) if stat is not None else None,
                    )
                )

        # Process Weather
        weather_summary = None
        if hasattr(session, "weather_data") and not session.weather_data.empty:
            w = session.weather_data.iloc[-1]
            weather_summary = WeatherSummary(
                air_temp=_clean_val(w.get("AirTemp")),
                track_temp=_clean_val(w.get("TrackTemp")),
                humidity=_clean_val(w.get("Humidity")),
                rainfall=bool(_clean_val(w.get("Rainfall"), False)),
            )

        session_id = f"{season}_{circuit_name.lower().replace(' ', '_')}_{session_type.lower()}"

        return SessionOverview(
            session_id=session_id,
            season=season,
            circuit_name=circuit_name,
            session_name=session.name if hasattr(session, "name") else session_type,
            total_laps=len(session.laps) if hasattr(session, "laps") else 0,
            weather_summary=weather_summary,
            session_results=results_list,
            driver_lap_summaries=driver_lap_map,
        )

    def get_lap_telemetry(
        self,
        season: int,
        circuit_name: str,
        session_type: str,
        driver_code: str,
        lap_number: int,
    ) -> LapTelemetry:
        session = self._load_fastf1_session(season, circuit_name, session_type, telemetry=True)
        driver_laps = session.laps.pick_drivers(driver_code.upper())

        if driver_laps.empty:
            raise ValueError(f"No laps found for driver {driver_code} in {season} {circuit_name} {session_type}")

        matching_lap = driver_laps[driver_laps["LapNumber"] == lap_number]
        if matching_lap.empty:
            matching_lap = driver_laps.pick_fastest()
        else:
            matching_lap = matching_lap.iloc[0]

        telemetry_df = matching_lap.get_telemetry()
        pos_df = None
        try:
            pos_df = matching_lap.get_pos_data()
        except Exception as e:
            logger.debug("Pos data fetch warning: %s", e)

        points: List[TelemetryPoint] = []
        if not telemetry_df.empty:
            for idx, row in telemetry_df.iterrows():
                x_val = _clean_val(row.get("X"), 0.0)
                y_val = _clean_val(row.get("Y"), 0.0)
                if x_val == 0.0 and y_val == 0.0 and pos_df is not None and idx < len(pos_df):
                    p_row = pos_df.iloc[idx]
                    x_val = _clean_val(p_row.get("X"), 0.0)
                    y_val = _clean_val(p_row.get("Y"), 0.0)

                b_val = row.get("Brake")
                brake_float = 1.0 if bool(b_val) else 0.0
                if isinstance(b_val, (int, float)):
                    brake_float = float(b_val)

                drs_val = _clean_val(row.get("DRS"), 0)
                try:
                    drs_int = int(drs_val)
                except Exception:
                    drs_int = 0

                points.append(
                    TelemetryPoint(
                        distance=round(float(_clean_val(row.get("Distance"), 0.0)), 2),
                        time_seconds=_timedelta_to_seconds(row.get("Time")) or 0.0,
                        speed=round(float(_clean_val(row.get("Speed"), 0.0)), 1),
                        rpm=int(_clean_val(row.get("RPM"), 0)),
                        throttle=round(float(_clean_val(row.get("Throttle"), 0.0)), 1),
                        brake=brake_float,
                        gear=int(_clean_val(row.get("nGear"), 0)),
                        drs=drs_int,
                        x=round(float(x_val), 2),
                        y=round(float(y_val), 2),
                    )
                )

        # Extract Corner Turn Markers from FastF1 get_circuit_info()
        corners_list: List[CornerMarker] = []
        try:
            circuit_info = session.get_circuit_info()
            if circuit_info is not None and hasattr(circuit_info, "corners") and not circuit_info.corners.empty:
                for _, c_row in circuit_info.corners.iterrows():
                    c_num = _clean_val(c_row.get("Number"), 0)
                    c_let = str(_clean_val(c_row.get("Letter"), "")) if c_row.get("Letter") and not pd.isna(c_row.get("Letter")) else ""
                    c_x = _clean_val(c_row.get("X"), 0.0)
                    c_y = _clean_val(c_row.get("Y"), 0.0)
                    corners_list.append(
                        CornerMarker(
                            number=int(c_num),
                            letter=c_let,
                            x=round(float(c_x), 2),
                            y=round(float(c_y), 2),
                        )
                    )
        except Exception as e:
            logger.warning("Could not fetch circuit corners info: %s", e)

        # Extract official driver color using fastf1.plotting
        driver_color = None
        try:
            d_color_str = fastf1.plotting.get_driver_color(driver_code.upper(), session=session)
            if d_color_str:
                driver_color = d_color_str if d_color_str.startswith("#") else f"#{d_color_str}"
        except Exception as e:
            logger.debug("Could not fetch driver color: %s", e)

        session_id = f"{season}_{circuit_name.lower().replace(' ', '_')}_{session_type.lower()}"
        driver_num = _clean_val(matching_lap.get("DriverNumber"), 0)
        try:
            driver_num = int(driver_num)
        except (ValueError, TypeError):
            driver_num = 0

        return LapTelemetry(
            session_id=session_id,
            driver_code=driver_code.upper(),
            driver_number=driver_num,
            lap_number=int(_clean_val(matching_lap.get("LapNumber"), lap_number)),
            lap_time_seconds=_timedelta_to_seconds(matching_lap.get("LapTime")),
            sector_1_seconds=_timedelta_to_seconds(matching_lap.get("Sector1Time")),
            sector_2_seconds=_timedelta_to_seconds(matching_lap.get("Sector2Time")),
            sector_3_seconds=_timedelta_to_seconds(matching_lap.get("Sector3Time")),
            telemetry_points=points,
            corners=corners_list,
            driver_color=driver_color,
        )

    def get_comparison(
        self,
        primary_session: Dict[str, Any],
        secondary_session: Dict[str, Any],
    ) -> ComparisonData:
        """
        Compare two lap telemetry traces using fastf1.utils.delta_time()
        and fastf1.plotting colors.
        """
        p_tel = self.get_lap_telemetry(
            season=primary_session["season"],
            circuit_name=primary_session["circuit_name"],
            session_type=primary_session["session_type"],
            driver_code=primary_session["driver_code"],
            lap_number=primary_session["lap_number"],
        )
        s_tel = self.get_lap_telemetry(
            season=secondary_session["season"],
            circuit_name=secondary_session["circuit_name"],
            session_type=secondary_session["session_type"],
            driver_code=secondary_session["driver_code"],
            lap_number=secondary_session["lap_number"],
        )

        aligned_dist_list: List[float] = []
        speed_delta_list: List[float] = []
        time_delta_list: List[float] = []

        try:
            p_session = self._load_fastf1_session(
                primary_session["season"],
                primary_session["circuit_name"],
                primary_session["session_type"],
                telemetry=True,
            )
            p_laps = p_session.laps.pick_drivers(primary_session["driver_code"].upper())
            p_lap = p_laps[p_laps["LapNumber"] == primary_session["lap_number"]]
            p_lap_row = p_lap.iloc[0] if not p_lap.empty else p_laps.pick_fastest()

            s_session = self._load_fastf1_session(
                secondary_session["season"],
                secondary_session["circuit_name"],
                secondary_session["session_type"],
                telemetry=True,
            )
            s_laps = s_session.laps.pick_drivers(secondary_session["driver_code"].upper())
            s_lap = s_laps[s_laps["LapNumber"] == secondary_session["lap_number"]]
            s_lap_row = s_lap.iloc[0] if not s_lap.empty else s_laps.pick_fastest()

            delta_time, ref_tel, comp_tel = fastf1.utils.delta_time(p_lap_row, s_lap_row)
            if not ref_tel.empty and not delta_time.empty:
                dists = ref_tel["Distance"].values
                deltas = delta_time.values
                aligned_dist_list = [round(float(d), 2) for d in dists]
                time_delta_list = [round(float(dt), 3) for dt in deltas]
                if "Speed" in ref_tel.columns and "Speed" in comp_tel.columns:
                    ref_speeds = ref_tel["Speed"].values
                    comp_speeds = np.interp(dists, comp_tel["Distance"].values, comp_tel["Speed"].values)
                    sp_diff = ref_speeds - comp_speeds
                    speed_delta_list = [round(float(sd), 2) for sd in sp_diff]
        except Exception as e:
            logger.warning("fastf1.utils.delta_time error, falling back to distance interpolation: %s", e)
            p_dists = np.array([pt.distance for pt in p_tel.telemetry_points])
            p_speeds = np.array([pt.speed for pt in p_tel.telemetry_points])
            s_dists = np.array([pt.distance for pt in s_tel.telemetry_points])
            s_speeds = np.array([pt.speed for pt in s_tel.telemetry_points])

            if len(p_dists) > 0 and len(s_dists) > 0:
                max_dist = min(p_dists[-1], s_dists[-1])
                common_dist = np.linspace(0, max_dist, num=min(300, len(p_dists)))
                p_speed_interp = np.interp(common_dist, p_dists, p_speeds)
                s_speed_interp = np.interp(common_dist, s_dists, s_speeds)
                aligned_dist_list = [round(float(d), 2) for d in common_dist]
                speed_delta_list = [round(float(sd), 2) for sd in (p_speed_interp - s_speed_interp)]

        primary_color = p_tel.driver_color
        secondary_color = s_tel.driver_color

        return ComparisonData(
            primary_driver=primary_session["driver_code"],
            primary_lap=primary_session["lap_number"],
            primary_telemetry=p_tel,
            primary_color=primary_color,
            secondary_driver=secondary_session["driver_code"],
            secondary_lap=secondary_session["lap_number"],
            secondary_telemetry=s_tel,
            secondary_color=secondary_color,
            aligned_distance=aligned_dist_list,
            speed_delta=speed_delta_list,
            time_delta_seconds=time_delta_list,
        )


# Global provider instance
telemetry_provider = FastF1TelemetryProvider()
