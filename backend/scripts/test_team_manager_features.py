import asyncio
import os
import sys
from datetime import date

# Add backend root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import AsyncSessionLocal
from app.models.driver import Driver
from app.models.driver_vehicle_assignment import DriverVehicleAssignment
from app.models.team import Team
from app.models.user import User
from app.models.vehicle import Vehicle
from app.services.telemetry_provider import telemetry_provider
from app.api.v1.endpoints.team_manager import _compute_season_stats
from sqlalchemy import select
from sqlalchemy.orm import selectinload


async def main():
    print("--- Starting Team Manager Features Verification ---")
    async with AsyncSessionLocal() as db:
        # 1. Fetch a team and driver
        team_res = await db.execute(select(Team).limit(1))
        team = team_res.scalar_one_or_none()
        if not team:
            print("No team found in DB.")
            return

        print(f"Testing for Team: {team.team_name} ({team.team_id})")

        # 2. Test Driver team_since field update
        driver_res = await db.execute(
            select(Driver).join(User).where(User.team_id == team.team_id).limit(1)
        )
        driver = driver_res.scalar_one_or_none()
        if driver:
            today_date = date.today()
            driver.team_since = today_date
            await db.commit()
            await db.refresh(driver)
            print(f"Successfully set driver #{driver.driver_number} team_since to {driver.team_since}")

        # 3. Test Vehicle pairing history query
        vehicle_res = await db.execute(
            select(Vehicle).where(Vehicle.team_id == team.team_id).limit(1)
        )
        vehicle = vehicle_res.scalar_one_or_none()
        if vehicle:
            assign_res = await db.execute(
                select(DriverVehicleAssignment)
                .options(selectinload(DriverVehicleAssignment.driver).selectinload(Driver.user))
                .where(DriverVehicleAssignment.vehicle_id == vehicle.vehicle_id)
                .order_by(DriverVehicleAssignment.assigned_at.desc())
            )
            assignments = assign_res.scalars().all()
            print(f"Vehicle {vehicle.chassis} has {len(assignments)} pairing history entries:")
            for a in assignments:
                d_name = a.driver.user.full_name if (a.driver and a.driver.user) else "Unknown"
                print(f"  - Driver: {d_name}, Status: {a.status}, Assigned: {a.assigned_at}, Unassigned: {a.unassigned_at}")

        # 4. Test Season comparison calculation
        seasons = telemetry_provider.get_seasons()
        print(f"Available telemetry seasons: {seasons}")
        target_a = seasons[-1]
        target_b = seasons[-2] if len(seasons) >= 2 else (target_a - 1)
        events_a = await telemetry_provider.get_season_calendar_events(target_a, team_name=team.team_name)
        stats_a = _compute_season_stats(target_a, events_a)
        print(f"Season {target_a} Stats:")
        print(f"  - Total Points: {stats_a.total_points}")
        print(f"  - Wins: {stats_a.wins_count}, Podiums: {stats_a.podiums_count}")
        print(f"  - Avg Position: {stats_a.avg_finishing_position}")
        print(f"  - Races Completed: {stats_a.races_completed}/{stats_a.total_races}, Partial: {stats_a.is_partial}")

    print("--- Verification Completed Successfully ---")


if __name__ == "__main__":
    asyncio.run(main())
