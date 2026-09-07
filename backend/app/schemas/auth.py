"""Pydantic request/response schemas for authentication endpoints."""
from pydantic import BaseModel, EmailStr, SecretStr


class LoginRequest(BaseModel):
    """
    Login credentials from the client.
    Judgment call: Using SecretStr for password so Pydantic never serializes
    it as plain text in repr(), logs, or validation errors.
    """

    email: EmailStr
    password: SecretStr


class TokenResponse(BaseModel):
    """
    Returned to the client after successful login.
    The JWT itself is NOT in this body — it travels only via the httpOnly cookie.
    We include role + user identity so the client can immediately redirect
    without an extra /me round-trip (Option a from the plan).
    """

    role: str
    user_id: str
    email: str
    full_name: str


class UserMeResponse(BaseModel):
    """Returned by GET /me for subsequent session checks."""

    user_id: str
    email: str
    role: str
    full_name: str


class CSRFTokenResponse(BaseModel):
    """Response body for GET /csrf-token — the token is also set as a cookie."""

    csrf_token: str


class MessageResponse(BaseModel):
    """Generic single-message response (used for logout)."""

    message: str
