from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.rate_limit import rate_limit

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    description="IsoVis - Triple Friction Pendulum bearing simulation API",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
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
