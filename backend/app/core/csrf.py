"""
CSRF protection via the double-submit cookie pattern.

How it works:
  1. Server sets a non-httpOnly 'ridss_csrf_token' cookie on GET /csrf-token.
  2. Axios interceptor reads that cookie and adds 'X-CSRF-Token: <value>' header
     on every state-changing request (POST, PUT, PATCH, DELETE).
  3. This middleware validates that the header value matches the cookie value.
     A cross-origin attacker cannot read the cookie (SameSite=Strict) and
     therefore cannot forge the header.

Judgment call: The login endpoint itself is exempt from CSRF validation because
it's the bootstrap call — the user doesn't have a CSRF token yet before logging
in. Login credentials (email + password) are the authenticating factor, and
login CSRF would only allow an attacker to log *in* as themselves on the
victim's browser (login-CSRF), which is a real but low-severity vector for
this enterprise app. We accept this tradeoff; all *post-login* mutations are
fully protected.
"""
import secrets
from collections.abc import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

# Endpoints that bypass CSRF (must be GET-equivalent or bootstrap endpoints)
_CSRF_EXEMPT_PATHS = frozenset(
    [
        "/api/v1/auth/login",
        "/api/v1/auth/csrf-token",
    ]
)

_MUTATING_METHODS = frozenset(["POST", "PUT", "PATCH", "DELETE"])


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.method in _MUTATING_METHODS and request.url.path not in _CSRF_EXEMPT_PATHS:
            header_token = request.headers.get("X-CSRF-Token", "")
            cookie_token = request.cookies.get("ridss_csrf_token", "")

            if not header_token or not cookie_token:
                return JSONResponse(
                    status_code=403,
                    content={"detail": "CSRF token missing."},
                )
            # secrets.compare_digest prevents timing oracle attacks
            if not secrets.compare_digest(header_token, cookie_token):
                return JSONResponse(
                    status_code=403,
                    content={"detail": "CSRF token mismatch."},
                )

        return await call_next(request)


def generate_csrf_token() -> str:
    """Generate a cryptographically secure random CSRF token."""
    return secrets.token_urlsafe(32)
