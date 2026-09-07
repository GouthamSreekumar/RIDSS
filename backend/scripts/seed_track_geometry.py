"""
Seed script for track geometry GeoJSON outlines and FastF1 driver mapping.
Run once during system setup: python scripts/seed_track_geometry.py
"""
import asyncio
import json
import logging
import uuid
from typing import Any, Dict, List

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import AsyncSessionLocal
from app.models.driver import Driver
from app.models.race_circuit import Circuit
from app.models.user import User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Sample GeoJSON Track Geometries for F1 Calendar circuits
# Represented as standard GeoJSON LineString coordinates [lon, lat]
def _generate_synthetic_track_geojson(circuit_name: str) -> Dict[str, Any]:
    """Generates standard GeoJSON geometry object for track map rendering."""
    # Custom outline shapes based on circuit character
    num_points = 50
    import math

    if "Monaco" in circuit_name:
        # Tight winding harbour loop
        coords = [
            [round(7.42 + 0.005 * math.cos(t) + 0.003 * math.sin(2 * t), 5),
             round(43.73 + 0.004 * math.sin(t) + 0.002 * math.cos(3 * t), 5)]
            for t in [i * (2 * math.pi / num_points) for i in range(num_points)]
        ]
    elif "Monza" in circuit_name:
        # High speed oval with chicanes
        coords = [
            [round(9.28 + 0.015 * math.cos(t), 5),
             round(45.61 + 0.006 * math.sin(t) + 0.002 * math.sin(3 * t), 5)]
            for t in [i * (2 * math.pi / num_points) for i in range(num_points)]
        ]
    elif "Silverstone" in circuit_name:
        # Fast sweeping curves
        coords = [
            [round(-1.01 + 0.012 * math.cos(t) + 0.004 * math.sin(2 * t), 5),
             round(52.07 + 0.010 * math.sin(t) + 0.003 * math.cos(2 * t), 5)]
            for t in [i * (2 * math.pi / num_points) for i in range(num_points)]
        ]
    elif "Spa" in circuit_name:
        # Long undulating lap with Eau Rouge compression
        coords = [
            [round(5.97 + 0.018 * math.cos(t) + 0.005 * math.sin(3 * t), 5),
             round(50.43 + 0.014 * math.sin(t) + 0.006 * math.cos(2 * t), 5)]
            for t in [i * (2 * math.pi / num_points) for i in range(num_points)]
        ]
    else:
        # Generic F1 loop layout
        coords = [
            [round(0.01 * math.cos(t) + 0.003 * math.sin(2 * t), 5),
             round(0.008 * math.sin(t) + 0.002 * math.cos(3 * t), 5)]
            for t in [i * (2 * math.pi / num_points) for i in range(num_points)]
        ]

    # Close loop
    coords.append(coords[0])

    return {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": coords,
        },
        "properties": {
            "name": circuit_name,
            "revision": "2024",
        },
    }


F1_CALENDAR_CIRCUITS = [
    {"name": "Bahrain International Circuit", "country": "Bahrain", "length": 5.412},
    {"name": "Jeddah Corniche Circuit", "country": "Saudi Arabia", "length": 6.174},
    {"name": "Albert Park Circuit", "country": "Australia", "length": 5.278},
    {"name": "Suzuka International Racing Course", "country": "Japan", "length": 5.807},
    {"name": "Shanghai International Circuit", "country": "China", "length": 5.451},
    {"name": "Miami International Autodrome", "country": "USA", "length": 5.412},
    {"name": "Autodromo Enzo e Dino Ferrari", "country": "Italy", "length": 4.909},
    {"name": "Circuit de Monaco", "country": "Monaco", "length": 3.337},
    {"name": "Circuit Gilles-Villeneuve", "country": "Canada", "length": 4.361},
    {"name": "Circuit de Barcelona-Catalunya", "country": "Spain", "length": 4.657},
    {"name": "Red Bull Ring", "country": "Austria", "length": 4.318},
    {"name": "Silverstone Circuit", "country": "United Kingdom", "length": 5.891},
    {"name": "Hungaroring", "country": "Hungary", "length": 4.381},
    {"name": "Circuit de Spa-Francorchamps", "country": "Belgium", "length": 7.004},
    {"name": "Circuit Zandvoort", "country": "Netherlands", "length": 4.259},
    {"name": "Autodromo Nazionale Monza", "country": "Italy", "length": 5.793},
    {"name": "Baku City Circuit", "country": "Azerbaijan", "length": 6.003},
    {"name": "Marina Bay Street Circuit", "country": "Singapore", "length": 4.940},
    {"name": "Circuit of the Americas", "country": "USA", "length": 5.513},
    {"name": "Autódromo Hermanos Rodríguez", "country": "Mexico", "length": 4.304},
    {"name": "Autódromo José Carlos Pace", "country": "Brazil", "length": 4.309},
    {"name": "Las Vegas Strip Circuit", "country": "USA", "length": 6.201},
    {"name": "Lusail International Circuit", "country": "Qatar", "length": 5.419},
    {"name": "Yas Marina Circuit", "country": "UAE", "length": 5.281},
]


async def seed_track_geometry_and_drivers():
    async with AsyncSessionLocal() as session:
        logger.info("Starting track geometry and FastF1 driver seeding...")

        # 1. Seed circuits
        existing_circuits_res = await session.execute(select(Circuit))
        existing_circuits = {c.circuit_name: c for c in existing_circuits_res.scalars().all()}

        for c_data in F1_CALENDAR_CIRCUITS:
            c_name = c_data["name"]
            geom = _generate_synthetic_track_geojson(c_name)

            if c_name in existing_circuits:
                circuit = existing_circuits[c_name]
                circuit.track_geometry = geom
                circuit.country = c_data["country"]
                circuit.length = c_data["length"]
                logger.info("Updated existing circuit geometry: %s", c_name)
            else:
                new_circuit = Circuit(
                    circuit_id=str(uuid.uuid4()),
                    circuit_name=c_name,
                    country=c_data["country"],
                    length=c_data["length"],
                    track_geometry=geom,
                )
                session.add(new_circuit)
                logger.info("Created new circuit: %s", c_name)

        # 2. Update Driver FastF1 mapping
        drivers_res = await session.execute(select(Driver).options(selectinload(Driver.user)))
        drivers = drivers_res.scalars().all()

        for d in drivers:
            if d.user:
                full_name = d.user.full_name.lower()
                if "verstappen" in full_name or d.driver_number == 1:
                    d.fastf1_driver_number = 1
                    d.fastf1_code = "VER"
                    logger.info("Mapped Driver %s -> FastF1: 1 (VER)", d.user.full_name)
                elif "hadjar" in full_name or "perez" in full_name or d.driver_number in (2, 11):
                    # For demo 2023/2024 Red Bull analysis, map to PER (11) or HAD (6)
                    d.fastf1_driver_number = 11
                    d.fastf1_code = "PER"
                    logger.info("Mapped Driver %s -> FastF1: 11 (PER)", d.user.full_name)
                else:
                    # Fallback code
                    parts = d.user.full_name.split()
                    d.fastf1_driver_number = d.driver_number
                    d.fastf1_code = parts[-1][:3].upper() if parts else "DRV"
                    logger.info("Mapped Driver %s -> FastF1: %s (%s)", d.user.full_name, d.driver_number, d.fastf1_code)

        await session.commit()
        logger.info("Track geometry and driver seeding completed successfully.")


if __name__ == "__main__":
    asyncio.run(seed_track_geometry_and_drivers())
