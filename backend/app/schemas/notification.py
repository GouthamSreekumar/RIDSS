"""
Pydantic v2 schemas for Notifications.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class NotificationCreate(BaseModel):
    user_ids: List[str]  # Target users
    title: str = Field(..., min_length=2, max_length=200)
    message: str = Field(..., min_length=2)


class NotificationResponse(BaseModel):
    notification_id: str
    user_id: str
    title: str
    message: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(unread|read|archived)$")
