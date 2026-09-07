"""
Roles & Permissions API endpoints.
"""
from typing import Dict, List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.rbac import rbac_cache, require_permission
from app.db.session import get_db
from app.models.permission import Permission
from app.models.role import Role
from app.models.role_permission import RolePermission
from app.models.user import User
from app.schemas.role import (
    ModulePermissionsResponse,
    PermissionResponse,
    RoleCreate,
    RoleMatrixEntry,
    RoleMatrixResponse,
    RolePermissionDetailResponse,
    RolePermissionsUpdate,
    RoleResponse,
)
from app.services.audit import log_audit_event

roles_router = APIRouter(prefix="/roles", tags=["roles"])
permissions_router = APIRouter(prefix="/permissions", tags=["permissions"])


# ── Permissions List Endpoint ──────────────────────────────────────────────

@permissions_router.get("", response_model=List[ModulePermissionsResponse])
async def list_permissions(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_permission("roles:read")),
) -> List[ModulePermissionsResponse]:
    """
    List all available permissions, grouped by module, for building the matrix UI.
    """
    res = await db.execute(select(Permission).order_by(Permission.module.asc(), Permission.permission_key.asc()))
    all_perms = res.scalars().all()

    grouped: Dict[str, List[PermissionResponse]] = {}
    for perm in all_perms:
        perm_resp = PermissionResponse.model_validate(perm)
        grouped.setdefault(perm.module, []).append(perm_resp)

    return [
        ModulePermissionsResponse(module=module, permissions=perms)
        for module, perms in grouped.items()
    ]


# ── Roles Endpoints ─────────────────────────────────────────────────────────

@roles_router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    role_in: RoleCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("roles:create")),
) -> RoleResponse:
    """
    Create a new custom system role.
    """
    existing_res = await db.execute(select(Role).where(Role.role_name == role_in.role_name))
    if existing_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role with name '{role_in.role_name}' already exists.",
        )

    new_role = Role(
        role_name=role_in.role_name,
        description=role_in.description,
    )
    db.add(new_role)
    await db.flush()

    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="ROLE_CREATE",
        entity_type="Role",
        entity_id=new_role.role_id,
        details=role_in.model_dump(),
        request=request,
    )

    await db.commit()
    await db.refresh(new_role)
    
    # Refresh cache
    await rbac_cache.invalidate(db)

    return new_role


@roles_router.get("", response_model=List[RoleResponse])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_permission("roles:read")),
) -> List[RoleResponse]:
    """
    List all system roles.
    """
    res = await db.execute(select(Role).order_by(Role.role_name.asc()))
    return res.scalars().all()


@roles_router.get("/matrix", response_model=RoleMatrixResponse)
async def get_role_permission_matrix(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_permission("roles:read")),
) -> RoleMatrixResponse:
    """
    Returns the full role x permission grid in one call for the matrix UI screen.
    """
    # Fetch roles
    roles_res = await db.execute(select(Role).order_by(Role.role_name.asc()))
    roles = roles_res.scalars().all()

    # Fetch permissions grouped by module
    perms_res = await db.execute(select(Permission).order_by(Permission.module.asc(), Permission.permission_key.asc()))
    all_perms = perms_res.scalars().all()

    modules_map: Dict[str, List[PermissionResponse]] = {}
    for p in all_perms:
        modules_map.setdefault(p.module, []).append(PermissionResponse.model_validate(p))

    # Fetch role_permissions
    rp_res = await db.execute(select(RolePermission).options(selectinload(RolePermission.permission)))
    all_rps = rp_res.scalars().all()

    role_perms_map: Dict[str, List[Permission]] = {r.role_id: [] for r in roles}
    for rp in all_rps:
        if rp.permission and rp.role_id in role_perms_map:
            role_perms_map[rp.role_id].append(rp.permission)

    matrix_entries = []
    for r in roles:
        assigned_perms = role_perms_map.get(r.role_id, [])
        matrix_entries.append(
            RoleMatrixEntry(
                role_id=r.role_id,
                role_name=r.role_name,
                description=r.description,
                permission_ids=[p.permission_id for p in assigned_perms],
                permission_keys=[p.permission_key for p in assigned_perms],
            )
        )

    return RoleMatrixResponse(roles=matrix_entries, modules=modules_map)


