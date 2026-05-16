"""v0.9.4 Google OAuth — nullable password + google_subject column

Revision ID: f6b4c8d92e15
Revises: e5a3b7c20d11
Create Date: 2026-05-16 04:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f6b4c8d92e15"
down_revision: Union[str, Sequence[str], None] = "e5a3b7c20d11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Google OAuth users register without setting a password, so the
    # column must become nullable. The app layer enforces that at least
    # one of (hashed_password, google_subject) is set per user.
    with op.batch_alter_table("users") as batch:
        batch.alter_column(
            "hashed_password",
            existing_type=sa.String(length=255),
            nullable=True,
        )
        batch.add_column(
            sa.Column("google_subject", sa.String(length=255), nullable=True)
        )
        batch.create_unique_constraint("uq_users_google_subject", ["google_subject"])
        batch.create_index(
            "ix_users_google_subject", ["google_subject"], unique=False
        )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_index("ix_users_google_subject")
        batch.drop_constraint("uq_users_google_subject", type_="unique")
        batch.drop_column("google_subject")
        # NOTE: cannot make hashed_password NOT NULL on downgrade because
        # any Google-only users will have NULL. Best-effort: leave it
        # nullable. Operators who really need the strict schema should
        # delete the Google-only rows first.
