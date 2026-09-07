"""
Pydantic v2 schemas for User management.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role_id: str
    team_id: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    role_id: Optional[str] = None
    team_id: Optional[str] = None
    status: Optional[str] = None


class UserStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(active|disabled)$")


class UserRoleResponse(BaseModel):
    role_id: str
    role_name: str

    model_config = ConfigDict(from_attributes=True)


class UserTeamResponse(BaseModel):
    team_id: str
    team_name: str

    model_config = ConfigDict(from_attributes=True)


class UserResponse(BaseModel):
    user_id: str
    full_name: str
    email: EmailStr
    role_id: str
    team_id: Optional[str] = None
    status: str
    created_at: datetime
    role: Optional[UserRoleResponse] = None
    team: Optional[UserTeamResponse] = None

    model_config = ConfigDict(from_attributes=True)
