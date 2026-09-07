"""
Team SQLAlchemy model.
"""
import uuid
from sqlalchemy import Column, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class Team(Base):
    __tablename__ = "teams"

    team_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    team_name = Column(String, nullable=False, index=True)
    principal = Column(String, nullable=True)
    headquarters = Column(String, nullable=True)

    users = relationship("User", back_populates="team")
    vehicles = relationship("Vehicle", back_populates="team")
