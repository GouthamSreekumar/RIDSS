"""
LoginHistory Pydantic schemas.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class LoginHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    logged_in_at: datetime
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
