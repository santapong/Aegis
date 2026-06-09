"""v0.9.9 notifications list index

Revision ID: e7a2b9c41f06
Revises: d6f8a3b15942
Create Date: 2026-06-09 23:30:00.000000

notifications(user_id, created_at) — list_notifications runs
`WHERE user_id = ? ORDER BY created_at DESC LIMIT n` on every page
load (bell badge poll). The existing (user_id, read_at) index covers
the unread count but not the ordered listing, which otherwise sorts
the user's whole notification history. Additive; no
batch_alter_table needed even on SQLite.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "e7a2b9c41f06"
down_revision: Union[str, Sequence[str], None] = "d6f8a3b15942"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_notifications_user_created", "notifications", ["user_id", "created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_user_created", "notifications")
