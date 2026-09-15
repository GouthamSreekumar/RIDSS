"""
Cache pre-warming script for FastF1 telemetry.
Executes a 4-phase warming strategy across FastF1 disk cache and in-memory TTL cache:
1. Event schedules for all supported seasons
2. Results-only data for completed races of the target season
3. Tier 1 overview summaries (laps + weather, no telemetry) for key sessions
4. Tier 2 telemetry (laps + telemetry, no weather) for curated demo sessions

Run via CLI:
    python -m scripts.prewarm_cache [--season 2024] [--quick]
"""
import argparse
import concurrent.futures
import logging
import os
from datetime import datetime, timezone
import fastf1

from app.services.cache import fastf1_cache
from app.services.telemetry_provider import telemetry_provider

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

# Ensure disk cache directory exists and is enabled
CACHE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    ".fastf1_cache",
)
os.makedirs(CACHE_DIR, exist_ok=True)
try:
    fastf1.Cache.enable_cache(CACHE_DIR)
except Exception as e:
    logger.warning("Could not enable FastF1 disk cache: %s", e)

DEMO_TELEMETRY_SESSIONS = [
    {"season": 2023, "circuit": "Bahrain", "session": "Race"},
    {"season": 2024, "circuit": "Bahrain", "session": "Race"},
    {"season": 2024, "circuit": "Monaco", "session": "Race"},
]


def prewarm_phase_1_schedules(seasons: list) -> None:
    logger.info("=== Phase 1: Pre-warming Season Event Schedules ===")
    for season in seasons:
        try:
            events = telemetry_provider.get_event_schedule(season)
            logger.info("Cached schedule for season %s (%d events)", season, len(events))
        except Exception as e:
            logger.warning("Phase 1 failed for season %s: %s", season, e)


def prewarm_phase_2_results(season: int, quick: bool = False) -> None:
    logger.info("=== Phase 2: Pre-warming Results-Only for Completed Races (Season %s) ===", season)
    events = telemetry_provider.get_event_schedule(season)
    now_utc = datetime.now(timezone.utc)

    completed_rounds = []
    for ev in events:
        r_num = ev.get("round_number", 0)
        ev_date = ev.get("event_date")
        if r_num > 0 and ev_date:
            try:
                import pandas as pd
                dt_val = pd.to_datetime(ev_date)
                if dt_val.tz is None:
                    dt_val = dt_val.tz_localize("UTC")
                else:
                    dt_val = dt_val.tz_convert("UTC")
                if dt_val < now_utc:
                    completed_rounds.append(r_num)
            except Exception:
                pass

    if quick and len(completed_rounds) > 3:
        completed_rounds = completed_rounds[:3]

    logger.info("Found %d completed round(s) to pre-warm results-only for season %s", len(completed_rounds), season)

    def _warm_results(r_num):
        try:
            res = telemetry_provider._fetch_single_race_results(season, r_num)
            logger.info("Pre-warmed Round %s results (%d drivers)", r_num, len(res))
        except Exception as e:
            logger.warning("Failed results pre-warm for Round %s: %s", r_num, e)

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(_warm_results, r) for r in completed_rounds]
        concurrent.futures.wait(futures)


def prewarm_phase_3_overviews(sessions: list) -> None:
    logger.info("=== Phase 3: Pre-warming Tier 1 Overview Summaries (Laps + Weather) ===")
    for s_info in sessions:
        season = s_info["season"]
        circuit = s_info["circuit"]
        stype = s_info["session"]
        try:
            overview = telemetry_provider.get_session_overview(season, circuit, stype)
            logger.info(
                "Pre-warmed overview for %s %s %s (%d total laps)",
                season, circuit, stype, overview.total_laps
            )
        except Exception as e:
            logger.warning("Failed overview pre-warm for %s %s %s: %s", season, circuit, stype, e)


def prewarm_phase_4_telemetry(sessions: list) -> None:
    logger.info("=== Phase 4: Pre-warming Tier 2 Telemetry Streams ===")
    for s_info in sessions:
        season = s_info["season"]
        circuit = s_info["circuit"]
        stype = s_info["session"]
        try:
            # Pre-load session telemetry into disk cache + verify
            session = telemetry_provider._load_session_telemetry(season, circuit, stype)
            logger.info(
                "Pre-warmed telemetry for %s %s %s (%d laps)",
                season, circuit, stype, len(session.laps) if hasattr(session, "laps") else 0
            )
        except Exception as e:
            logger.warning("Failed telemetry pre-warm for %s %s %s: %s", season, circuit, stype, e)


def run_full_prewarm(target_season: int = 2024, quick: bool = False) -> None:
    logger.info("Starting RIDSS FastF1 multi-phase pre-warm (target_season=%s, quick=%s)...", target_season, quick)

    seasons = telemetry_provider.get_seasons()
    prewarm_phase_1_schedules(seasons)
    prewarm_phase_2_results(target_season, quick=quick)

    overview_sessions = [
        {"season": target_season, "circuit": "Bahrain", "session": "Race"},
        {"season": target_season, "circuit": "Monaco", "session": "Race"},
    ]
    prewarm_phase_3_overviews(overview_sessions)

    if not quick:
        prewarm_phase_4_telemetry(DEMO_TELEMETRY_SESSIONS)

    stats = fastf1_cache.stats()
    logger.info("Pre-warming complete. In-memory cache status: %s", stats)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="RIDSS FastF1 Cache Pre-warmer")
    parser.add_argument("--season", type=int, default=2024, help="Target season year to pre-warm results for")
    parser.add_argument("--quick", action="store_true", help="Quick mode: pre-warm schedules & top 3 rounds only")
    args = parser.parse_args()

    run_full_prewarm(target_season=args.season, quick=args.quick)
