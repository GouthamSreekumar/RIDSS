"""
Core application settings loaded from environment variables.

Judgment call: Using pydantic-settings so that environment variable names
are validated at startup — no silent typos in production config.
"""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── JWT ──────────────────────────────────────────────────────────────────
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # ── Cookie ───────────────────────────────────────────────────────────────
    # In production set to your actual domain. Empty string = no Domain attr
    # (browser will scope to current host which is correct for localhost dev).
    cookie_domain: str = ""

    # ── CORS ─────────────────────────────────────────────────────────────────
    # Store as a plain string to avoid pydantic-settings' automatic JSON
    # parsing of List fields from .env files (which fails on bare comma strings).
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        """Returns CORS origins as a list, split by comma."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # ── Database ─────────────────────────────────────────────────────────────
    database_url: str = "sqlite+aiosqlite:///./ridss.db"

    @property
    def cookie_kwargs(self) -> dict:
        """
        Returns kwargs suitable for Response.set_cookie().
        In local dev (no cookie_domain), secure=False and samesite="lax" allow
        cookie exchange over http://localhost:3000 to http://localhost:8000.
        """
        is_prod = bool(self.cookie_domain)
        kwargs: dict = {
            "key": "ridss_access_token",
            "httponly": True,
            "secure": is_prod,
            "samesite": "strict" if is_prod else "lax",
            "max_age": self.access_token_expire_minutes * 60,
        }
        if self.cookie_domain:
            kwargs["domain"] = self.cookie_domain
        return kwargs

    @property
    def csrf_cookie_kwargs(self) -> dict:
        """
        CSRF token cookie is deliberately NOT httpOnly so that JavaScript
        (Axios interceptor) can read it and forward it as X-CSRF-Token header.
        """
        is_prod = bool(self.cookie_domain)
        return {
            "key": "ridss_csrf_token",
            "httponly": False,     # must be readable by JS
            "secure": is_prod,
            "samesite": "strict" if is_prod else "lax",
            "max_age": self.access_token_expire_minutes * 60,
        }



@lru_cache
def get_settings() -> Settings:
    return Settings()
