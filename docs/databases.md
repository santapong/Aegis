# Database support

Aegis runs on any SQLAlchemy-supported relational database. This page documents what's been tested, what works with a config tweak, and what's deliberately unsupported.

The short version: **PostgreSQL is the recommended primary; MySQL/MariaDB is a fine alternative; SQLite is dev-only; analytics warehouses (Redshift, BigQuery) are the wrong shape for this app.**

## At-a-glance support

```mermaid
flowchart TB
    subgraph OK["✅ Tested / ⚠️ config tweak"]
        direction LR
        PG[PostgreSQL 13–17<br/>+ Neon · Supabase · RDS · Aurora<br/>Cloud SQL · AlloyDB · Azure DB]
        MY[MySQL 8 / MariaDB 10.5+<br/>+ RDS · Cloud SQL · Azure · TiDB]
        SL[SQLite — dev only]
    end

    subgraph CodeChange["🟡 Needs code change"]
        CR[CockroachDB · retry middleware]
        YB[YugabyteDB]
        TS[Turso / libSQL]
    end

    subgraph No["🔴 Not supported as primary"]
        RS[Redshift]
        BQ[BigQuery]
        SP[Spanner]
        PS[PlanetScale<br/>no FKs]
        NS[NoSQL — Mongo / Dynamo / Cosmos / Fauna]
    end

    No -. analytics target via CDC .-> Warehouse[(See analytics-warehouses.md)]

    style OK fill:#efe
    style CodeChange fill:#ffe
    style No fill:#fee
```

## Quick recommendation by use case

| You want… | Use |
|---|---|
| Dev on a laptop | SQLite (the default) |
| Production on AWS | RDS Postgres, or Aurora Postgres for low-latency multi-AZ |
| Production on GCP | Cloud SQL Postgres, or AlloyDB for higher throughput |
| Production on Azure | Azure Database for PostgreSQL |
| Serverless / preview deploys | Neon (Postgres) or Supabase (Postgres) |
| Lowest cost at small scale | Neon free tier |
| Globally distributed with strong consistency | CockroachDB or YugabyteDB (both Postgres-wire-compatible) |
| MySQL ecosystem fit | RDS MySQL, Cloud SQL MySQL, or TiDB ≥ 6.6 |

## Compatibility matrix

✅ tested · ⚠️ works with a config tweak · 🟡 needs code change · 🔴 not supported (explained below)

| Database | Status | Driver | URL prefix | Notes |
|---|---|---|---|---|
| **SQLite** | ✅ | built-in | `sqlite://` | Dev only. FKs enforced via PRAGMA. |
| **PostgreSQL 13–17** | ✅ | psycopg2 | `postgresql://` | Primary target. |
| **AWS RDS Postgres** | ⚠️ | psycopg2 | `postgresql://` | Append `?sslmode=require`. |
| **AWS Aurora Postgres** | ⚠️ | psycopg2 | `postgresql://` | Same as RDS. Aurora Serverless v2 → lower `DB_POOL_RECYCLE`. |
| **GCP Cloud SQL Postgres** | ⚠️ | psycopg2 | `postgresql://` | Use Cloud SQL Auth Proxy sidecar. |
| **GCP AlloyDB** | ⚠️ | psycopg2 | `postgresql://` | Treats as Postgres. |
| **Azure DB for Postgres** | ⚠️ | psycopg2 | `postgresql://` | Append `?sslmode=require`. |
| **Neon** | ⚠️ | psycopg2 | `postgresql://` | Use URL as-given (`sslmode=require&channel_binding=require`). Set `DB_POOL_RECYCLE=300` for free tier. |
| **Supabase** | ⚠️ | psycopg2 | `postgresql://` | Use port 5432 (session mode), not 6543 (transaction pooler). |
| **CockroachDB** | 🟡 | psycopg2 (+ optional `sqlalchemy-cockroachdb`) | `cockroachdb://` or `postgresql://` | Add retry middleware for serializable txn aborts (40001). |
| **YugabyteDB** | ⚠️ | psycopg2 | `postgresql://` | Drop-in. No partial-index features used by Aegis. |
| **MySQL 8.0+** | ✅ | pymysql | `mysql+pymysql://` | charset=utf8mb4 enforced by Aegis. |
| **MariaDB 10.5+** | ✅ | pymysql | `mariadb+pymysql://` | Same code path as MySQL. |
| **AWS RDS MySQL / Aurora MySQL** | ⚠️ | pymysql | `mysql+pymysql://` | Append `?ssl_ca=/path/to/rds-ca.pem`. |
| **GCP Cloud SQL MySQL** | ⚠️ | pymysql | `mysql+pymysql://` | Use Cloud SQL Auth Proxy. |
| **Azure DB for MySQL** | ⚠️ | pymysql | `mysql+pymysql://` | Older "Single Server" tier needs `user@servername` in URL. |
| **TiDB ≥ 6.6** | ⚠️ | pymysql | `mysql+pymysql://` | Older TiDB silently drops FKs — use 6.6+. |
| **Turso / libSQL** | 🟡 | `sqlalchemy-libsql` | `sqlite+libsql://` | Multi-region; eventual consistency may bite in budget-progress reads. |
| **AWS Redshift** | 🔴 | — | — | Column-store analytics DB; no realistic OLTP throughput. |
| **GCP BigQuery** | 🔴 | — | — | Analytics warehouse; no transactions, no per-row mutations. |
| **GCP Spanner** | 🔴 | — | — | NUMERIC/ENUM/FK semantics diverge enough to need a separately maintained schema. |
| **PlanetScale** | 🔴 | — | — | Disallows FOREIGN KEY constraints by design; Aegis has FKs on every table. |
| **MongoDB / DynamoDB / Cosmos / Fauna** | 🔴 | — | — | NoSQL; out of scope (SQLAlchemy is the boundary). |

