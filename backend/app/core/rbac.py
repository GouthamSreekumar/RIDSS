"""
In-memory RBAC Cache engine & FastAPI permission authorization dependencies.
"""
import asyncio
import logging
from typing import Callable, Dict, Set

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.endpoints.auth import _get_current_user
from app.db.session import AsyncSessionLocal
from app.models.permission import Permission
from app.models.role import Role
from app.models.role_permission import RolePermission
from app.models.user import User

logger = logging.getLogger(__name__)


class RBACCacheEngine:
    def __init__(self) -> None:
        # role_id -> Set[permission_key]
        self._cache: Dict[str, Set[str]] = {}
        # role_name -> role_id
        self._role_name_to_id: Dict[str, str] = {}
        self._lock = asyncio.Lock()
        self._initialized = False

    async def initialize(self, db: AsyncSession) -> None:
        async with self._lock:
            await self._reload_unlocked(db)
            self._initialized = True
            logger.info("RBACCacheEngine initialized with %d roles cached.", len(self._cache))

    async def invalidate(self, db: AsyncSession) -> None:
        async with self._lock:
            await self._reload_unlocked(db)
            logger.info("RBACCacheEngine invalidated and reloaded.")

    async def _reload_unlocked(self, db: AsyncSession) -> None:
        # Fetch all roles
        roles_result = await db.execute(select(Role))
        roles = roles_result.scalars().all()
        
        new_name_to_id = {role.role_name: role.role_id for role in roles}
        new_cache: Dict[str, Set[str]] = {role.role_id: set() for role in roles}

        # Fetch all role_permissions with permission
        rp_result = await db.execute(
            select(RolePermission).options(selectinload(RolePermission.permission))
        )
        rps = rp_result.scalars().all()
        for rp in rps:
            if rp.permission and rp.role_id in new_cache:
                new_cache[rp.role_id].add(rp.permission.permission_key)

        self._cache = new_cache
        self._role_name_to_id = new_name_to_id

    def has_permission(self, role_id: str, permission_key: str) -> bool:
        perms = self._cache.get(role_id, set())
        return permission_key in perms

    def get_role_permissions(self, role_id: str) -> Set[str]:
        return self._cache.get(role_id, set()).copy()

    def get_role_id_by_name(self, role_name: str) -> str | None:
        return self._role_name_to_id.get(role_name)


# Global singleton instance
rbac_cache = RBACCacheEngine()


def require_permission(permission_key: str) -> Callable:
    """
    FastAPI dependency factory enforcing server-side RBAC permissions via cached lookup.
    """
    async def permission_checker(
        current_user: User = Depends(_get_current_user),
    ) -> User:
        if not rbac_cache.has_permission(current_user.role_id, permission_key):
            logger.warning(
                "Access denied for user %s (role_id=%s) requiring permission '%s'",
                current_user.email,
                current_user.role_id,
                permission_key,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required permission: '{permission_key}'.",
            )
        return current_user

    return permission_checker
