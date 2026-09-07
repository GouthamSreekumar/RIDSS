"""
Component and Maintenance SQLAlchemy models.
"""
import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class ComponentStatus(str, enum.Enum):
    NEW = "new"
    GOOD = "good"
    WORN = "worn"
    CRITICAL = "critical"
    REPLACED = "replaced"


class MaintenanceStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class Component(Base):
    __tablename__ = "components"

    component_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    vehicle_id = Column(String, ForeignKey("vehicles.vehicle_id"), nullable=False, index=True)
    component_name = Column(String, nullable=False)
    status = Column(String, default=ComponentStatus.GOOD.value, nullable=False)

    vehicle = relationship("Vehicle", back_populates="components")


class Maintenance(Base):
    __tablename__ = "maintenances"

    maintenance_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    vehicle_id = Column(String, ForeignKey("vehicles.vehicle_id"), nullable=False, index=True)
    mechanic_id = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    maintenance_date = Column(DateTime(timezone=True), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default=MaintenanceStatus.SCHEDULED.value, nullable=False)

    vehicle = relationship("Vehicle", back_populates="maintenances")
    mechanic = relationship("User", back_populates="maintenances")
