from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    PROJECT_NAME: str = "IsoVis"

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Database (for future use)
    # DATABASE_URL: str = "postgresql://isovis:isovis_dev@localhost:5432/isovis"

    # Simulation defaults
    MAX_SIMULATION_DURATION: float = 300.0  # seconds
    DEFAULT_TIME_STEP: float = 0.01  # seconds
    MAX_ANALYSIS_STEPS: int = 500_000
    MAX_MODAL_MODES: int = 100
    MAX_GROUND_MOTION_POINTS: int = 500_000

    # API auth (disabled by default for local development)
    AUTH_REQUIRED: bool = False
    AUTH_API_KEYS: list[str] = []

    # In-memory rate limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_WINDOW_SECONDS: int = 60
    RATE_LIMIT_DEFAULT_MAX: int = 120
    RATE_LIMIT_HEAVY_MAX: int = 10

    # In-memory store limits (evict oldest when exceeded)
    MAX_MODELS: int = 100
    MAX_ANALYSES: int = 500

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


settings = Settings()
