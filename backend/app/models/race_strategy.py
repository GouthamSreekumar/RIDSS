"""
RaceStrategy SQLAlchemy model.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class RaceStrategy(Base):
    __tablename__ = "race_strategies"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    team_id = Column(String, ForeignKey("teams.team_id"), nullable=False, index=True)
    session_id = Column(String, nullable=False, index=True)
    created_by = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    plan = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    creator = relationship("User")
    team = relationship("Team")
