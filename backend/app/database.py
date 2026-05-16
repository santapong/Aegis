from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import get_settings

settings = get_settings()


def _build_engine(url: str):
    """Create a SQLAlchemy engine with dialect-appropriate settings."""
    if url.startswith("sqlite"):
        eng = create_engine(
            url,
            connect_args={"check_same_thread": False},
            pool_pre_ping=True,
        )
        # Enable foreign key support for SQLite
        @event.listens_for(eng, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        return eng

    # PostgreSQL and MySQL.
    connect_args: dict = {}
    if url.startswith("postgresql"):
        # statement_timeout caps any single query at 15s so a runaway
        # SELECT can't pin a pool connection indefinitely.
        # connect_timeout bounds the initial socket open so we fail fast
        # against a wedged DB instead of hanging Uvicorn workers.
        connect_args = {
            "options": "-c statement_timeout=15000",
            "connect_timeout": 10,
        }

    return create_engine(
        url,
        pool_size=10,
        max_overflow=20,
        pool_timeout=10,
        pool_pre_ping=True,
        pool_recycle=1800,
        connect_args=connect_args,
    )


engine = _build_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
