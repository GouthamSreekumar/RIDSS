"""
SystemSettings SQLAlchemy model.
"""
import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class SettingCategory(str, enum.Enum):
    AUTHENTICATION = "authentication"
    EMAIL = "email"
    SESSION = "session"


class SystemSettings(Base):
    __tablename__ = "system_settings"

    setting_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    category = Column(String, nullable=False, index=True)
    key = Column(String, unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False)
    updated_by = Column(String, ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    updater = relationship("User")
