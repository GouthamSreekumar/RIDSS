"""
System Health Pydantic schemas.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class DatabaseHealth(BaseModel):
    status: str  # "Healthy" | "Unreachable"
    response_time_ms: Optional[float] = None
    details: str


class CacheHealth(BaseModel):
    status: str  # "Healthy" | "Degraded"
    size_bytes: int
    size_formatted: str
    last_prewarm_at: Optional[datetime] = None
    details: str


class MigrationHealth(BaseModel):
    status: str  # "Healthy" | "Degraded"
    current_head: str
    applied_version: str
    pending: bool
    details: str


class SystemHealthResponse(BaseModel):
    status: str  # "Healthy" | "Degraded" | "Critical"
    timestamp: datetime
    database: DatabaseHealth
    cache: CacheHealth
    migrations: MigrationHealth
