# 11 · Caching — what's cached, what isn't, how to add more

Aegis ships with a small, pluggable cache layer that sits between hot-path read endpoints and the database. This page explains what's already wrapped, when to add more, and the gotchas of running it across multiple pods.

## TL;DR

- **What's cached today**: `/api/dashboard/summary` and `/api/dashboard/charts`, per user, 60 s TTL.
- **What invalidates the cache**: every transaction create / update / delete drops the user's `dashboard:*` cache keys before responding.
- **Default backend**: in-memory TTL dict — fine for dev and single-pod prod.
- **Production backend**: Redis. Set `CACHE_BACKEND=redis` + `CACHE_REDIS_URL=rediss://...`.
- **Emergency switch**: `CACHE_BACKEND=disabled` no-ops every cache call without rebuilding.

## Why we bother

The dashboard fires four read endpoints on every page load. Each does a full scan of the user's transactions. On a fresh user it's free; on a user with 5 000 rows it's ~50 ms per query. Caching the JSON response for 60 s drops the second-and-subsequent renders to ~3 ms — important because the dashboard is the most-loaded page in the app and React Query refetches on window focus.

The other side of the trade is correctness: a cached read after a write would show stale data. The current pattern *invalidates on every write* (see `_DASHBOARD_CACHE_SCOPES` in `backend/app/routers/transactions.py`), so a fresh transaction shows up in the dashboard immediately.

## The three backends

```env
CACHE_BACKEND=memory   # default
CACHE_BACKEND=redis    # production
CACHE_BACKEND=disabled # incident-response no-op
```

**`memory`** — a per-process TTL dict in `backend/app/cache.py`. State is lost on every restart and **not shared across uvicorn workers**. With `--workers 2`, a write that invalidates a key in worker A leaves worker B serving a stale cached read until its own TTL expires. That's a few seconds of skew — acceptable in dev, generally not in prod.

**`redis`** — `redis>=5.0` is a project dependency; install it once with `uv sync` and the backend connects on first use. The connect timeout is 2 s; if Redis is unreachable at startup the app *falls back to in-memory* rather than failing to boot. That's deliberate — caching is an optimization, not a hard dependency.

**`disabled`** — every `cache.get` returns `None`, every `cache.set` is dropped. Useful when chasing a stale-read incident: flip the env var, redeploy, see if the bug repros. If it doesn't, you've localized it to cache invalidation.

## What's currently cached

| Scope | Key format | TTL | Invalidated by |
|---|---|---|---|
| `dashboard:summary` | `dashboard:summary:<user_id>` | 60 s | Transaction create / update / delete |
| `dashboard:charts` | `dashboard:charts:<user_id>` | 60 s | Transaction create / update / delete |

That's it for now. Health score, cashflow forecast, AI recommendations — all uncached. Adding more is cheap, but each adds a place we have to remember to invalidate.

## The pattern (for adding cache to a new route)

Three lines on read, one line on each related write. Example:

```python
# In your read route:
@router.get("/...")
def get_thing(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cache = get_cache()
    key = user_scope("thing:summary", current_user.id)
    cached = cache.get(key)
    if cached is not None:
        return ThingResponse(**cached)

    # ... actual DB work ...
    result = ThingResponse(...)
    cache.set(key, result, ttl=_settings.cache_default_ttl)
    return result


# In every related write route:
invalidate_user(["thing:summary"], current_user.id)
```

`user_scope()` is the recommended key builder — it puts `user_id` second so `delete_prefix(f"thing:summary:{user_id}")` is cheap on Redis.

### Three rules for picking what to cache

1. **High read rate, low write rate.** Dashboard yes, settings page no.
2. **Cheap to invalidate.** If a write to entity X affects 10 cached scopes, you've added complexity for not much win.
3. **Tolerable staleness up to TTL.** A cached AI recommendation that's 60 s old is fine. A cached account balance that's 60 s old after a $1000 withdrawal — surprising. Use a shorter TTL or invalidate.

## Common gotchas

### "I made a write and the dashboard still shows the old data"

Three possible causes:

1. **Forgot the invalidation hook**. Search for the entity's mutation routes — every create/update/delete should call `invalidate_user(scopes, user_id)`. If you added a new entity (a CSV import bulk-confirm endpoint, say) and didn't add the invalidation call, the cache will go stale until TTL.
2. **You're using the in-memory backend with multiple workers**. Worker A's invalidate-call doesn't reach worker B. Symptoms: refresh-the-page sometimes shows fresh data, sometimes stale. Fix: deploy Redis.
3. **The TTL hasn't expired yet AND you don't have an invalidation hook installed.** Stale read for up to `CACHE_DEFAULT_TTL` seconds. Fix: add the hook.

### "Redis is down and the app crashed"

It shouldn't — `RedisCache.get` and `set` catch every exception and log a warning. A Redis outage degrades to "every request hits the DB" rather than "every request 500s". If you're seeing crashes, share the stack trace; it's a bug.

### "Cached values broke after a deploy"

A schema change to one of the response models (e.g. adding a required field to `KPISummary`) makes the cached JSON from before the deploy invalid. Two fixes:

1. **Wait** — cached values TTL out within `CACHE_DEFAULT_TTL` seconds.
2. **Flush** — `redis-cli -u $CACHE_REDIS_URL FLUSHDB`. Drops every cached key. Safe; the app rebuilds them on next read.

For breaking changes, a flush on rollout is the safest play. Add it as a post-deploy step alongside `alembic upgrade head`.

## Sizing Redis

Aegis caches small JSON blobs (typically < 4 KB per key, 2–4 keys per active user). Back-of-envelope:

| Active users | Cache size | Memory needed |
|---|---|---|
| 100 | 400 KB | rounding error |
| 10 000 | 40 MB | smallest Upstash / ElastiCache tier |
| 1 000 000 | 4 GB | r6g.large or equivalent |

Adding more cached scopes scales linearly. AI-recommendation cache (when added) would be larger (~10 KB) — still well within free tiers at any realistic Aegis scale.

## What's intentionally NOT cached

- **`/api/auth/me`** — needs to reflect immediate role / status changes. The cache hit isn't worth the staleness risk.
- **`/api/transactions/`** — already paginated; the per-page round-trip is cheap.
- **Write endpoints** — never. We invalidate, never serve cached.
- **`/api/health`** — hits the DB on purpose to check connectivity.

## Operational checklist

- [ ] `CACHE_BACKEND` set explicitly in production env (not relying on the `memory` default).
- [ ] If `redis`, `CACHE_REDIS_URL` is a managed Redis with TLS (Upstash, ElastiCache, Memorystore, Redis Cloud).
- [ ] Redis pool sizing — Aegis uses default `redis-py` pool (connection-per-call style). For >1 000 RPS, set a pool explicitly via environment.
- [ ] Monitoring on Redis: hit rate, memory used, evicted keys. The default `noeviction` policy is fine; eviction strategy depends on your traffic shape.
- [ ] Backup is unnecessary — cache is by definition rebuildable from the DB.
