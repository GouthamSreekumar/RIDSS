import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.models.lap_note import LapNote
from app.models.saved_comparison import SavedComparison
from app.services.telemetry_export import export_lap_telemetry_pdf, generate_telemetry_chart_image
from sqlalchemy import select


async def main():
    print("--- Starting Race Engineer New Features Verification ---")
    async with AsyncSessionLocal() as db:
        # 1. Fetch an engineer user
        user_res = await db.execute(select(User).limit(1))
        user = user_res.scalar_one_or_none()
        if not user:
            print("No user found in DB.")
            return

        print(f"Testing for User: {user.full_name} ({user.user_id})")

        # 2. Test LapNote creation
        note = LapNote(
            user_id=user.user_id,
            session_id="2024_Bahrain_Race",
            driver="VER",
            lap_number=10,
            content="T7 apex speed looks strong, braking 5m earlier than baseline.",
        )
        db.add(note)
        await db.commit()
        await db.refresh(note)
        print(f"Created LapNote ID: {note.id} for lap {note.lap_number}")

        # Fetch LapNote
        notes_res = await db.execute(
            select(LapNote).where(
                LapNote.session_id == "2024_Bahrain_Race",
                LapNote.driver == "VER",
                LapNote.lap_number == 10,
            )
        )
        notes = notes_res.scalars().all()
        print(f"Fetched {len(notes)} note(s) for 2024_Bahrain_Race VER L10:")
        for n in notes:
            print(f"  - Note content: '{n.content}' by user {n.user_id}")

        # Clean up note
        await db.delete(note)
        await db.commit()
        print("LapNote test passed & cleaned up.")

        # 3. Test SavedComparison creation
        comp = SavedComparison(
            user_id=user.user_id,
            season=2024,
            circuit="Bahrain",
            session_type="Race",
            driver_a="VER",
            lap_a=10,
            driver_b="PER",
            lap_b=10,
            comparison_type="driver_vs_driver",
            label="Bahrain VER vs PER Lap 10 delta",
        )
        db.add(comp)
        await db.commit()
        await db.refresh(comp)
        print(f"Created SavedComparison ID: {comp.id} label: '{comp.label}'")

        # Clean up comp
        await db.delete(comp)
        await db.commit()
        print("SavedComparison test passed & cleaned up.")

        # 4. Test PDF Export generation
        sample_pts = [
            {"distance": 0, "speed": 210, "rpm": 11000, "throttle": 100, "brake": 0, "gear": 5, "x": 0, "y": 0},
            {"distance": 100, "speed": 280, "rpm": 12500, "throttle": 100, "brake": 0, "gear": 6, "x": 100, "y": 20},
            {"distance": 200, "speed": 120, "rpm": 9000, "throttle": 0, "brake": 80, "gear": 3, "x": 180, "y": 90},
        ]
        sample_corners = [{"number": 1, "x": 180, "y": 90}]
        sample_notes = [{"author_name": user.full_name, "content": "Sample PDF export note", "created_at": "2026-09-26T10:00:00Z"}]

        pdf_bytes = export_lap_telemetry_pdf(
            session_name="Race",
            circuit_name="Bahrain",
            season=2024,
            driver_code="VER",
            driver_number=1,
            lap_number=10,
            lap_time_str="1:32.450",
            telemetry_points=sample_pts,
            corners=sample_corners,
            notes=sample_notes,
            engineer_name=user.full_name,
        )
        print(f"Successfully generated ReportLab PDF bytes! Length: {len(pdf_bytes)} bytes")

    print("--- Verification Completed Successfully ---")


if __name__ == "__main__":
    asyncio.run(main())
