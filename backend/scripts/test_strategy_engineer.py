import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.v1.endpoints.strategy_engineer import _current_season, _is_upcoming, _get_upcoming_events_list
from app.schemas.strategy_engineer import RaceStrategyCreate, StintPlan, PreRacePlanningReference
from app.services.strategy_analysis import build_pre_race_planning_reference


async def test_strategy_engineer_logic():
    print("Testing Strategy Engineer pre-race planning logic...")

    # 1. Current Season
    season = _current_season()
    assert season >= 2024
    print(f"Current season: {season}")

    # 2. Upcoming date check
    assert _is_upcoming("2099-01-01") is True
    assert _is_upcoming("2000-01-01") is False
    print("Date comparison check passed.")

    # 3. Upcoming events list
    upcoming = await _get_upcoming_events_list(season)
    print(f"Found {len(upcoming)} upcoming events for season {season}.")
    for ev in upcoming:
        assert ev.get("round_number", 0) > 0
        assert _is_upcoming(ev.get("event_date")) is True

    # 4. Strategy Create payload schema validation
    create_payload = RaceStrategyCreate(
        season=season,
        round=1,
        driver_code="VER",
        title="Bahrain Strategy Plan A",
        plan=[
            StintPlan(stint_number=1, compound="SOFT", start_lap=1, end_lap=18, planned_laps=18, fresh_tyres=True),
            StintPlan(stint_number=2, compound="HARD", start_lap=19, end_lap=57, planned_laps=39, fresh_tyres=True),
        ],
        total_laps=57,
    )
    assert create_payload.season == season
    assert create_payload.round == 1
    assert create_payload.driver_code == "VER"
    print("RaceStrategyCreate schema validation passed.")

    # 5. Planning reference builder
    ref = build_pre_race_planning_reference(
        event_name="Bahrain Grand Prix",
        circuit_name="Bahrain",
        season=season,
        round_number=1,
        pit_loss_seconds=22.5,
        default_total_laps=57,
        historical_review=None,
    )
    assert ref.circuit_name == "Bahrain"
    assert ref.pit_loss_seconds == 22.5
    assert ref.default_total_laps == 57
    assert len(ref.compounds) > 0
    print("Pre-race planning reference test passed successfully!")


if __name__ == "__main__":
    asyncio.run(test_strategy_engineer_logic())
