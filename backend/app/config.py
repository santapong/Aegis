from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Money Management API"
    debug: bool = False

    # Database — supports PostgreSQL, MySQL, and SQLite
    # PostgreSQL: postgresql://user:pass@host:5432/dbname
    # MySQL:      mysql+pymysql://user:pass@host:3306/dbname
    # SQLite:     sqlite:///./data.db
    database_url: str = "sqlite:///./money_management.db"

    # AI
    anthropic_api_key: str = ""
    ai_model: str = "claude-sonnet-4-20250514"

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    # Rate Limiting
    rate_limit_per_minute: int = 100

    # Stripe
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_mode: str = "test"  # "test" or "live"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
