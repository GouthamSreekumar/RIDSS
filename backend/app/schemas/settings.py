"""
Pydantic v2 schemas for System Settings.
"""
from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class SystemSettingResponse(BaseModel):
    setting_id: str
    category: str
    key: str
    value: str
    updated_by: Optional[str] = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SystemSettingsUpdate(BaseModel):
    settings: Dict[str, str]  # key -> value map
