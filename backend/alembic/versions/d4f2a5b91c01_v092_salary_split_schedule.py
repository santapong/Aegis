"""v0.9.2 split-schedule recurrence for transactions

Revision ID: d4f2a5b91c01
Revises: c3e1f5a82b14
Create Date: 2026-05-15 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4f2a5b91c01"
down_revision: Union[str, Sequence[str], None] = "c3e1f5a82b14"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("transactions", schema=None) as batch_op:
        batch_op.add_column(sa.Column("recurrence_dates", sa.JSON(), nullable=True))
        batch_op.add_column(
            sa.Column("recurrence_weekend_rule", sa.String(length=16), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("transactions", schema=None) as batch_op:
        batch_op.drop_column("recurrence_weekend_rule")
        batch_op.drop_column("recurrence_dates")
