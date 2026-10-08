import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.v1.endpoints.strategy_engineer import (
    _current_season,
    _is_upcoming,
    _get_upcoming_events_list,
    get_upcoming_events,
    get_event_drivers,
    get_planning_reference,
)
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.schemas.strategy_engineer import (
    RaceStrategyCreate,
    StintPlan,
    PreRacePlanningReference,
    UpcomingEventsResponse,
)
from app.services.strategy_analysis import build_pre_race_planning_reference
from sqlalchemy import select


async def test_strategy_engineer_logic():
    print("Testing Strategy Engineer pre-race planning & next-season fallback logic...")

    # 1. Current Season
    season = _current_season()
    assert season >= 2024
    print(f"Current season: {season}")

    # 2. Date comparison check
    assert _is_upcoming("2099-01-01") is True
    assert _is_upcoming("2000-01-01") is False

    # 3. DB & User context for endpoint testing
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.email.like('%strategy%')).limit(1))
        user = res.scalar_one_or_none()
        if not user:
            res = await db.execute(select(User).limit(1))
            user = res.scalar_one_or_none()

        # Test GET /upcoming-events
        upcoming_resp = await get_upcoming_events(current_user=user)
        assert isinstance(upcoming_resp, UpcomingEventsResponse)
        print(f"Upcoming events response: {len(upcoming_resp.events)} events found (is_fallback={upcoming_resp.is_fallback_season}).")

        if upcoming_resp.events:
            ev = upcoming_resp.events[0]
            assert ev.season is not None
            assert ev.label is not None
            print(f"Sample upcoming event label: '{ev.label}' for season {ev.season}")

            # Test GET /upcoming-events/{round}/drivers with season
            drivers_resp = await get_event_drivers(round=ev.round, season=ev.season, db=db, current_user=user)
            assert drivers_resp.season == ev.season
            assert drivers_resp.round == ev.round
            print(f"Event drivers response: {len(drivers_resp.drivers)} drivers. Roster basis: '{drivers_resp.roster_basis_event}'")

            # Test GET /upcoming-events/{round}/planning-reference with season
            plan_ref = await get_planning_reference(round=ev.round, season=ev.season, db=db, current_user=user)
            assert plan_ref.season == ev.season
            assert plan_ref.round == ev.round
            print(f"Planning reference response: {plan_ref.event_name} pit loss={plan_ref.pit_loss_seconds}s")
        else:
            # If empty state
            assert upcoming_resp.reason_code == "SEASON_COMPLETE_NEXT_UNAVAILABLE"
            assert "complete" in upcoming_resp.message.lower()
            print("Empty state structure validated successfully.")

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