## Switching databases

Set `DATABASE_URL` and restart. Aegis's startup migrates the schema automatically (`alembic upgrade head` in `docker-entrypoint.sh`).

### Postgres → MySQL

The schema is portable: every column type used by Aegis (`String(N)`, `Numeric(p,s)`, `Boolean`, `DateTime`, `Date`, `Text`, `JSON`) has the same semantics on both. Migration is a `pg_dump` → translate → `mysql` import, or a fresh start (recommended if your data is replaceable).

After switching:
- Verify `SELECT VERSION();` reports the expected engine.
- Run `pytest backend/tests/` against the new DB to confirm round-trips of JSON columns work.

### MySQL → Postgres

Same idea, reverse direction. The biggest portability win on Postgres is JSONB for typed-key indexing, but Aegis doesn't use JSON-key queries today, so generic `JSON` is fine.

### Postgres → CockroachDB

Cockroach is wire-compatible with Postgres, but has stricter serializable isolation. You'll see `40001` retry errors on contention. Aegis doesn't wrap routes in retry middleware today — add a SQLAlchemy retry decorator on the session if you adopt Cockroach for write-heavy workloads.

## Required URL parameters by provider

| Provider | URL extras |
|---|---|
| Neon | `?sslmode=require&channel_binding=require` (their UI gives this) |
| AWS RDS / Aurora Postgres | `?sslmode=require` |
| AWS RDS / Aurora MySQL | `?ssl_ca=/path/to/rds-combined-ca-bundle.pem` |
| Azure DB for Postgres | `?sslmode=require` |
| Supabase | use port 5432 (session pooler), not 6543 |
| Cloud SQL (any) | go through the Cloud SQL Auth Proxy → URL points to 127.0.0.1 |

## Pool tuning per provider

These are starting points — tune based on your DB's `max_connections` and your replica count.

| Provider | `DB_POOL_SIZE` | `DB_MAX_OVERFLOW` | `DB_POOL_RECYCLE` |
|---|---|---|---|
| RDS / Aurora Postgres (single replica) | 10 | 20 | 1800 |
| RDS / Aurora MySQL | 10 | 20 | 1800 |
| Cloud SQL / AlloyDB | 10 | 20 | 1800 |
| Neon free tier | 2 | 2 | 300 |
| Neon paid | 10 | 10 | 1800 |
| Supabase free | 5 | 5 | 600 |
| Aurora Serverless v2 | 5 | 5 | 600 |

Backend instances × `(DB_POOL_SIZE + DB_MAX_OVERFLOW)` must stay under your DB's `max_connections`. On Neon free tier (100 conn limit) you can run ~50 backend pods of size 2+2; on RDS db.t3.micro (max 87) about 4 pods of 10+10.

## Want analytics on a warehouse?

