"""
Permission SQLAlchemy model.
"""
import uuid
from sqlalchemy import Column, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class Permission(Base):
    __tablename__ = "permissions"

    permission_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    permission_key = Column(String, unique=True, nullable=False, index=True)  # e.g., "users:create"
    description = Column(Text, nullable=True)
    module = Column(String, nullable=False, index=True)  # e.g., "users", "teams"

    role_permissions = relationship("RolePermission", back_populates="permission", cascade="all, delete-orphan")
