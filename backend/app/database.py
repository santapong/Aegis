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

    # Neon-specific check: the standard Neon URL (`ep-xxx.region.aws.
    # neon.tech`) caps direct connections at the free-tier ceiling
    # (~100). At our default pool sizing (`pool_size=10 + max_overflow=20
    # = 30 per worker × 4 workers = 120 connections per pod`) a single
    # backend pod already exceeds that. The fix is one character: use
    # the pooler endpoint (`ep-xxx-pooler.region.aws.neon.tech`) which
    # multiplexes via PgBouncer in transaction mode. Warn loudly when
    # the operator hasn't done so — silent connection-exhaustion at
    # peak traffic is the worst failure mode.
    from loguru import logger
    if "neon.tech" in url and "pooler.neon.tech" not in url:
        logger.warning(
            "DATABASE_URL points at Neon WITHOUT the pooler endpoint "
            "(neon.tech vs *-pooler.neon.tech). At default pool sizing "
            "(pool=10 + overflow=20 × 4 workers = 120 conns/pod) you will "
            "exceed Neon's 100-conn ceiling at peak. Switch to the "
            "pooler URL from the Neon dashboard. See docs/databases.md."
        )

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


# ---------------------------------------------------------------------------
# Async engine + session — opt-in, runs alongside the sync engine.
# ---------------------------------------------------------------------------
#
# New routes can declare `async def ...(db: AsyncSession = Depends(get_async_db))`
# to use asyncpg + AsyncSession. Existing sync routes are unaffected. The
# two engines share the same DB but maintain independent connection pools,
# which is fine at our pool sizing (4 workers × (10+20) sync + (5) async
# = 140 conns/pod when both are active; still fits Neon pooler).
#
# Migration recipe: docs/design/002-async-sqlalchemy-migration.md.
#
# Created lazily on first use so the dep isn't pulled in for deploys that
# never touch async routes.

_async_engine = None
_async_session_factory = None


def _build_async_engine():
    """Create the async engine on first use. Mirrors _build_engine but
    uses the asyncpg driver and exposes AsyncSession."""
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    url = settings.database_url
    if url.startswith("sqlite"):
        # SQLite async via aiosqlite — useful for tests. Not for prod.
        async_url = url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
        return create_async_engine(async_url, pool_pre_ping=True)
    if url.startswith("postgresql"):
        # psycopg2 → asyncpg. The URL prefix swap is the only change.
        async_url = url.replace("postgresql://", "postgresql+asyncpg://", 1).replace(
            "postgresql+psycopg2://", "postgresql+asyncpg://"
        )
        # asyncpg doesn't accept the `-c statement_timeout=...` option
        # the sync engine passes; configure timeout via server_settings.
        return create_async_engine(
            async_url,
            pool_size=settings.db_pool_size // 2 or 1,
            max_overflow=settings.db_max_overflow // 2 or 1,
            pool_timeout=settings.db_pool_timeout,
            pool_pre_ping=True,
            pool_recycle=settings.db_pool_recycle,
            connect_args={
                "server_settings": {"statement_timeout": "15000"},
                "timeout": 10,
            },
        )
    if url.startswith(("mysql", "mariadb")):
        # MySQL async via asyncmy. Add to pyproject if you adopt this.
        # Documented as "needs extra dep" for now.
        raise NotImplementedError(
            "Async MySQL requires the asyncmy package — add it to pyproject."
        )
    raise NotImplementedError(f"Async not configured for dialect: {url.split('://', 1)[0]}")


def get_async_engine():
    """Return the singleton async engine, building it on first call."""
    global _async_engine, _async_session_factory
    if _async_engine is None:
        from sqlalchemy.ext.asyncio import async_sessionmaker

        _async_engine = _build_async_engine()
        _async_session_factory = async_sessionmaker(
            _async_engine, expire_on_commit=False
        )
    return _async_engine


async def get_async_db():
    """FastAPI dependency: yield an AsyncSession.

    Use in routes that benefit from non-blocking DB I/O (long-running
    queries that could otherwise pin a threadpool worker). Pairs with
    ``async def`` route handlers.
    """
    get_async_engine()  # warm the singleton
    assert _async_session_factory is not None
    async with _async_session_factory() as session:
        yield session


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
