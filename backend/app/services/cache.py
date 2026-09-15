"""
Shared in-memory TTL cache for FastF1 data.

Sits on top of FastF1's own disk cache — avoids re-parsing disk files on repeated
requests within the same running server session.

Key scheme:
    "{season}:{identifier}:{data_type}"
    e.g.  "2024:Bahrain:event_schedule"
          "2024:Bahrain:Race:overview"
          "2024:Bahrain:Race:telemetry:VER:10"
          "2024:calendar_events"

TTL guidelines (seconds):
    - Event schedules / circuit lists:         21600  (6 h)
    - Completed-race results / overview:       14400  (4 h)
    - Current-season recent overview:            900  (15 min)
    - Full lap telemetry (historical lap):      86400  (24 h)
    - Calendar events (full season):            1800  (30 min)
"""
import logging
import threading
import time
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# ── TTL constants (seconds) ───────────────────────────────────────────────────
TTL_EVENT_SCHEDULE = 6 * 3600        # 6 h — season schedule doesn't change
TTL_COMPLETED_RESULTS = 4 * 3600     # 4 h — historical race results are immutable
TTL_RECENT_OVERVIEW = 15 * 60        # 15 min — current-season data can update
TTL_LAP_TELEMETRY = 24 * 3600        # 24 h — historical lap telemetry never changes
TTL_CALENDAR_EVENTS = 30 * 60        # 30 min — calendar with driver results


class TTLCache:
    """
    Thread-safe in-memory cache with per-entry TTL expiry.

    FastF1 session.load() is CPU-bound (disk I/O + pandas parse), so all cached
    data is stored as extracted Python dicts / Pydantic objects — NOT raw FastF1
    session objects — to avoid shared mutable state across threads.
    """

    def __init__(self) -> None:
        self._store: Dict[str, Tuple[Any, float]] = {}  # key -> (value, expires_at)
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        """Return cached value if present and not expired, else None."""
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if time.monotonic() > expires_at:
                del self._store[key]
                logger.debug("Cache miss (expired): %s", key)
                return None
            logger.debug("Cache hit: %s", key)
            return value

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        """Store value under key with a TTL."""
        with self._lock:
            expires_at = time.monotonic() + ttl_seconds
            self._store[key] = (value, expires_at)
            logger.debug("Cache set: %s (TTL=%ds)", key, ttl_seconds)

    def invalidate(self, key: str) -> bool:
        """Remove a single key. Returns True if the key existed."""
        with self._lock:
            existed = key in self._store
            self._store.pop(key, None)
            return existed

    def invalidate_prefix(self, prefix: str) -> int:
        """Remove all keys that start with prefix. Returns count removed."""
        with self._lock:
            keys = [k for k in self._store if k.startswith(prefix)]
            for k in keys:
                del self._store[k]
            if keys:
                logger.info("Cache invalidated %d key(s) with prefix '%s'", len(keys), prefix)
            return len(keys)

    def clear(self) -> None:
        """Wipe the entire cache (useful for testing)."""
        with self._lock:
            self._store.clear()
            logger.info("Cache cleared")

    def stats(self) -> Dict[str, Any]:
        """Return a snapshot of cache state (entry count, live vs expired)."""
        with self._lock:
            now = time.monotonic()
            live = sum(1 for _, (_, exp) in self._store.items() if now <= exp)
            expired = len(self._store) - live
            return {
                "total_entries": len(self._store),
                "live_entries": live,
                "expired_not_yet_evicted": expired,
            }

    def evict_expired(self) -> int:
        """Proactively remove all expired entries. Returns count removed."""
        with self._lock:
            now = time.monotonic()
            expired_keys = [k for k, (_, exp) in self._store.items() if now > exp]
            for k in expired_keys:
                del self._store[k]
            if expired_keys:
                logger.debug("Evicted %d expired cache entries", len(expired_keys))
            return len(expired_keys)


# ── Helpers for standard key construction ────────────────────────────────────

def schedule_key(season: int) -> str:
    return f"{season}:event_schedule"


def calendar_key(season: int) -> str:
    return f"{season}:calendar_events"


def overview_key(season: int, circuit_name: str, session_type: str) -> str:
    slug = circuit_name.lower().replace(" ", "_")
    return f"{season}:{slug}:{session_type.lower()}:overview"


def telemetry_key(season: int, circuit_name: str, session_type: str, driver_code: str, lap_number: int) -> str:
    slug = circuit_name.lower().replace(" ", "_")
    return f"{season}:{slug}:{session_type.lower()}:telemetry:{driver_code.upper()}:{lap_number}"


def results_key(season: int, round_number: int) -> str:
    return f"{season}:round_{round_number}:results"


# ── Global singleton ──────────────────────────────────────────────────────────
fastf1_cache = TTLCache()
