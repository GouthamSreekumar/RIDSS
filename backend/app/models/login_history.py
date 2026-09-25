"""
LoginHistory SQLAlchemy model.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class LoginHistory(Base):
    __tablename__ = "login_history"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    logged_in_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", back_populates="login_history")
