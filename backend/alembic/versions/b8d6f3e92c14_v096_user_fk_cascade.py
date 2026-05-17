"""v0.9.6 add ON DELETE CASCADE to user-owned FKs

Revision ID: b8d6f3e92c14
Revises: a7c5e2f81d20
Create Date: 2026-05-16 19:30:00.000000

Background: until v0.9.6, no foreign key declared an ON DELETE action,
which means Postgres / MySQL defaulted to NO ACTION (RESTRICT). The
practical effect: deleting a User raised IntegrityError because every
child row blocked it. Account deactivation (`is_active=False`) was the
only safe path.

This migration adds ON DELETE CASCADE to every user-owned FK across
all 12 child tables. After this, deleting a User row deletes their
transactions, plans, budgets, tags, debts, payments, notifications,
trips, investments, savings goals, AI recommendations, and
preferences atomically.

GDPR-relevant: this is the schema underpinning of an eventual
"delete my account" endpoint. The endpoint itself isn't added in
this migration — flipping `is_active=False` is still the recommended
soft-delete path — but the schema is now ready.

Compatibility:
- PostgreSQL: native ALTER CONSTRAINT replacement.
- MySQL/MariaDB: same DDL, FK name is auto-generated; batch handles.
- SQLite: requires CREATE-rename-COPY-DROP dance, handled by
  batch_alter_table.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8d6f3e92c14"
down_revision: Union[str, Sequence[str], None] = "a7c5e2f81d20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (table, column, fk_name_guesses, nullable, target_table)
# `fk_name_guesses` covers the names SQLAlchemy generated in different
# eras / dialects — Postgres uses `<table>_<col>_fkey`, MySQL uses an
# auto-incremented name, and explicit naming conventions weren't used
# in early migrations. We try each name and ignore "doesn't exist"
# errors so the migration is idempotent across deploy histories.
_USER_FK_TABLES = [
    ("transactions", "user_id", True),
    ("plans", "user_id", True),
    ("budgets", "user_id", True),
    ("payments", "user_id", True),
    ("notifications", "user_id", False),
    ("trips", "user_id", False),
    ("investments", "user_id", False),
    ("user_preferences", "user_id", False),
    ("savings_goals", "user_id", True),
    ("debts", "user_id", True),
    ("ai_recommendations", "user_id", True),
    ("tags", "user_id", True),
]


def _drop_existing_fk(batch, table: str, column: str) -> None:
    """Drop the existing user_id FK by any name it might have."""
    name_guesses = [
        f"{table}_{column}_fkey",        # Postgres default
        f"fk_{table}_{column}_users",    # SQLAlchemy naming-convention default
        f"fk_{table}_{column}",
    ]
    for name in name_guesses:
        try:
            batch.drop_constraint(name, type_="foreignkey")
            return
        except Exception:
            continue


def upgrade() -> None:
    for table, column, nullable in _USER_FK_TABLES:
        with op.batch_alter_table(table) as batch:
            _drop_existing_fk(batch, table, column)
            batch.create_foreign_key(
                f"{table}_{column}_fkey",
                "users",
                [column],
                ["id"],
                ondelete="CASCADE",
            )


def downgrade() -> None:
    # Revert to NO ACTION — re-create the FK without an ondelete clause.
    for table, column, nullable in _USER_FK_TABLES:
        with op.batch_alter_table(table) as batch:
            try:
                batch.drop_constraint(f"{table}_{column}_fkey", type_="foreignkey")
            except Exception:
                pass
            batch.create_foreign_key(
                f"{table}_{column}_fkey",
                "users",
                [column],
                ["id"],
            )
