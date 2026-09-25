"""
Seed script: Populates realistic Formula 1 components for all vehicles in the database.
Assigns diverse health statuses (good, needs_attention, critical) to exercise health roll-up rules.

Run via: venv\\Scripts\\python.exe -m scripts.seed_mechanic_components
"""
import asyncio
import logging
import sys
import uuid
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.component_maintenance import Component, ComponentStatus
from app.models.vehicle import Vehicle

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

STANDARD_F1_COMPONENTS = [
    ("ICE (Internal Combustion Engine)", "good"),
    ("MGU-K (Kinetic Motor Generator)", "good"),
    ("MGU-H (Heat Motor Generator)", "needs_attention"),
    ("Turbocharger (TC)", "good"),
    ("Energy Store (ES)", "good"),
    ("Control Electronics (CE)", "good"),
    ("Front Wing Assembly", "good"),
    ("Rear Wing & DRS Mechanism", "good"),
    ("Brake Discs & Calipers", "critical"),  # Serves to test CRITICAL health roll-up
    ("8-Speed Seamless Transmission", "needs_attention"),
    ("Hydraulic Actuation System", "good"),
    ("Front & Rear Dampers / Suspension", "good"),
    ("Floor & Diffuser Venturi Tunnels", "good"),
]

SECONDARY_CAR_COMPONENTS = [
    ("ICE (Internal Combustion Engine)", "good"),
    ("MGU-K (Kinetic Motor Generator)", "needs_attention"),
    ("MGU-H (Heat Motor Generator)", "good"),
    ("Turbocharger (TC)", "good"),
    ("Energy Store (ES)", "good"),
    ("Control Electronics (CE)", "good"),
    ("Front Wing Assembly", "good"),
    ("Rear Wing & DRS Mechanism", "good"),
    ("Brake Discs & Calipers", "good"),
    ("8-Speed Seamless Transmission", "good"),
    ("Hydraulic Actuation System", "good"),
    ("Front & Rear Dampers / Suspension", "good"),
    ("Floor & Diffuser Venturi Tunnels", "good"),
]


async def seed_components():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Vehicle))
        vehicles = result.scalars().all()

        if not vehicles:
            logger.warning("No vehicles found in database to seed components for.")
            return

        total_seeded = 0
        for idx, vehicle in enumerate(vehicles):
            # Check if vehicle already has components
            comp_res = await session.execute(
                select(Component).where(Component.vehicle_id == vehicle.vehicle_id)
            )
            existing = comp_res.scalars().all()
            if existing:
                logger.info("Vehicle %s (%s) already has %d components — skipping.", vehicle.chassis, vehicle.vehicle_id, len(existing))
                continue

            # Pick component template list
            template = STANDARD_F1_COMPONENTS if idx == 0 else SECONDARY_CAR_COMPONENTS

            for comp_name, initial_status in template:
                component = Component(
                    component_id=str(uuid.uuid4()),
                    vehicle_id=vehicle.vehicle_id,
                    component_name=comp_name,
                    status=initial_status,
                )
                session.add(component)
                total_seeded += 1

            logger.info("Seeded %d components for vehicle %s (%s)", len(template), vehicle.chassis, vehicle.vehicle_id)

        await session.commit()
        logger.info("Successfully seeded %d component records across %d vehicles.", total_seeded, len(vehicles))


if __name__ == "__main__":
    asyncio.run(seed_components())
