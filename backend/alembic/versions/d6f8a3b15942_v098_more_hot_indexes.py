"""v0.9.8 follow-up composite indexes

Revision ID: d6f8a3b15942
Revises: c9e7d4f80371
Create Date: 2026-05-18 02:30:00.000000

Three more composite indexes the perf audit flagged. v0.9.7 covered
the absolute-hottest paths (`transactions`, `plans` filters). These
catch the next-tier hot reads:

- transactions(user_id, category) — list_transactions ?category=,
  budget comparison joins, anomaly category bucketing
- budgets(user_id, period_start) — budget_comparison,
  health_score, evaluate_budget_thresholds (fires on every txn
  mutation). With this index the period-overlap predicate
  becomes an index range scan instead of a full user-partition
  scan.
- ai_recommendations(user_id, created_at) — /api/ai/history
  ORDER BY created_at DESC. Index-only scan + LIMIT.

All additive; no batch_alter_table needed even on SQLite.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "d6f8a3b15942"
down_revision: Union[str, Sequence[str], None] = "c9e7d4f80371"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_INDEXES: list[tuple[str, str, list[str]]] = [
    ("ix_transactions_user_category", "transactions", ["user_id", "category"]),
    ("ix_budgets_user_period_start", "budgets", ["user_id", "period_start"]),
    ("ix_ai_recommendations_user_created", "ai_recommendations", ["user_id", "created_at"]),
]


def upgrade() -> None:
    for name, table, cols in _INDEXES:
        op.create_index(name, table, cols)


def downgrade() -> None:
    for name, table, _ in _INDEXES:
        op.drop_index(name, table)
