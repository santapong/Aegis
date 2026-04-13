import sys
from pathlib import Path
from logging.config import fileConfig

from sqlalchemy import engine_from_config, create_engine, pool
from alembic import context

# Add backend directory to sys.path so we can import app modules
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings
from app.database import Base
from app.models import *  # noqa: F401, F403 — register all models on Base.metadata

# Alembic Config object
config = context.config

# Set up loggers from config file
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Use our app's Base.metadata for autogenerate support
target_metadata = Base.metadata

# Get database URL from app settings
settings = get_settings()


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,  # Required for SQLite ALTER TABLE support
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = create_engine(settings.database_url, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # Required for SQLite ALTER TABLE support
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
