"""
Role SQLAlchemy model.
"""
import uuid
from sqlalchemy import Column, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class Role(Base):
    __tablename__ = "roles"

    role_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    role_name = Column(String, unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Relationships
    users = relationship("User", back_populates="role")
    role_permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")
