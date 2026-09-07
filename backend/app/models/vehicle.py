"""
Vehicle SQLAlchemy model.
"""
import enum
import uuid
from sqlalchemy import Column, ForeignKey, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class VehicleStatus(str, enum.Enum):
    READY = "ready"
    MAINTENANCE = "maintenance"
    RETIRED = "retired"


class Vehicle(Base):
    __tablename__ = "vehicles"

    vehicle_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    team_id = Column(String, ForeignKey("teams.team_id"), nullable=False, index=True)
    chassis = Column(String, nullable=False)
    engine = Column(String, nullable=False)
    status = Column(String, default=VehicleStatus.READY.value, nullable=False)

    team = relationship("Team", back_populates="vehicles")
    components = relationship("Component", back_populates="vehicle")
    maintenances = relationship("Maintenance", back_populates="vehicle")
