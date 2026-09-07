"""
Pydantic v2 schemas for Roles and Permissions matrix.
"""
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class RoleCreate(BaseModel):
    role_name: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = None


class RoleResponse(BaseModel):
    role_id: str
    role_name: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PermissionResponse(BaseModel):
    permission_id: str
    permission_key: str
    description: Optional[str] = None
    module: str

    model_config = ConfigDict(from_attributes=True)


class ModulePermissionsResponse(BaseModel):
    module: str
    permissions: List[PermissionResponse]


class RolePermissionsUpdate(BaseModel):
    permission_ids: List[str]


class RolePermissionDetailResponse(BaseModel):
    role_id: str
    role_name: str
    permissions: List[PermissionResponse]


class RoleMatrixEntry(BaseModel):
    role_id: str
    role_name: str
    description: Optional[str] = None
    permission_ids: List[str]
    permission_keys: List[str]


class RoleMatrixResponse(BaseModel):
    roles: List[RoleMatrixEntry]
    modules: Dict[str, List[PermissionResponse]]
