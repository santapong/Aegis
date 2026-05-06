from functools import lru_cache

from loguru import logger
from pydantic import model_validator
from pydantic_settings import BaseSettings

PLACEHOLDER_JWT_SECRET = "CHANGE-ME-IN-PRODUCTION"
MIN_JWT_SECRET_LEN = 32


class Settings(BaseSettings):
    app_name: str = "Money Management API"
    debug: bool = False

    # Database — supports PostgreSQL, MySQL, and SQLite
    # PostgreSQL: postgresql://user:pass@host:5432/dbname
    # MySQL:      mysql+pymysql://user:pass@host:3306/dbname
    # SQLite:     sqlite:///./data.db
    database_url: str = "sqlite:///./money_management.db"

    # JWT Authentication
    jwt_secret_key: str = PLACEHOLDER_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24 hours

    # AI provider — "anthropic" | "typhoon" | "groq"
    ai_provider: str = "anthropic"
    # Anthropic
    anthropic_api_key: str = ""
    ai_model: str = "claude-sonnet-4-20250514"
    # Typhoon (OpenAI-compatible — https://api.opentyphoon.ai/v1)
    typhoon_api_key: str = ""
    typhoon_base_url: str = "https://api.opentyphoon.ai/v1"
    typhoon_model: str = "typhoon-v2.1-12b-instruct"
    # Groq (OpenAI-compatible — https://api.groq.com/openai/v1)
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_model: str = "llama-3.3-70b-versatile"

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    # Rate Limiting
    rate_limit_per_minute: int = 100

    # Stripe
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_mode: str = "test"  # "test" or "live"

    # Logging: "text" (human-readable, colorized) or "json" (structured).
    log_format: str = "text"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    @model_validator(mode="after")
    def _validate_production_secrets(self):
        if not self.database_url:
            raise ValueError("DATABASE_URL must be set.")

        secret_is_placeholder = self.jwt_secret_key == PLACEHOLDER_JWT_SECRET
        secret_too_short = len(self.jwt_secret_key) < MIN_JWT_SECRET_LEN

        if secret_is_placeholder or secret_too_short:
            msg = (
                "JWT_SECRET_KEY is insecure: "
                f"{'placeholder value' if secret_is_placeholder else f'len {len(self.jwt_secret_key)} < {MIN_JWT_SECRET_LEN}'}. "
                "Run `make setup` or set it to `openssl rand -hex 32`."
            )
            if self.debug:
                logger.warning(msg + " (DEBUG=true — continuing.)")
            else:
                raise ValueError(msg)

        if self.log_format not in ("text", "json"):
            raise ValueError("LOG_FORMAT must be 'text' or 'json'.")

        if self.ai_provider not in ("anthropic", "typhoon", "groq"):
            raise ValueError(
                f"AI_PROVIDER must be one of 'anthropic', 'typhoon', 'groq' (got {self.ai_provider!r})."
            )

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
