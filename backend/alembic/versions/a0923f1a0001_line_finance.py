"""Separate LINE finance identity, confirmation and delivery records.

Revision ID: a0923f1a0001
Revises: d5e9a37b2c81
"""

import sqlalchemy as sa

from alembic import op

revision = "a0923f1a0001"
down_revision = "d5e9a37b2c81"
branch_labels = None
depends_on = None


def upgrade():
    user_fk = lambda: sa.ForeignKey("users.id", ondelete="CASCADE")
    op.create_table(
        "line_finance_codes",
        sa.Column("digest", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(36), user_fk(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_line_finance_codes_user_id", "line_finance_codes", ["user_id"])
    op.create_table(
        "line_finance_identities",
        sa.Column("line_id", sa.String(128), primary_key=True),
        sa.Column("user_id", sa.String(36), user_fk(), nullable=False, unique=True),
    )
    op.create_table(
        "line_finance_events",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "line_finance_drafts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), user_fk(), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("transaction_id", sa.String(36)),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_line_finance_drafts_user_id", "line_finance_drafts", ["user_id"]
    )
    op.create_table(
        "line_finance_replies",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("line_id", sa.String(128), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("next_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_line_finance_replies_state", "line_finance_replies", ["state"])


def downgrade():
    for name in [
        "line_finance_replies",
        "line_finance_drafts",
        "line_finance_events",
        "line_finance_identities",
        "line_finance_codes",
    ]:
        op.drop_table(name)
