"""
Report SQLAlchemy model.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class Report(Base):
    __tablename__ = "reports"

    report_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    generated_by = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    team_id = Column(String, ForeignKey("teams.team_id"), nullable=True, index=True)
    report_type = Column(String, nullable=False)
    data = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    generator = relationship("User", back_populates="reports")
    team = relationship("Team")

