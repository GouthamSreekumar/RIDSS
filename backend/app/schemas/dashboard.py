"""
Pydantic v2 schemas for Admin Dashboard metrics.
"""
from typing import Any, Dict, List
from pydantic import BaseModel

from app.schemas.audit import AuditLogResponse


class AdminDashboardResponse(BaseModel):
    user_count: int
    team_count: int
    active_races_count: int
    recent_activity: List[AuditLogResponse]
    system_health: Dict[str, Any]
