"""
Pydantic v2 schemas for Team management.
"""
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserResponse


class TeamCreate(BaseModel):
    team_name: str = Field(..., min_length=2, max_length=100)
    principal: Optional[str] = None
    headquarters: Optional[str] = None


class TeamUpdate(BaseModel):
    team_name: Optional[str] = Field(None, min_length=2, max_length=100)
    principal: Optional[str] = None
    headquarters: Optional[str] = None


class TeamResponse(BaseModel):
    team_id: str
    team_name: str
    principal: Optional[str] = None
    headquarters: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TeamDetailResponse(TeamResponse):
    members: List[UserResponse] = []

    model_config = ConfigDict(from_attributes=True)


class AssignTeamMemberRequest(BaseModel):
    user_id: str
