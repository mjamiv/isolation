from starlette.requests import Request
from starlette.responses import Response

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.rate_limit import rate_limit

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    description="IsoVis - Triple Friction Pendulum bearing simulation API",
)

# Security headers middleware
# NOTE: Request body size is implicitly limited by Pydantic validation
# (e.g. MAX_GROUND_MOTION_POINTS=500_000). No middleware-level limit added.
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "0",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob:; "
        "font-src 'self' data:; "
        "connect-src 'self' ws: wss:; "
        "worker-src 'self' blob:; "
        "frame-ancestors 'none'"
    ),
}


@app.middleware("http")
async def add_security_headers(request: Request, call_next: object) -> Response:
    response = await call_next(request)
    for name, value in SECURITY_HEADERS.items():
        response.headers[name] = value
    return response


# CORS middleware
# X-Api-Key included for when AUTH_REQUIRED is enabled
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Api-Key"],
)


@app.get("/")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok", "service": settings.PROJECT_NAME}


# Router imports
from app.routers.models import router as models_router
from app.routers.analysis import router as analysis_router
from app.routers.results import router as results_router
from app.routers.comparison import router as comparison_router

default_rate_limit = Depends(
    rate_limit(
        scope="api_default",
        max_requests=settings.RATE_LIMIT_DEFAULT_MAX,
    )
)

app.include_router(models_router, dependencies=[default_rate_limit])
app.include_router(analysis_router, dependencies=[default_rate_limit])
app.include_router(results_router, dependencies=[default_rate_limit])
app.include_router(comparison_router, dependencies=[default_rate_limit])
