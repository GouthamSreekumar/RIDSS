"""
DriverVehicleAssignment SQLAlchemy model.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class DriverVehicleAssignment(Base):
    __tablename__ = "driver_vehicle_assignments"

    assignment_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    team_id = Column(String, ForeignKey("teams.team_id", ondelete="CASCADE"), nullable=False, index=True)
    driver_id = Column(String, ForeignKey("drivers.driver_id", ondelete="CASCADE"), nullable=False, index=True)
    vehicle_id = Column(String, ForeignKey("vehicles.vehicle_id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String, default="active", nullable=False, index=True)  # active / inactive
    assigned_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    season = Column(Integer, nullable=True)

    team = relationship("Team")
    driver = relationship("Driver")
    vehicle = relationship("Vehicle")

    __table_args__ = (
        Index(
            "uq_active_driver_assignment",
            "driver_id",
            unique=True,
            postgresql_where=(status == "active"),
        ),
        Index(
            "uq_active_vehicle_assignment",
            "vehicle_id",
            unique=True,
            postgresql_where=(status == "active"),
        ),
    )
