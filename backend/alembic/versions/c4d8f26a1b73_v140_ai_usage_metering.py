"""v1.4.0 AI usage metering — ai_usage table

One row per successful provider call, written from AIEngine._call_tool.
Substrate for the cost panel: token counts come off the provider response and
stay accurate with no maintenance, whereas a dollar figure depends on a price
table someone has to keep current.

Indexes: (user_id) and (created_at) individually plus a composite on
(user_id, created_at) — the usage endpoint always filters "this user, since
date", which is exactly that composite's shape.

Revision ID: c4d8f26a1b73
Revises: b3c7e15d9a24
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4d8f26a1b73"
down_revision: Union[str, Sequence[str], None] = "b3c7e15d9a24"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_usage",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("model", sa.String(length=128), nullable=False),
        sa.Column("operation", sa.String(length=32), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_usage_user_id", "ai_usage", ["user_id"])
    op.create_index("ix_ai_usage_created_at", "ai_usage", ["created_at"])
    op.create_index(
        "ix_ai_usage_user_created", "ai_usage", ["user_id", "created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_ai_usage_user_created", table_name="ai_usage")
    op.drop_index("ix_ai_usage_created_at", table_name="ai_usage")
    op.drop_index("ix_ai_usage_user_id", table_name="ai_usage")
    op.drop_table("ai_usage")
