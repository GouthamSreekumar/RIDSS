"""
Pydantic v2 schemas for Races and Circuits.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class CircuitCreate(BaseModel):
    circuit_name: str = Field(..., min_length=2, max_length=100)
    country: str = Field(..., min_length=2, max_length=100)
    length: float = Field(..., gt=0)  # Length in km


class CircuitUpdate(BaseModel):
    circuit_name: Optional[str] = Field(None, min_length=2, max_length=100)
    country: Optional[str] = None
    length: Optional[float] = Field(None, gt=0)


class CircuitResponse(BaseModel):
    circuit_id: str
    circuit_name: str
    country: str
    length: float

    model_config = ConfigDict(from_attributes=True)


class RaceCreate(BaseModel):
    race_name: str = Field(..., min_length=2, max_length=100)
    circuit_id: str
    race_date: datetime
    season: int = Field(..., ge=1950, le=2100)


class RaceUpdate(BaseModel):
    race_name: Optional[str] = Field(None, min_length=2, max_length=100)
    circuit_id: Optional[str] = None
    race_date: Optional[datetime] = None
    season: Optional[int] = Field(None, ge=1950, le=2100)


class RaceResponse(BaseModel):
    race_id: str
    race_name: str
    circuit_id: str
    race_date: datetime
    season: int
    circuit: Optional[CircuitResponse] = None

    model_config = ConfigDict(from_attributes=True)
