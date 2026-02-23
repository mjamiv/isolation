from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    PROJECT_NAME: str = "IsoVis"
    API_V1_PREFIX: str = "/api/v1"

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:3000",
    ]

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Database (for future use)
    # DATABASE_URL: str = "postgresql://isovis:isovis_dev@localhost:5432/isovis"

    # Simulation defaults
    MAX_SIMULATION_DURATION: float = 300.0  # seconds
    DEFAULT_TIME_STEP: float = 0.01  # seconds

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


settings = Settings()