@roles_router.get("/{role_id}/permissions", response_model=RolePermissionDetailResponse)
async def get_role_permissions(
    role_id: str,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_permission("roles:read")),
) -> RolePermissionDetailResponse:
    """
    Get a role's current permission set.
    """
    role_res = await db.execute(select(Role).where(Role.role_id == role_id))
    role = role_res.scalar_one_or_none()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with ID '{role_id}' not found.",
        )

    rp_res = await db.execute(
        select(RolePermission)
        .options(selectinload(RolePermission.permission))
        .where(RolePermission.role_id == role_id)
    )
    role_perms = rp_res.scalars().all()
    assigned_permissions = [rp.permission for rp in role_perms if rp.permission]

    return RolePermissionDetailResponse(
        role_id=role.role_id,
        role_name=role.role_name,
        permissions=[PermissionResponse.model_validate(p) for p in assigned_permissions],
    )


@roles_router.put("/{role_id}/permissions", response_model=RolePermissionDetailResponse)
async def update_role_permissions(
    role_id: str,
    perms_in: RolePermissionsUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("roles:update")),
) -> RolePermissionDetailResponse:
    """
    Replace a role's permission set inside a single transaction.
    Diffs against current RolePermission rows, inserts/deletes accordingly,
    records detailed before/after audit log, and invalidates in-memory RBAC cache.
    """
    role_res = await db.execute(select(Role).where(Role.role_id == role_id))
    role = role_res.scalar_one_or_none()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with ID '{role_id}' not found.",
        )

    # Validate target permission IDs exist
    target_perms_res = await db.execute(
        select(Permission).where(Permission.permission_id.in_(perms_in.permission_ids))
    )
    target_perms = target_perms_res.scalars().all()
    if len(target_perms) != len(set(perms_in.permission_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more invalid permission IDs provided.",
        )

    # Fetch current role permissions
    current_rp_res = await db.execute(
        select(RolePermission)
        .options(selectinload(RolePermission.permission))
        .where(RolePermission.role_id == role_id)
    )
    current_rps = current_rp_res.scalars().all()
    current_perm_ids = {rp.permission_id for rp in current_rps}
    current_perm_keys = sorted([rp.permission.permission_key for rp in current_rps if rp.permission])

    target_perm_ids = set(perms_in.permission_ids)
    target_perm_keys = sorted([p.permission_key for p in target_perms])

    # Diffs
    ids_to_add = target_perm_ids - current_perm_ids
    ids_to_remove = current_perm_ids - target_perm_ids

    # Perform updates inside transaction
    if ids_to_remove:
        await db.execute(
            delete(RolePermission).where(
                RolePermission.role_id == role_id,
                RolePermission.permission_id.in_(ids_to_remove),
            )
        )

    for p_id in ids_to_add:
        db.add(RolePermission(role_id=role_id, permission_id=p_id))

    # Audit log recording before and after permission keys
    await log_audit_event(
        db=db,
        user_id=current_user.user_id,
        action="ROLE_PERMISSIONS_UPDATE",
        entity_type="Role",
        entity_id=role_id,
        details={
            "role_name": role.role_name,
            "before_permissions": current_perm_keys,
            "after_permissions": target_perm_keys,
            "added_count": len(ids_to_add),
            "removed_count": len(ids_to_remove),
        },
        request=request,
    )

    await db.commit()

    # CRITICAL: Invalidate & reload in-memory RBAC Cache after permission mutation
    await rbac_cache.invalidate(db)

    return RolePermissionDetailResponse(
        role_id=role.role_id,
        role_name=role.role_name,
        permissions=[PermissionResponse.model_validate(p) for p in target_perms],
    )
