"""
CacheStatus SQLAlchemy model.
Tracks FastF1 telemetry pre-warming script runs.
"""
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, String, Text

from app.models.base import Base


class CacheStatus(Base):
    __tablename__ = "cache_status"

    id = Column(String, primary_key=True, default="default")
    last_prewarm_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, nullable=False, default="success")
    details = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
