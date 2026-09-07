"""
Race & Circuit Management API endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.rbac import require_permission
from app.db.session import get_db
from app.models.race_circuit import Circuit, Race
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.race_circuit import (
    CircuitCreate,
    CircuitResponse,
    CircuitUpdate,
    RaceCreate,
    RaceResponse,
    RaceUpdate,
)
from app.services.audit import log_audit_event

races_router = APIRouter(prefix="/races", tags=["races"])
circuits_router = APIRouter(prefix="/circuits", tags=["circuits"])


# ── Circuits Endpoints ──────────────────────────────────────────────────────

@circuits_router.post("", response_model=CircuitResponse, status_code=status.HTTP_201_CREATED)
async def create_circuit(
    circuit_in: CircuitCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("circuits:create")),
) -> CircuitResponse:
    """
    Create a new circuit record.
    """
    new_circuit = Circuit(
        circuit_name=circuit_in.circuit_name,
        country=circuit_in.country,
        length=circuit_in.length,
    )
    db.add(new_circuit)
    await db.flush()

    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="CIRCUIT_CREATE",
        entity_type="Circuit",
        entity_id=new_circuit.circuit_id,
        details=circuit_in.model_dump(),
        request=request,
    )

    await db.commit()
    await db.refresh(new_circuit)
    return new_circuit


@circuits_router.get("", response_model=List[CircuitResponse])
async def list_circuits(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_permission("circuits:read")),
) -> List[CircuitResponse]:
    """
    List all circuits.
    """
    res = await db.execute(select(Circuit).order_by(Circuit.circuit_name.asc()))
    return res.scalars().all()


@circuits_router.put("/{circuit_id}", response_model=CircuitResponse)
async def update_circuit(
    circuit_id: str,
    circuit_in: CircuitUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("circuits:update")),
) -> CircuitResponse:
    """
    Update circuit details.
    """
    res = await db.execute(select(Circuit).where(Circuit.circuit_id == circuit_id))
    circuit = res.scalar_one_or_none()
    if not circuit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Circuit with ID '{circuit_id}' not found.",
        )

    if circuit_in.circuit_name is not None:
        circuit.circuit_name = circuit_in.circuit_name
    if circuit_in.country is not None:
        circuit.country = circuit_in.country
    if circuit_in.length is not None:
        circuit.length = circuit_in.length

    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="CIRCUIT_UPDATE",
        entity_type="Circuit",
        entity_id=circuit.circuit_id,
        details=circuit_in.model_dump(exclude_unset=True),
        request=request,
    )

    await db.commit()
    await db.refresh(circuit)
    return circuit


@circuits_router.delete("/{circuit_id}", response_model=MessageResponse)
async def delete_circuit(
    circuit_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("circuits:delete")),
) -> MessageResponse:
    """
    Delete a circuit record if not referenced by any race.
    """
    res = await db.execute(select(Circuit).where(Circuit.circuit_id == circuit_id))
    circuit = res.scalar_one_or_none()
    if not circuit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Circuit with ID '{circuit_id}' not found.",
        )

    # Check if any race references this circuit
    races_res = await db.execute(select(Race).where(Race.circuit_id == circuit_id))
    if races_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete circuit because it is referenced by existing race events. Delete those races first.",
        )

    await db.delete(circuit)

    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="CIRCUIT_DELETE",
        entity_type="Circuit",
        entity_id=circuit_id,
        details={"circuit_name": circuit.circuit_name},
        request=request,
    )

    await db.commit()
    return MessageResponse(message=f"Circuit '{circuit.circuit_name}' deleted successfully.")


# ── Races Endpoints ─────────────────────────────────────────────────────────

@races_router.post("", response_model=RaceResponse, status_code=status.HTTP_201_CREATED)
async def create_race(
    race_in: RaceCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("races:create")),
) -> RaceResponse:
    """
    Create a new race event on the calendar.
    """
    circuit_res = await db.execute(select(Circuit).where(Circuit.circuit_id == race_in.circuit_id))
    if not circuit_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Circuit with ID '{race_in.circuit_id}' does not exist.",
        )

    new_race = Race(
        race_name=race_in.race_name,
        circuit_id=race_in.circuit_id,
        race_date=race_in.race_date,
        season=race_in.season,
    )
    db.add(new_race)
    await db.flush()

    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="RACE_CREATE",
        entity_type="Race",
        entity_id=new_race.race_id,
        details={"race_name": race_in.race_name, "season": race_in.season, "race_date": race_in.race_date.isoformat()},
        request=request,
    )

    await db.commit()

    res = await db.execute(
        select(Race).options(selectinload(Race.circuit)).where(Race.race_id == new_race.race_id)
    )
    return res.scalar_one()


@races_router.get("", response_model=List[RaceResponse])
@races_router.get("/calendar", response_model=List[RaceResponse])
async def list_races(
    season: Optional[int] = Query(None, description="Filter races by season year"),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_permission("races:read")),
) -> List[RaceResponse]:
    """
    Calendar view of races, option to filter by season.
    """
    stmt = select(Race).options(selectinload(Race.circuit))
    if season:
        stmt = stmt.where(Race.season == season)
    stmt = stmt.order_by(Race.race_date.asc())

    res = await db.execute(stmt)
    return res.scalars().all()


@races_router.put("/{race_id}", response_model=RaceResponse)
async def update_race(
    race_id: str,
    race_in: RaceUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("races:update")),
) -> RaceResponse:
    """
    Update race details on the calendar.
    """
    res = await db.execute(select(Race).where(Race.race_id == race_id))
    race = res.scalar_one_or_none()
    if not race:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Race with ID '{race_id}' not found.",
        )

    if race_in.circuit_id:
        circuit_res = await db.execute(select(Circuit).where(Circuit.circuit_id == race_in.circuit_id))
        if not circuit_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Circuit with ID '{race_in.circuit_id}' does not exist.",
            )
        race.circuit_id = race_in.circuit_id

    if race_in.race_name is not None:
        race.race_name = race_in.race_name
    if race_in.race_date is not None:
        race.race_date = race_in.race_date
    if race_in.season is not None:
        race.season = race_in.season

    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="RACE_UPDATE",
        entity_type="Race",
        entity_id=race.race_id,
        details=race_in.model_dump(exclude_unset=True),
        request=request,
    )

    await db.commit()

    updated_res = await db.execute(
        select(Race).options(selectinload(Race.circuit)).where(Race.race_id == race_id)
    )
    return updated_res.scalar_one()


@races_router.delete("/{race_id}", response_model=MessageResponse)
async def delete_race(
    race_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("races:delete")),
) -> MessageResponse:
    """
    Delete a race event from the calendar.
    """
    res = await db.execute(select(Race).where(Race.race_id == race_id))
    race = res.scalar_one_or_none()
    if not race:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Race with ID '{race_id}' not found.",
        )

    await db.delete(race)

    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="RACE_DELETE",
        entity_type="Race",
        entity_id=race_id,
        details={"race_name": race.race_name},
        request=request,
    )

    await db.commit()
    return MessageResponse(message=f"Race '{race.race_name}' deleted successfully.")

