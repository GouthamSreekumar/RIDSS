"""
Pydantic v2 schemas for Audit Logs.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    log_id: str
    user_id: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    user_email: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
