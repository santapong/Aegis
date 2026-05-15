"""v0.9.1 add user_preferences table

Revision ID: c3e1f5a82b14
Revises: b2d9e4f1a701
Create Date: 2026-05-15 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3e1f5a82b14"
down_revision: Union[str, Sequence[str], None] = "b2d9e4f1a701"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "user_preferences",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column(
            "currency",
            sa.String(length=8),
            nullable=False,
            server_default="USD",
        ),
        sa.Column(
            "default_date_range_days",
            sa.Integer(),
            nullable=False,
            server_default="30",
        ),
        sa.Column(
            "items_per_page",
            sa.Integer(),
            nullable=False,
            server_default="25",
        ),
        sa.Column(
            "ai_auto_suggestions",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_user_preferences_user_id"),
    )
    with op.batch_alter_table("user_preferences", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_user_preferences_user_id"),
            ["user_id"],
            unique=False,
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("user_preferences", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_user_preferences_user_id"))
    op.drop_table("user_preferences")
