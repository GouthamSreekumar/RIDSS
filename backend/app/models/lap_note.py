"""
LapNote SQLAlchemy model.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class LapNote(Base):
    __tablename__ = "lap_notes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(String, nullable=False, index=True)
    driver = Column(String, nullable=False, index=True)
    lap_number = Column(Integer, nullable=False, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User")
