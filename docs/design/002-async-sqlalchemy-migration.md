# Design: incremental async-SQLAlchemy migration

**Status**: infrastructure shipped, one router converted as a spike. Full migration deferred — see "Cost-benefit" below.

## What was shipped

- `backend/app/database.py` — new `get_async_engine()` + `get_async_db()` factory. Builds an `asyncpg`-backed `AsyncSession` lazily on first use. Runs alongside the existing sync engine; both share the same DB but maintain independent connection pools.
- `backend/pyproject.toml` — added `asyncpg>=0.30.0`.
- `backend/app/routers/export.py` — converted from sync to async as the worked-example spike. Same wire output, same auth, same semantics — only the I/O model changed.

## Cost-benefit

**Why we didn't convert the whole codebase in one PR:**

| Router count | ~15 |
| Avg LOC per router | ~150 |
| Test files using sync `Session` | every one |
| Service modules using sync session | 3 (notifications, recurrence, ai_engine) |
| Estimated effort to convert all | **1 week of careful work** + 1 week of testing |

**What you'd actually gain at current scale:**

| Scale | Sync threadpool exhaustion? | Async win? |
|---|---|---|
| < 500 concurrent users | No | None |
| 500–2k concurrent users | Occasional, on PDF + AI co-occurrence | Marginal — worker queue solves it better |
| > 2k concurrent users | Yes | Real — 2-3× more concurrent reqs per pod |

Verdict: **don't convert anything until you hit the second scale tier**. The worker queue (item 3 of the architectural backlog) is the better first answer — it removes PDF + AI from the shared pool entirely, which is what was actually starving it.

## When to migrate a specific router

Use these triggers:

- The route reads from a slow external dependency (AI, Stripe). Async lets the worker yield while you await the external call.
- The route streams a large response (NDJSON export, SSE). Async + `stream_scalars()` is the right primitive.
- The route does multiple parallel queries. Async + `asyncio.gather()` runs them concurrently in one worker.

Do NOT migrate routes that just do `SELECT … LIMIT 1`. The async overhead (event loop bookkeeping) eats the gain.

## Per-router migration recipe

Use `backend/app/routers/export.py` as the reference. Steps:

### 1. Change the function signature

```python
# Before
def list_things(db: Session = Depends(get_db), ...): ...

# After
async def list_things(db: AsyncSession = Depends(get_async_db), ...): ...
```

Imports:

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_async_db
```

### 2. Rewrite queries using 2.x style

The classic `db.query(Model).filter(...).all()` API is sync-only. Switch to `select()`:

```python
# Before
rows = db.query(Transaction).filter(Transaction.user_id == uid).all()

# After
stmt = select(Transaction).where(Transaction.user_id == uid)
result = await db.execute(stmt)
rows = result.scalars().all()
```

For `func.sum`/`group_by` queries, the only change is `db.execute(stmt)` instead of `db.query(...)`:

```python
# Before
rows = (
    db.query(Transaction.category, func.sum(Transaction.amount))
    .filter(...)
    .group_by(Transaction.category)
    .all()
)

# After
stmt = (
    select(Transaction.category, func.sum(Transaction.amount))
    .where(...)
    .group_by(Transaction.category)
)
rows = (await db.execute(stmt)).all()
```

### 3. Replace `.first()` / `.one()`

```python
# Before
user = db.query(User).filter(User.id == uid).first()

# After
user = (await db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
```

### 4. Replace `.commit()` / `.refresh()` / `.delete()`

```python
# Before
db.add(obj)
db.commit()
db.refresh(obj)
db.delete(other)
db.commit()

# After
db.add(obj)
await db.commit()
await db.refresh(obj)
await db.delete(other)
await db.commit()
```

### 5. Relationship loading

Lazy loading on relationships **does not work in async**. You must eager-load via `selectinload()` (which we already use on `Transaction.tags`):

```python
from sqlalchemy.orm import selectinload

stmt = (
    select(Transaction)
    .options(selectinload(Transaction.tags))
    .where(...)
)
```

Touching an unloaded relationship in async raises `MissingGreenlet`. Annoying first time you see it, fine after that.

### 6. Update tests

Test fixtures need an async session:

```python
# conftest.py — add an async fixture
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker

@pytest_asyncio.fixture
async def async_db():
    engine = get_async_engine()
    async with async_sessionmaker(engine)() as session:
        yield session
        await session.rollback()
```

Mark tests `@pytest.mark.asyncio` if using pytest-asyncio.

### 7. Watch for sync code paths invoked by the async route

If your async route calls into a service module that itself does `db.query(...)`, you have a problem. Two options:

1. Convert the service module too (preferred for hot services like `notification_service`).
2. Run the sync call in a threadpool: `await asyncio.to_thread(service.do_thing, ...)`. Quick fix; not as fast as native async.

## Connection-pool sizing under the dual-engine setting

When both engines are active in the same process:

```
sync_total   = workers × (DB_POOL_SIZE + DB_MAX_OVERFLOW)
async_total  = workers × (DB_POOL_SIZE/2 + DB_MAX_OVERFLOW/2)
combined     = sync_total + async_total
```

At defaults (`workers=4`, `DB_POOL_SIZE=10`, `DB_MAX_OVERFLOW=20`):
- sync = 4 × 30 = 120
- async = 4 × 15 = 60
- combined = 180

That exceeds Neon free tier's 100-conn ceiling. Two fixes:

1. Use the Neon pooler endpoint (`-pooler.neon.tech`) — pooler handles thousands of upstream "connections" by multiplexing.
2. Halve `DB_POOL_SIZE` to 5. New combined: 90 = fits.

`database.py` logs a warning at startup if you're on Neon without the pooler — see PR #34.

## What's NOT in this migration

- **Sync engine removed**: no. Sync engine stays the default; new routes opt in. The day every router is async, we can delete the sync engine — until then, both coexist.
- **Models change**: no. SQLAlchemy 2.x models work for both sync and async.
- **Alembic migrations**: no change. Alembic remains sync (its tooling assumes it).
- **MySQL/MariaDB async**: not configured. Add `asyncmy` to `pyproject.toml` and extend `_build_async_engine()` if you need it.

## Verifying a converted route works

1. Hit it locally: `curl /api/<your-route>` — should return the same shape as before.
2. Run the test suite — anything that touches the converted route + its async fixture should pass.
3. Inspect Postgres: `SELECT pid, query FROM pg_stat_activity WHERE application_name LIKE '%aegis%';` — you should see asyncpg connections (`pg_psycopg=False`).
4. Load-test the route + a slow inline route concurrently — async should keep its latency steady while inline goes up. If it goes up identically, the async route isn't actually freeing the worker (probably hitting #7 above).

## Open questions for the operator

1. Do you have a routes where async would actually help today? If "no" — don't migrate anything. The infrastructure is in place for when you do.
2. Are you running any service that synchronously holds the DB session for > 1 s? Those are the prime targets.
