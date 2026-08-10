"""v1.4.0 operator secret storage — user_secrets table

Encrypted per-user secrets. First consumer is the AI provider key; the LINE
Messaging token on the roadmap is the designed-for second, which is why this
is a keyed table rather than a column on `users`.

Revision ID: d5e9a37b2c81
Revises: c4d8f26a1b73
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d5e9a37b2c81"
down_revision: Union[str, Sequence[str], None] = "c4d8f26a1b73"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_secrets",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("key_name", sa.String(length=64), nullable=False),
        sa.Column("encrypted_value", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        # One value per (user, key). Upserts rely on this.
        sa.UniqueConstraint("user_id", "key_name", name="uq_user_secrets_user_key"),
    )
    op.create_index("ix_user_secrets_user_id", "user_secrets", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_secrets_user_id", table_name="user_secrets")
    op.drop_table("user_secrets")
