"""
Cache pre-warming script for FastF1 telemetry.
Pre-loads a curated set of demo sessions into disk cache so live requests run instantly.
Run once during setup: python -m scripts.prewarm_cache
"""
import logging
import os
import fastf1

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

# Cache directory configuration
CACHE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    ".fastf1_cache",
)
os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

DEMO_SESSIONS = [
    {"season": 2023, "circuit": "Bahrain", "session": "Race"},
    {"season": 2023, "circuit": "Bahrain", "session": "Qualifying"},
    {"season": 2023, "circuit": "Monaco", "session": "Race"},
    {"season": 2024, "circuit": "Bahrain", "session": "Race"},
    {"season": 2024, "circuit": "Monaco", "session": "Race"},
]


def prewarm_demo_cache():
    logger.info("Starting FastF1 cache pre-warming for %d demo sessions...", len(DEMO_SESSIONS))
    for s_info in DEMO_SESSIONS:
        season = s_info["season"]
        circuit = s_info["circuit"]
        stype = s_info["session"]
        logger.info("Pre-loading FastF1 session: %d %s %s...", season, circuit, stype)
        try:
            session = fastf1.get_session(season, circuit, stype)
            session.load(laps=True, telemetry=True, weather=True)
            logger.info("Successfully cached: %d %s %s (%d laps)", season, circuit, stype, len(session.laps))
        except Exception as e:
            logger.warning("Failed to pre-warm session %d %s %s: %s", season, circuit, stype, e)

    logger.info("Cache pre-warming completed.")


if __name__ == "__main__":
    prewarm_demo_cache()
