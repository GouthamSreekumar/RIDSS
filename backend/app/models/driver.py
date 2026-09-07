"""
Driver SQLAlchemy model.
"""
import uuid
from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class Driver(Base):
    __tablename__ = "drivers"

    driver_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    driver_number = Column(Integer, nullable=False)
    nationality = Column(String, nullable=True)
    fastf1_driver_number = Column(Integer, nullable=True)
    fastf1_code = Column(String(3), nullable=True)

    user = relationship("User", back_populates="driver_profile")
