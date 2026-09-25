"""
FastAPI auth endpoints.

Endpoints:
  GET  /api/v1/auth/csrf-token   — issue a fresh CSRF token (call before login form mount)
  POST /api/v1/auth/login        — authenticate, set httpOnly JWT cookie
  POST /api/v1/auth/logout       — clear auth + CSRF cookies
  GET  /api/v1/auth/me           — return current user from cookie JWT
"""
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.csrf import generate_csrf_token
from app.core.security import create_access_token, decode_access_token, verify_password
from app.db.session import get_db
from app.models.user import User
from app.models.login_history import LoginHistory
from app.schemas.auth import (
    CSRFTokenResponse,
    LoginRequest,
    MessageResponse,
    TokenResponse,
    UserMeResponse,
)


logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(prefix="/auth", tags=["auth"])


# ── Shared dependency: resolve current user from cookie ───────────────────────

async def _get_current_user(
    db: AsyncSession = Depends(get_db),
    ridss_access_token: str | None = Cookie(default=None),
) -> User:
    """
    Resolves the authenticated user from the httpOnly cookie.
    Raises 401 on any failure so callers never get partial state.
    """
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not ridss_access_token:
        raise credentials_exc

    try:
        payload = decode_access_token(ridss_access_token)
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    result = await db.execute(
        select(User).options(selectinload(User.role)).where(User.user_id == user_id)
    )
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_exc
    return user


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/csrf-token", response_model=CSRFTokenResponse)
async def get_csrf_token(response: Response) -> CSRFTokenResponse:
    """
    Issues a new CSRF token.
    """
    token = generate_csrf_token()
    response.set_cookie(**settings.csrf_cookie_kwargs, value=token)
    return CSRFTokenResponse(csrf_token=token)


@router.post("/login", response_model=TokenResponse)

async def login(
    credentials: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Authenticate a user and set httpOnly JWT + readable CSRF cookies.
    Also records a LoginHistory entry.
    """
    _auth_failure = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password.",
    )

    result = await db.execute(
        select(User).options(selectinload(User.role)).where(User.email == credentials.email)
    )
    user = result.scalar_one_or_none()

    if user is None:
        verify_password("__dummy__", "$2b$12$invalidhash000000000000000000000000000000000000000000000")
        raise _auth_failure

    if not verify_password(credentials.password.get_secret_value(), user.hashed_password):
        raise _auth_failure

    if not user.is_active:
        raise _auth_failure

    role_name = user.role.role_name if user.role else ""

    # Record login history event
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    login_entry = LoginHistory(
        user_id=user.user_id,
        logged_in_at=datetime.now(timezone.utc),
        ip_address=client_ip,
        user_agent=user_agent,
    )
    db.add(login_entry)
    await db.commit()

    # Issue JWT with role claim
    access_token = create_access_token(
        data={"sub": user.user_id, "role": role_name, "role_id": user.role_id, "email": user.email},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )

    # Set httpOnly JWT cookie
    response.set_cookie(**settings.cookie_kwargs, value=access_token)

    # Set readable CSRF cookie
    csrf_token = generate_csrf_token()
    response.set_cookie(**settings.csrf_cookie_kwargs, value=csrf_token)

    return TokenResponse(
        role=role_name,
        user_id=user.user_id,
        email=user.email,
        full_name=user.full_name,
    )



@router.post("/logout", response_model=MessageResponse)
async def logout(
    response: Response,
    _current_user: User = Depends(_get_current_user),
) -> MessageResponse:
    """
    Clears auth and CSRF cookies.
    """
    auth_kwargs = settings.cookie_kwargs.copy()
    auth_kwargs.update({"value": "", "max_age": 0})
    csrf_kwargs = settings.csrf_cookie_kwargs.copy()
    csrf_kwargs.update({"value": "", "max_age": 0})

    response.set_cookie(**auth_kwargs)
    response.set_cookie(**csrf_kwargs)
    return MessageResponse(message="Logged out successfully.")



@router.get("/me", response_model=UserMeResponse)
async def get_me(
    current_user: User = Depends(_get_current_user),
) -> UserMeResponse:
    """
    Returns authenticated user profile.
    """
    role_name = current_user.role.role_name if current_user.role else ""
    return UserMeResponse(
        user_id=current_user.user_id,
        email=current_user.email,
        role=role_name,
        full_name=current_user.full_name,
    )
