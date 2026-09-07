"""
User SQLAlchemy model.
"""
import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship, synonym

from app.models.base import Base


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    DISABLED = "disabled"


class UserRoleEnum(str, enum.Enum):
    ADMINISTRATOR = "Administrator"
    TEAM_MANAGER = "Team Manager"
    RACE_ENGINEER = "Race Engineer"
    STRATEGY_ENGINEER = "Strategy Engineer"
    MECHANIC = "Mechanic"
    DRIVER = "Driver"


class User(Base):
    __tablename__ = "users"

    user_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role_id = Column(String, ForeignKey("roles.role_id"), nullable=False, index=True)
    team_id = Column(String, ForeignKey("teams.team_id"), nullable=True, index=True)
    status = Column(String, default=UserStatus.ACTIVE.value, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Synonyms & Properties for compatibility
    id = synonym("user_id")
    hashed_password = synonym("password_hash")

    @property
    def is_active(self) -> bool:
        return self.status == UserStatus.ACTIVE.value

    # Relationships
    role = relationship("Role", back_populates="users")
    team = relationship("Team", back_populates="users")
    driver_profile = relationship("Driver", back_populates="user", uselist=False)
    notifications = relationship("Notification", back_populates="user")
    reports = relationship("Report", back_populates="generator")
    maintenances = relationship("Maintenance", back_populates="mechanic")
