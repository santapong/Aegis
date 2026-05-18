"""v0.9.7 hot-path composite indexes

Revision ID: c9e7d4f80371
Revises: b8d6f3e92c14
Create Date: 2026-05-17 02:00:00.000000

Every hot read path filters on `user_id AND date` (transactions) or
`user_id AND status` / `user_id AND start_date` (plans). Without
composite indexes Postgres scans the user_id index then heap-filters
each row — fine at 1k rows, ~50 ms per query at 100k.

Adds five composite indexes:
- transactions(user_id, date) — list, summary, charts, anomalies
- transactions(user_id, type, date) — charts expense slice, weekly
  summary, anomaly comparison baseline. `type` cardinality is 2 so
  the index covers ~50% of rows; could be a partial index on
  `type = 'expense'` (Postgres-only) but staying portable.
- transactions(user_id, is_recurring) — recurring + upcoming
- plans(user_id, status) — dashboard active/completed counts
- plans(user_id, start_date) — gantt + calendar + list

All use ``op.create_index`` (not batch) because new indexes are
additive — no table copy needed even on SQLite. Existing single-column
indexes are kept; query planners pick the better-fit index per query.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "c9e7d4f80371"
down_revision: Union[str, Sequence[str], None] = "b8d6f3e92c14"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_INDEXES: list[tuple[str, str, list[str]]] = [
    ("ix_transactions_user_date", "transactions", ["user_id", "date"]),
    ("ix_transactions_user_type_date", "transactions", ["user_id", "type", "date"]),
    ("ix_transactions_user_is_recurring", "transactions", ["user_id", "is_recurring"]),
    ("ix_plans_user_status", "plans", ["user_id", "status"]),
    ("ix_plans_user_start_date", "plans", ["user_id", "start_date"]),
]


def upgrade() -> None:
    for name, table, cols in _INDEXES:
        op.create_index(name, table, cols)


def downgrade() -> None:
    for name, table, _ in _INDEXES:
        op.drop_index(name, table)
