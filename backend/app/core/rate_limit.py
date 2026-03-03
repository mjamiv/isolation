from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import HTTPException, Request, status

from app.core.config import settings


class InMemoryRateLimiter:
    """Simple in-memory fixed-window limiter keyed by client+scope."""

    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str, max_requests: int, window_seconds: int) -> None:
        now = time.monotonic()
        cutoff = now - window_seconds

        with self._lock:
            events = self._events[key]
            while events and events[0] < cutoff:
                events.popleft()

            if len(events) >= max_requests:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded",
                )

            events.append(now)


rate_limiter = InMemoryRateLimiter()


def rate_limit(
    scope: str,
    max_requests: int,
    window_seconds: int | None = None,
) -> Callable[[Request], None]:
    """Create a FastAPI dependency enforcing per-client request throttling."""
    window = window_seconds or settings.RATE_LIMIT_WINDOW_SECONDS

    async def _dependency(request: Request) -> None:
        if not settings.RATE_LIMIT_ENABLED:
            return

        client_ip = request.client.host if request.client else "unknown"
        key = f"{scope}:{client_ip}"
        rate_limiter.check(key=key, max_requests=max_requests, window_seconds=window)

    return _dependency
