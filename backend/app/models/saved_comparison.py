"""
SavedComparison SQLAlchemy model.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class SavedComparison(Base):
    __tablename__ = "saved_comparisons"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    season = Column(Integer, nullable=False)
    circuit = Column(String, nullable=False)
    session_type = Column(String, nullable=False, default="Race")
    driver_a = Column(String, nullable=False)
    lap_a = Column(Integer, nullable=False)
    driver_b = Column(String, nullable=True)
    season_b = Column(Integer, nullable=True)
    lap_b = Column(Integer, nullable=True)
    comparison_type = Column(String, nullable=False, default="driver_vs_driver")
    label = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User")
