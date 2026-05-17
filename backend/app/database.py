"""SQLAlchemy engine + session factory.

Multi-database support: Aegis runs against any SQLAlchemy-supported
relational DB; the audit at ``docs/databases.md`` covers what's tested.
This module centralises the dialect-specific knobs (connect_args,
session pragmas, charset) so the rest of the codebase stays generic.

The driver suffix in ``DATABASE_URL`` selects the dialect:

- ``sqlite:///./data.db`` — dev only, single-process.
- ``postgresql://...`` (alias for ``postgresql+psycopg2://...``) — RDS,
  Aurora, Cloud SQL, AlloyDB, Azure, Neon, Supabase, CockroachDB,
  YugabyteDB.
- ``mysql+pymysql://...`` — RDS MySQL, Aurora MySQL, Cloud SQL MySQL,
  Azure Database for MySQL, MariaDB, TiDB ≥ 6.6.
"""

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import get_settings

settings = get_settings()


def _build_engine(url: str) -> Engine:
    """Create a SQLAlchemy engine with dialect-appropriate settings.

    Per-dialect tuning lives here so application code can treat
    ``engine`` as an opaque object. New dialects (CockroachDB, Spanner,
    Turso) are added as additional branches.
    """
    if url.startswith("sqlite"):
        eng = create_engine(
            url,
            connect_args={"check_same_thread": False},
            pool_pre_ping=True,
        )

        @event.listens_for(eng, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record):
            # SQLite ignores FK constraints by default — the PRAGMA must
            # be set on every connection (it's not server-wide). Without
            # this, `ondelete=` actions in the models are no-ops in dev.
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        return eng

    # ------------------------------------------------------------------
    # MySQL / MariaDB / TiDB / Aurora MySQL / Cloud SQL MySQL.
    # Pymysql accepts charset+timeout on the URL, but we set them via
    # connect_args so the URL stays clean for secrets management and so
    # CI can override timeout without rewriting the URL.
    # ------------------------------------------------------------------
    if url.startswith(("mysql", "mariadb")):
        connect_args: dict = {
            # utf8mb4 is required for emoji + most CJK chars. Without it,
            # description/notes fields silently lose data.
            "charset": "utf8mb4",
            "connect_timeout": 10,
        }
        eng = create_engine(
            url,
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
            pool_timeout=settings.db_pool_timeout,
            pool_pre_ping=True,
            pool_recycle=settings.db_pool_recycle,
            connect_args=connect_args,
        )

        @event.listens_for(eng, "connect")
        def _set_mysql_timeout(dbapi_connection, _connection_record):
            # Cap any single statement at 15s — equivalent of Postgres's
            # statement_timeout. MySQL 5.7+/MariaDB 10.1+ support
            # MAX_EXECUTION_TIME (in ms, applies only to SELECTs).
            try:
                cursor = dbapi_connection.cursor()
                cursor.execute("SET SESSION MAX_EXECUTION_TIME=15000")
                cursor.close()
            except Exception:  # noqa: BLE001
                # TiDB / older MariaDB may reject; not fatal.
                pass

        return eng

    # ------------------------------------------------------------------
    # PostgreSQL family — covers vanilla, RDS, Aurora, Cloud SQL,
    # AlloyDB, Azure, Neon, Supabase, CockroachDB (wire-compatible),
    # YugabyteDB.
    # ------------------------------------------------------------------
    connect_args = {
        # statement_timeout caps any single query at 15 s so a runaway
        # SELECT can't pin a pool connection indefinitely.
        # connect_timeout bounds the initial socket open so we fail fast
        # against a wedged DB instead of hanging Uvicorn workers.
        "options": "-c statement_timeout=15000",
        "connect_timeout": 10,
    }
    return create_engine(
        url,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_timeout=settings.db_pool_timeout,
        pool_pre_ping=True,
        pool_recycle=settings.db_pool_recycle,
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


def ping() -> bool:
    """Cheap connectivity check used by ``/api/health``. Returns True
    if a trivial ``SELECT 1`` succeeds, False otherwise.

    Lives here (not in main.py) so health-check code is co-located with
    the engine config; future dialects can override what "ping" means
    (e.g. Spanner needs a different probe)."""
    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
        return True
    except Exception:  # noqa: BLE001
        return False
