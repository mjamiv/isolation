from __future__ import annotations

from fastapi import Header, HTTPException, status

from app.core.config import settings


async def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """Optionally enforce API key auth based on environment settings."""
    if not settings.AUTH_REQUIRED:
        return

    if not settings.AUTH_API_KEYS:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is enabled but no API keys are configured",
        )

    if x_api_key is None or x_api_key not in set(settings.AUTH_API_KEYS):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid API key",
        )
