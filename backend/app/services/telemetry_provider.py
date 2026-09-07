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

from app.schemas.race_engineer import (
    ComparisonData,
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
    Designed so additive providers (e.g. OpenF1RaceControlProvider) can be added seamlessly.
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
        """Fetch distance-aligned comparison telemetry for two laps."""
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
            for _, row in schedule.iterrows():
                # Filter out pre-season testing if desired, keep Grand Prix events
                if _clean_val(row.get("EventName")):
                    events.append(
                        {
                            "round_number": _clean_val(row.get("RoundNumber")),
                            "country": _clean_val(row.get("Country"), "Unknown"),
                            "location": _clean_val(row.get("Location"), "Unknown"),
                            "event_name": _clean_val(row.get("EventName")),
                            "official_event_name": _clean_val(row.get("OfficialEventName")),
                            "event_date": str(row.get("EventDate")) if pd.notna(row.get("EventDate")) else None,
                            "format": _clean_val(row.get("EventFormat")),
                        }
                    )
            return events
        except Exception as e:
            logger.error("Error fetching event schedule for season %s: %s", season, e)
            return []

    def _load_fastf1_session(self, season: int, circuit_name: str, session_type: str, telemetry: bool = False):
        """Helper to get and load a FastF1 session object."""
        # FastF1 maps session types: 'FP1', 'FP2', 'FP3', 'Qualifying', 'Race', 'Sprint'
        session = fastf1.get_session(season, circuit_name, session_type)
        session.load(laps=True, telemetry=telemetry, weather=True)
        return session

    def get_session_overview(
        self,
        season: int,
        circuit_name: str,
        session_type: str,
        filter_driver_codes: Optional[List[str]] = None,
    ) -> SessionOverview:
        session = self._load_fastf1_session(season, circuit_name, session_type, telemetry=False)
        laps_df = session.laps

        if filter_driver_codes:
            # Filter laps dataframe by requested driver codes (case-insensitive)
            upper_codes = [c.upper() for c in filter_driver_codes]
            laps_df = laps_df[laps_df["Driver"].isin(upper_codes)]

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
                    speed_st=_clean_val(row.get("SpeedST")),
                    speed_fl=_clean_val(row.get("SpeedFL")),
                    speed_i1=_clean_val(row.get("SpeedI1")),
                    speed_i2=_clean_val(row.get("SpeedI2")),
                )
                driver_lap_map[driver_code].append(lap_summary)

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
            # Fallback to fastest lap if specified lap doesn't exist
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
                # Extract x, y if present in telemetry or position df
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
            telemetry_points=points,
            track_geometry=None,  # Populated at service layer from DB if available
        )

    def get_comparison(
        self,
        primary_session: Dict[str, Any],
        secondary_session: Dict[str, Any],
    ) -> ComparisonData:
        """
        Compare two lap telemetry traces aligned on Distance.
        primary_session & secondary_session dicts contain:
          season, circuit_name, session_type, driver_code, lap_number
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

        p_dists = np.array([pt.distance for pt in p_tel.telemetry_points])
        p_speeds = np.array([pt.speed for pt in p_tel.telemetry_points])
        s_dists = np.array([pt.distance for pt in s_tel.telemetry_points])
        s_speeds = np.array([pt.speed for pt in s_tel.telemetry_points])

        if len(p_dists) > 0 and len(s_dists) > 0:
            # Common distance grid (0 to min max-distance)
            max_dist = min(p_dists[-1], s_dists[-1])
            common_dist = np.linspace(0, max_dist, num=min(300, len(p_dists)))

            p_speed_interp = np.interp(common_dist, p_dists, p_speeds)
            s_speed_interp = np.interp(common_dist, s_dists, s_speeds)
            speed_delta = p_speed_interp - s_speed_interp

            aligned_dist_list = [round(float(d), 2) for d in common_dist]
            speed_delta_list = [round(float(sd), 2) for sd in speed_delta]
        else:
            aligned_dist_list = []
            speed_delta_list = []

        return ComparisonData(
            primary_driver=primary_session["driver_code"],
            primary_lap=primary_session["lap_number"],
            primary_telemetry=p_tel,
            secondary_driver=secondary_session["driver_code"],
            secondary_lap=secondary_session["lap_number"],
            secondary_telemetry=s_tel,
            aligned_distance=aligned_dist_list,
            speed_delta=speed_delta_list,
            time_delta_seconds=[],
        )


# Global provider instance
telemetry_provider = FastF1TelemetryProvider()
