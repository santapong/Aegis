from functools import lru_cache

from loguru import logger
from pydantic import model_validator
from pydantic_settings import BaseSettings

PLACEHOLDER_JWT_SECRET = "CHANGE-ME-IN-PRODUCTION"
MIN_JWT_SECRET_LEN = 32


class Settings(BaseSettings):
    app_name: str = "Money Management API"
    debug: bool = False

    # Database — see docs/databases.md for the full compatibility matrix.
    # Tested: SQLite (dev), PostgreSQL 13+ (incl. RDS / Aurora / Cloud SQL
    # / AlloyDB / Azure / Neon / Supabase / Cockroach / Yugabyte),
    # MySQL 8.0+ / MariaDB 10.5+ (incl. RDS / Aurora / Cloud SQL / Azure /
    # TiDB ≥ 6.6).
    #
    # PostgreSQL: postgresql://user:pass@host:5432/dbname?sslmode=require
    # MySQL:      mysql+pymysql://user:pass@host:3306/dbname
    # SQLite:     sqlite:///./data.db
    database_url: str = "sqlite:///./money_management.db"

    # Connection-pool sizing. Defaults work for a single backend pod
    # behind a managed Postgres with the standard 100-connection ceiling.
    # For serverless DBs (Neon free tier, Aurora Serverless v2), lower
    # pool_size and pool_recycle so suspend/resume is cheap.
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: int = 10  # seconds to wait for a free connection
    db_pool_recycle: int = 1800  # seconds before recycling — beat the LB idle timeout

    # JWT Authentication
    jwt_secret_key: str = PLACEHOLDER_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24 hours

    # Google OAuth — optional. When set, /api/auth/google accepts Google
    # ID tokens and signs the user in (or registers them). The same client
    # ID must be configured in the frontend (NEXT_PUBLIC_GOOGLE_CLIENT_ID)
    # so Google issues tokens that pass our `aud` check. Leave blank to
    # disable Google sign-in entirely; the endpoint returns 503 in that
    # case so the frontend can hide the button gracefully.
    google_oauth_client_id: str = ""

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

    # Public frontend URL — used to build Stripe success/cancel return
    # URLs and any other server-issued links back to the UI. Should match
    # whatever the user sees in their browser. Leave the localhost default
    # for dev; override per-environment in production.
    frontend_url: str = "http://localhost:3000"

    # Rate Limiting
    rate_limit_per_minute: int = 100
    # Honor X-Forwarded-For when bucketing requests. Only enable after
    # verifying your proxy chain strips inbound XFF headers from clients
    # — otherwise an attacker can spoof IPs to evade the limit.
    rate_limit_trust_forwarded_for: bool = False
    # Max request body in bytes. Applied at the middleware layer so
    # FastAPI never even tries to parse oversized payloads. Default 2 MB
    # is generous for JSON; the CSV import path has its own 5 MB cap.
    max_request_body_bytes: int = 2 * 1024 * 1024

    # Cache — see backend/app/cache.py. "memory" is fine for one pod;
    # "redis" is required as soon as you have multiple uvicorn workers or
    # replicas, because the in-memory backend doesn't share state across
    # processes (a stale read in worker B will outlast a mutation in
    # worker A). "disabled" no-ops every call.
    cache_backend: str = "memory"  # memory | redis | disabled
    cache_redis_url: str = ""
    cache_default_ttl: int = 60  # seconds

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
