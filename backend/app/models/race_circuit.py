"""
Circuit and Race SQLAlchemy models.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class Circuit(Base):
    __tablename__ = "circuits"

    circuit_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    circuit_name = Column(String, nullable=False, index=True)
    country = Column(String, nullable=False)
    length = Column(Float, nullable=False)  # in kilometers

    races = relationship("Race", back_populates="circuit")


class Race(Base):
    __tablename__ = "races"

    race_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    race_name = Column(String, nullable=False, index=True)
    circuit_id = Column(String, ForeignKey("circuits.circuit_id"), nullable=False, index=True)
    race_date = Column(DateTime(timezone=True), nullable=False)
    season = Column(Integer, nullable=False)

    circuit = relationship("Circuit", back_populates="races")
