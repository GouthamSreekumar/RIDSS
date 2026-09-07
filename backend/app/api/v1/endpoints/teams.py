"""
Team Management API endpoints.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.rbac import require_permission
from app.db.session import get_db
from app.models.team import Team
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.auth import MessageResponse
from app.schemas.team import AssignTeamMemberRequest, TeamCreate, TeamDetailResponse, TeamResponse, TeamUpdate
from app.services.audit import log_audit_event

router = APIRouter(prefix="/teams", tags=["teams"])


@router.post("", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    team_in: TeamCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("teams:create")),
) -> TeamResponse:
    """
    Create a new team.
    """
    new_team = Team(
        team_name=team_in.team_name,
        principal=team_in.principal,
        headquarters=team_in.headquarters,
    )
    db.add(new_team)
    await db.flush()

    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="TEAM_CREATE",
        entity_type="Team",
        entity_id=new_team.team_id,
        details=team_in.model_dump(),
        request=request,
    )

    await db.commit()
    await db.refresh(new_team)
    return new_team


@router.get("", response_model=List[TeamResponse])
async def list_teams(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_permission("teams:read")),
) -> List[TeamResponse]:
    """
    List all registered teams.
    """
    res = await db.execute(select(Team).order_by(Team.team_name.asc()))
    return res.scalars().all()


@router.get("/{team_id}", response_model=TeamDetailResponse)
async def get_team(
    team_id: str,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_permission("teams:read")),
) -> TeamDetailResponse:
    """
    Get team details with nested members list.
    """
    res = await db.execute(
        select(Team)
        .options(selectinload(Team.users).selectinload(User.role))
        .where(Team.team_id == team_id)
    )
    team = res.scalar_one_or_none()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team with ID '{team_id}' not found.",
        )

    return TeamDetailResponse(
        team_id=team.team_id,
        team_name=team.team_name,
        principal=team.principal,
        headquarters=team.headquarters,
        members=team.users,
    )


@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: str,
    team_in: TeamUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("teams:update")),
) -> TeamResponse:
    """
    Update team information.
    """
    res = await db.execute(select(Team).where(Team.team_id == team_id))
    team = res.scalar_one_or_none()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team with ID '{team_id}' not found.",
        )

    if team_in.team_name is not None:
        team.team_name = team_in.team_name
    if team_in.principal is not None:
        team.principal = team_in.principal
    if team_in.headquarters is not None:
        team.headquarters = team_in.headquarters

    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="TEAM_UPDATE",
        entity_type="Team",
        entity_id=team.team_id,
        details=team_in.model_dump(exclude_unset=True),
        request=request,
    )

    await db.commit()
    await db.refresh(team)
    return team


@router.post("/{team_id}/members", response_model=TeamDetailResponse)
async def assign_member(
    team_id: str,
    member_in: AssignTeamMemberRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("teams:assign")),
) -> TeamDetailResponse:
    """
    Assign a user to a team.
    """
    team_res = await db.execute(select(Team).where(Team.team_id == team_id))
    team = team_res.scalar_one_or_none()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team with ID '{team_id}' not found.",
        )

    user_res = await db.execute(select(User).where(User.user_id == member_in.user_id))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{member_in.user_id}' not found.",
        )

    old_team_id = user.team_id
    user.team_id = team_id

    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="TEAM_MEMBER_ASSIGN",
        entity_type="Team",
        entity_id=team_id,
        details={"user_id": user.user_id, "previous_team_id": old_team_id, "new_team_id": team_id},
        request=request,
    )

    await db.commit()

    return await get_team(team_id=team_id, db=db, _current_user=current_user)


@router.delete("/{team_id}/members/{user_id}", response_model=TeamDetailResponse)
async def remove_member(
    team_id: str,
    user_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("teams:assign")),
) -> TeamDetailResponse:
    """
    Remove a user from a team.
    """
    team_res = await db.execute(select(Team).where(Team.team_id == team_id))
    team = team_res.scalar_one_or_none()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team with ID '{team_id}' not found.",
        )

    user_res = await db.execute(select(User).where(User.user_id == user_id))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' not found.",
        )

    if user.team_id != team_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with ID '{user_id}' is not a member of team '{team_id}'.",
        )

    user.team_id = None

    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="TEAM_MEMBER_REMOVE",
        entity_type="Team",
        entity_id=team_id,
        details={"user_id": user.user_id, "removed_from_team_id": team_id},
        request=request,
    )

    await db.commit()

    return await get_team(team_id=team_id, db=db, _current_user=current_user)


@router.delete("/{team_id}", response_model=MessageResponse)
async def delete_team(
    team_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("teams:update")),
) -> MessageResponse:
    """
    Delete a team, unassigning members and removing associated vehicle records.
    """
    res = await db.execute(select(Team).where(Team.team_id == team_id))
    team = res.scalar_one_or_none()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team with ID '{team_id}' not found.",
        )

    # Unassign users assigned to this team
    users_res = await db.execute(select(User).where(User.team_id == team_id))
    for user in users_res.scalars().all():
        user.team_id = None

    # Delete vehicles belonging to this team
    vehicles_res = await db.execute(select(Vehicle).where(Vehicle.team_id == team_id))
    for vehicle in vehicles_res.scalars().all():
        await db.delete(vehicle)

    await db.delete(team)

    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="TEAM_DELETE",
        entity_type="Team",
        entity_id=team_id,
        details={"team_name": team.team_name},
        request=request,
    )

    await db.commit()
    return MessageResponse(message=f"Team '{team.team_name}' deleted successfully.")

