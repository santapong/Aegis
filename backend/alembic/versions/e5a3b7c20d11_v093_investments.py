"""v0.9.3 investments table for portfolio tracking

Revision ID: e5a3b7c20d11
Revises: d4f2a5b91c01
Create Date: 2026-05-15 13:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5a3b7c20d11"
down_revision: Union[str, Sequence[str], None] = "d4f2a5b91c01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "investments",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("tradingview_symbol", sa.String(length=64), nullable=False),
        sa.Column("units", sa.Numeric(18, 6), nullable=False, server_default="0"),
        sa.Column("cost_basis", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("current_price", sa.Numeric(14, 4), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(length=8), nullable=False, server_default="USD"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("last_priced_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("investments", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_investments_user_id"), ["user_id"], unique=False
        )


def downgrade() -> None:
    with op.batch_alter_table("investments", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_investments_user_id"))
    op.drop_table("investments")