The 🔴 column above (Redshift, BigQuery, Spanner, PlanetScale) covers databases that **shouldn't be Aegis's primary store** — but Redshift / BigQuery / Snowflake / ClickHouse make excellent analytics targets *downstream* of the operational Postgres. See [`docs/analytics-warehouses.md`](./analytics-warehouses.md) for the CDC pipeline patterns, per-warehouse target schemas, and the `/api/export/*.ndjson` bootstrap endpoints.

## What's NOT supported as primary DB (and why)

**AWS Redshift** is a column-store analytics warehouse. It does row-level UPDATE/DELETE only as a costly rewrite of entire columns. Aegis writes one row per transaction-create API call — Redshift would be 10–100× slower per call and significantly more expensive. If you want analytics on top of Aegis, use a CDC pipeline (Debezium, Fivetran) to replicate from your OLTP Postgres into Redshift for BI tools to query.

**GCP BigQuery**: same shape as Redshift — analytics warehouse, no per-row OLTP. Wrong fit.

**GCP Spanner**: globally-distributed Postgres-like NewSQL. The Postgres dialect exists but `NUMERIC(p,s)`, `ENUM`, `ondelete='SET NULL'`, and array columns all behave differently enough that you'd need a separately maintained schema. Revisit only if you specifically need cross-region strong consistency at planet scale.

**PlanetScale**: MySQL-compatible, but forbids `FOREIGN KEY` constraints (a Vitess limitation). Aegis declares FKs on every table for referential integrity. Stripping them would silently allow orphan rows (a payment for a deleted user, a tag link to a deleted transaction). Not worth supporting.

**NoSQL** (MongoDB, DynamoDB, Cosmos DB, FaunaDB): out of scope. SQLAlchemy is the boundary, and Aegis's domain model is heavily relational (transactions ↔ tags M:N, plans ↔ plans self-referential, budgets ↔ trips). Re-modeling for a document store would be a fork, not a port.

## Operational concerns

### SSL/TLS

Every managed Postgres / MySQL service requires SSL. Aegis doesn't inject `sslmode=require` automatically — set it on `DATABASE_URL` per-environment. Production should never use `sslmode=prefer` or `sslmode=allow`.

### IAM authentication

AWS RDS / Aurora and GCP Cloud SQL support IAM-based auth where the connection password is generated from short-lived tokens. Not wired into Aegis today — would require a callable `connect_args["password"]` that mints a fresh token per connection. Workaround: rotate `DATABASE_URL`'s password via your secrets manager.

### Read replicas

Aegis runs a single `engine`. Read replicas would require splitting reads from writes (`Session.using_bind_for_read()` or a routing dialect). On Aurora / Cloud SQL replicas, your read traffic still hits the primary today.

### Migration concurrency

```mermaid
flowchart LR
    Risk["Two pods<br/>roll out together<br/>both run alembic"]
    Risk --> Race[("Race condition<br/>on schema migration")]

    Fix1[Init container /<br/>pre-deploy Job] --> Safe(("✅ Safe"))
    Fix2[Rolling deploy<br/>maxSurge=0] --> Safe

    style Race fill:#fee
    style Safe fill:#efe
```

`docker-entrypoint.sh` runs `alembic upgrade head` on container start. Two pods rolling out simultaneously can race the migration. Two safer patterns:

1. **Init container / pre-deploy job**: run migrations as a one-shot Kubernetes Job or pre-deploy task; the actual web pods start only after the job succeeds. Recommended.
2. **Rolling deploy with `maxSurge=0`**: old pods drain fully before new pods start, so only one container ever runs alembic at a time.

The Postgres `pg_advisory_lock(...)` pattern works in theory but can't be cleanly held across `subprocess` boundaries the way `docker-entrypoint.sh` is structured — easier to fix at the deploy-orchestration layer.

## Verifying multi-DB support locally

Spin up Postgres and MySQL side-by-side, point Aegis at each in turn, run the tests:

```sh
# Postgres
docker run -d --name pg -p 5432:5432 -e POSTGRES_PASSWORD=test postgres:16
DATABASE_URL='postgresql://postgres:test@localhost:5432/postgres' \
  pytest backend/tests/

# MySQL
docker run -d --name my -p 3306:3306 -e MYSQL_ROOT_PASSWORD=test mysql:8
DATABASE_URL='mysql+pymysql://root:test@localhost:3306/mysql' \
  pytest backend/tests/

# SQLite (default)
pytest backend/tests/
```

Each `pytest` run starts from a fresh schema; expect ~1.1k LOC of tests to pass against all three.
