# Analytics warehouses (Redshift, BigQuery, Snowflake, ClickHouse)

This page is for operators who want to run BI dashboards, ML feature engineering, or compliance reporting on top of Aegis data without those workloads competing with the operational app for resources.

**The architecture that works**: Aegis owns its operational data in a transactional Postgres / MySQL. A change-data-capture (CDC) pipeline replicates that data into an analytics warehouse on a delay (seconds to minutes). BI tools (Looker, Metabase, Superset, Tableau, Hex) read the warehouse. The two databases are tuned for their own job — neither one tries to be both.

**The architecture that doesn't work**: pointing `DATABASE_URL` at a warehouse directly. See the [database compatibility doc](databases.md) for why — column-store warehouses are 10–100× slower for the per-row writes Aegis does on every API call, and several (PlanetScale, BigQuery) reject the basic primitives the schema relies on (FKs, transactions).

## Recommended pipelines

Pick based on your team's existing infrastructure. Cost ranges are rough — read the vendor pricing pages.

| You want | Use |
|---|---|
| Lowest-effort managed CDC | Fivetran / Airbyte (managed) |
| Open-source / self-hosted | Debezium (Kafka) + Materialize, or Airbyte OSS |
| Same-cloud, low latency | AWS DMS (RDS → Redshift), Google DataStream (Cloud SQL → BigQuery) |
| Tiny budget, nightly is fine | A simple cron job that runs `pg_dump | gzip | aws s3 cp` and a Redshift `COPY` |

## What to replicate

Every row in these tables is analytics-relevant:

- `transactions` — the main fact table
- `plans`, `budgets`, `savings_goals`, `investments`, `debts` — dimensional + fact context
- `users` — dimension (id, created_at, is_active)
- `tags`, `transaction_tags` — many-to-many for cohort analysis
- `payments` — for revenue analysis

Do NOT replicate:

- `user_preferences` — settings, not analytical
- `notifications` — operational alerts; transient
- `ai_recommendations` — derived data, regenerate downstream
- `hashed_password`, `google_subject` on `users` — PII, never leaves prod
- `metadata_json` on `payments` — may contain Stripe-internal IDs

A safe replication mask: every column except the three on `users` above.

## Warehouse-specific target schemas

The Aegis source schema (`backend/app/models/`) is the canonical reference. Below is each warehouse's idiomatic target schema for the most-replicated table, `transactions`. CDC tools usually handle this translation automatically; the table is here for hand-rolled pipelines.

### Redshift

```sql
CREATE TABLE transactions (
  id           VARCHAR(36)   NOT NULL,
  user_id      VARCHAR(36)   NOT NULL ENCODE LZO,
  date         DATE          NOT NULL SORTKEY,
  amount       NUMERIC(12,2) NOT NULL,
  type         VARCHAR(16)   NOT NULL ENCODE LZO,
  category     VARCHAR(64)   ENCODE LZO,
  description  VARCHAR(512),
  trip_id      VARCHAR(36),
  is_recurring BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMP     NOT NULL,
  updated_at   TIMESTAMP     NOT NULL
)
DISTKEY (user_id)
SORTKEY (date, user_id);
```

`DISTKEY(user_id)` co-locates a single user's rows on one slice — every dashboard query filters by user_id so this collapses cross-slice fanout. `SORTKEY(date, user_id)` matches the most common range filter. Don't add FKs — Redshift doesn't enforce them.

### BigQuery

```sql
CREATE TABLE aegis.transactions (
  id           STRING       NOT NULL,
  user_id      STRING       NOT NULL,
  date         DATE         NOT NULL,
  amount       NUMERIC(12,2) NOT NULL,
  type         STRING       NOT NULL,
  category     STRING,
  description  STRING,
  trip_id      STRING,
  is_recurring BOOL         NOT NULL,
  created_at   TIMESTAMP    NOT NULL,
  updated_at   TIMESTAMP    NOT NULL
)
PARTITION BY date
CLUSTER BY user_id, category;
```

`PARTITION BY date` lets you query a single month for cents instead of dollars. `CLUSTER BY user_id, category` co-locates per-user scans.

### Snowflake

```sql
CREATE TABLE transactions (
  id           VARCHAR(36)   NOT NULL,
  user_id      VARCHAR(36)   NOT NULL,
  date         DATE          NOT NULL,
  amount       NUMBER(12,2)  NOT NULL,
  type         VARCHAR(16)   NOT NULL,
  category     VARCHAR(64),
  description  VARCHAR(512),
  trip_id      VARCHAR(36),
  is_recurring BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMP_NTZ NOT NULL,
  updated_at   TIMESTAMP_NTZ NOT NULL
)
CLUSTER BY (date, user_id);
```

