"""v1.4.0 AI model picker — nullable ai_model on user_preferences

Adds the operator's chosen model for the currently-configured AI provider.
NULL means "use the env default", so an existing deploy that never opens the
picker keeps behaving exactly as it did before this column existed.

The column is deliberately nullable with no server default: a server default
would make "unset" indistinguishable from "explicitly chose the old default",
and the whole point is that the env value stays authoritative until the
operator overrides it.

Revision ID: b3c7e15d9a24
Revises: e7a2b9c41f06
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b3c7e15d9a24"
down_revision: Union[str, Sequence[str], None] = "e7a2b9c41f06"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # batch_alter_table for SQLite parity — SQLite cannot ALTER TABLE ADD
    # COLUMN with every constraint shape, so alembic rebuilds the table.
    with op.batch_alter_table("user_preferences") as batch:
        batch.add_column(sa.Column("ai_model", sa.String(length=128), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("user_preferences") as batch:
        batch.drop_column("ai_model")
