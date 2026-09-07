"""
User Management API endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.rbac import require_permission
from app.core.security import hash_password
from app.db.session import get_db
from app.models.driver import Driver
from app.models.driver_vehicle_assignment import DriverVehicleAssignment
from app.models.role import Role
from app.models.team import Team
from app.models.user import User, UserStatus
from app.schemas.user import UserCreate, UserResponse, UserStatusUpdate, UserUpdate
from app.services.audit import log_audit_event

router = APIRouter(prefix="/users", tags=["users"])


async def _ensure_driver_profile(db: AsyncSession, user: User, role: Role) -> None:
    """Auto-create a Driver profile if user role is Driver."""
    if role.role_name == "Driver":
        driver_res = await db.execute(select(Driver).where(Driver.user_id == user.user_id))
        if not driver_res.scalar_one_or_none():
            max_num_res = await db.execute(select(func.max(Driver.driver_number)))
            max_num = max_num_res.scalar()
            next_num = (max_num + 1) if max_num is not None else 1
            driver = Driver(
                user_id=user.user_id,
                driver_number=next_num,
                nationality="Unknown",
            )
            db.add(driver)
            await db.flush()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users:create")),
) -> UserResponse:
    """
    Create a new user account with bcrypt password hashing.
    Enforces email uniqueness at both API and DB levels.
    """
    # Check email uniqueness
    existing_user_res = await db.execute(select(User).where(User.email == user_in.email))
    if existing_user_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    # Verify role exists
    role_res = await db.execute(select(Role).where(Role.role_id == user_in.role_id))
    role = role_res.scalar_one_or_none()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role with ID '{user_in.role_id}' does not exist.",
        )

    # Verify team exists if provided
    if user_in.team_id:
        team_res = await db.execute(select(Team).where(Team.team_id == user_in.team_id))
        if not team_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Team with ID '{user_in.team_id}' does not exist.",
            )

    new_user = User(
        full_name=user_in.full_name,
        email=user_in.email,
        password_hash=hash_password(user_in.password),
        role_id=user_in.role_id,
        team_id=user_in.team_id,
        status=UserStatus.ACTIVE.value,
    )
    db.add(new_user)
    await db.flush()

    # Ensure Driver profile if role is Driver
    await _ensure_driver_profile(db, new_user, role)

    # Log audit event
    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="USER_CREATE",
        entity_type="User",
        entity_id=new_user.user_id,
        details={"email": new_user.email, "role_id": new_user.role_id, "team_id": new_user.team_id},
        request=request,
    )

    await db.commit()

    # Fetch with relationships
    res = await db.execute(
        select(User)
        .options(selectinload(User.role), selectinload(User.team))
        .where(User.user_id == new_user.user_id)
    )
    return res.scalar_one()


@router.get("", response_model=List[UserResponse])
async def search_users(
    query: Optional[str] = Query(None, description="Search by name or email"),
    role_id: Optional[str] = Query(None, description="Filter by role ID"),
    team_id: Optional[str] = Query(None, description="Filter by team ID"),
    user_status: Optional[str] = Query(None, alias="status", description="Filter by status (active/disabled)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_permission("users:read")),
) -> List[UserResponse]:
    """
    Search and list users with optional query filtering.
    """
    stmt = select(User).options(selectinload(User.role), selectinload(User.team))

    if query:
        search_pattern = f"%{query}%"
        stmt = stmt.where(
            or_(
                User.full_name.ilike(search_pattern),
                User.email.ilike(search_pattern),
            )
        )
    if role_id:
        stmt = stmt.where(User.role_id == role_id)
    if team_id:
        stmt = stmt.where(User.team_id == team_id)
    if user_status:
        stmt = stmt.where(User.status == user_status)

    stmt = stmt.offset(skip).limit(limit).order_by(User.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_permission("users:read")),
) -> UserResponse:
    """
    Get a single user by ID.
    """
    res = await db.execute(
        select(User)
        .options(selectinload(User.role), selectinload(User.team))
        .where(User.user_id == user_id)
    )
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' not found.",
        )
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_in: UserUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users:update")),
) -> UserResponse:
    """
    Update user attributes, assign role, or assign team.
    """
    res = await db.execute(select(User).where(User.user_id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' not found.",
        )

    before_changes = {
        "full_name": user.full_name,
        "email": user.email,
        "role_id": user.role_id,
        "team_id": user.team_id,
        "status": user.status,
    }

    if user_in.email and user_in.email != user.email:
        existing_res = await db.execute(select(User).where(User.email == user_in.email))
        if existing_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email address already exists.",
            )
        user.email = user_in.email

    if user_in.full_name is not None:
        user.full_name = user_in.full_name
    if user_in.role_id is not None:
        user.role_id = user_in.role_id
    if user_in.team_id is not None:
        user.team_id = user_in.team_id
    if user_in.status is not None:
        user.status = user_in.status

    # Ensure Driver profile if assigned Driver role
    role_res = await db.execute(select(Role).where(Role.role_id == user.role_id))
    role = role_res.scalar_one_or_none()
    if role:
        await _ensure_driver_profile(db, user, role)

    # Log audit event
    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="USER_UPDATE",
        entity_type="User",
        entity_id=user.user_id,
        details={"before": before_changes, "after": user_in.model_dump(exclude_unset=True)},
        request=request,
    )

    await db.commit()

    updated_res = await db.execute(
        select(User)
        .options(selectinload(User.role), selectinload(User.team))
        .where(User.user_id == user_id)
    )
    return updated_res.scalar_one()


@router.delete("/{user_id}", response_model=UserResponse)
@router.patch("/{user_id}/status", response_model=UserResponse)
async def disable_user(
    user_id: str,
    request: Request,
    status_in: Optional[UserStatusUpdate] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users:disable")),
) -> UserResponse:
    """
    Disable user (soft delete via status="disabled").
    """
    res = await db.execute(select(User).where(User.user_id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' not found.",
        )

    new_status = status_in.status if status_in else UserStatus.DISABLED.value

    if new_status == UserStatus.DISABLED.value and user.user_id == current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot disable your own user account.",
        )

    user.status = new_status

    # If user is disabled, deactivate any active vehicle assignments for this driver
    if new_status == UserStatus.DISABLED.value:
        driver_res = await db.execute(select(Driver).where(Driver.user_id == user_id))
        driver = driver_res.scalar_one_or_none()
        if driver:
            active_assign_res = await db.execute(
                select(DriverVehicleAssignment).where(
                    DriverVehicleAssignment.driver_id == driver.driver_id,
                    DriverVehicleAssignment.status == "active",
                )
            )
            for a in active_assign_res.scalars().all():
                a.status = "inactive"

    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="USER_STATUS_TOGGLE",
        entity_type="User",
        entity_id=user.user_id,
        details={"new_status": new_status},
        request=request,
    )

    await db.commit()

    updated_res = await db.execute(
        select(User)
        .options(selectinload(User.role), selectinload(User.team))
        .where(User.user_id == user_id)
    )
    return updated_res.scalar_one()