### ClickHouse

```sql
CREATE TABLE transactions (
  id           String,
  user_id      String,
  date         Date,
  amount       Decimal(12, 2),
  type         LowCardinality(String),
  category     LowCardinality(String),
  description  String,
  trip_id      Nullable(String),
  is_recurring UInt8,
  created_at   DateTime,
  updated_at   DateTime
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (user_id, date, id);
```

`LowCardinality` on `type` and `category` cuts storage 10× since those columns have a small distinct set.

## Bootstrap export endpoint

A small admin-only endpoint dumps a user's data as newline-delimited JSON for bulk-loading into a warehouse without setting up CDC. Useful for one-shot imports or compliance subject-access requests.

```
GET /api/admin/export/users/{user_id}/transactions.ndjson
```

Auth: requires the standard JWT *and* the user must be the owner of the requested data. Admin-cross-user export is not exposed in this PR — that's a separate "admin role" piece that doesn't exist yet.

The response streams NDJSON (one JSON object per line). Pipe directly into:

```sh
# Redshift via S3
curl -H "Authorization: Bearer $T" https://app/.../transactions.ndjson \
  | aws s3 cp - s3://bucket/aegis/transactions/$(date +%Y/%m/%d).ndjson
psql -c "COPY transactions FROM 's3://bucket/aegis/transactions/...' IAM_ROLE '...' FORMAT JSON;"

# BigQuery
curl -H "Authorization: Bearer $T" https://app/.../transactions.ndjson \
  | gzip \
  | gsutil cp - gs://bucket/aegis/transactions/$(date +%Y/%m/%d).ndjson.gz
bq load --source_format=NEWLINE_DELIMITED_JSON aegis.transactions \
  gs://bucket/aegis/transactions/...
```

NDJSON over CSV: handles nested `tags` and JSON columns cleanly without quoting pain.

## CDC tooling notes

### Fivetran

Connect a Postgres source pointing at your Aegis DB; pick the tables listed above; pick a destination (Redshift / BigQuery / Snowflake). Their managed connector handles schema evolution (Aegis migrations) automatically. Cost is per active-user-row per month; for an Aegis at ≤ 100 K users it's typically $100–300/mo.

### Airbyte (managed or OSS)

Same shape as Fivetran, cheaper if self-hosted but you operate the K8s cluster. The Postgres source supports both logical replication (CDC) and snapshot-only modes. Pick CDC for production — snapshot mode is fine for prototyping.

### Debezium + Kafka

If you already run Kafka, Debezium emits a stream of row-level change events from Postgres's WAL. From Kafka you can sink into anything (Materialize, ksqlDB, ClickHouse, S3, BigQuery via Confluent Cloud). Maximum flexibility; maximum operational surface area.

### AWS DMS

If both Aegis's DB and the warehouse are on AWS, DMS is the lowest-friction path: RDS → Redshift in 15 minutes via the console. Supports full-load + ongoing replication. The DMS bill is usually < $100/mo for Aegis-sized workloads.

### Google Datastream

Same as DMS but for GCP. Cloud SQL → BigQuery via the console. Costs about $1/GB scanned + a small instance fee.

## Schema drift

Every time Aegis ships a new migration (`backend/alembic/versions/`), the warehouse schema can drift behind. Three patterns to keep them in sync:

1. **CDC tool auto-evolves** — Fivetran, Airbyte, DMS, Datastream all handle column adds. They mostly do NOT handle column type changes or table drops without manual intervention; subscribe to their alerts.
2. **Schema-translation script in CI** — a small Python script reads the latest Aegis SQLAlchemy metadata and emits the equivalent Redshift / BigQuery DDL. Run on every PR. Diff fails the build if the warehouse target schema would need updates.
3. **Hand-managed** — only viable at small scale; expect one outage per quarter when an Aegis column rename breaks a downstream dashboard.

## What about Aegis writing to the warehouse?

It doesn't, and shouldn't. The warehouse is the *destination* of analytical workloads, not the source of any operational read or write. If you find yourself wanting Aegis to query the warehouse — for an "AI recommendation" that needs historical aggregates — the right pattern is a **derived table** materialised in the warehouse and then synced back into a cache (`/api/ai/recommendations`) at low frequency. Keeps the hot path away from a slow query.
