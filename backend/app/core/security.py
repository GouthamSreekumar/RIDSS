"""
Security helpers: password hashing and JWT encode/decode.

Judgment call: Using python-jose (JOSE standard) over PyJWT because
it has built-in support for JWK and RS256 if we later migrate to
asymmetric signing. HS256 is fine for a single-service deployment.

NEVER log or print plaintext passwords — verified by code review.
"""
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

# ── Password hashing ─────────────────────────────────────────────────────────
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """Hash a plaintext password. Call only during user creation, never on login paths."""
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Constant-time comparison via bcrypt — prevents timing oracle attacks.
    Returns False (not raises) so the caller can issue a generic error.
    """
    return _pwd_context.verify(plain_password, hashed_password)


# ── JWT ──────────────────────────────────────────────────────────────────────
def create_access_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None,
) -> str:
    """
    Encode a JWT with the given payload. Always adds 'exp' and 'iat' claims.
    The 'role' claim must be present in `data` for role-based routing.
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"exp": expire, "iat": now})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT. Raises jose.JWTError on any failure
    (expired, invalid signature, malformed). Callers should translate
    this to HTTPException 401.
    """
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
