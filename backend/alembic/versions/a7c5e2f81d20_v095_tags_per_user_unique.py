"""v0.9.5 tags unique per user, not globally

Revision ID: a7c5e2f81d20
Revises: f6b4c8d92e15
Create Date: 2026-05-16 18:00:00.000000

Background: the original tags table had ``name UNIQUE``, which meant
the first user to create a tag called "groceries" blocked every other
user from ever creating their own "groceries" tag. The intended scope
was per-user uniqueness — Alice and Bob should each have their own
tag namespace.

This migration drops the global unique constraint and replaces it with
a composite unique constraint on (user_id, name).

Pre-flight consideration: if any name+user_id duplicates exist already
(shouldn't, given the old global constraint), the composite constraint
would fail to create. We delete the global constraint first to be safe.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a7c5e2f81d20"
down_revision: Union[str, Sequence[str], None] = "f6b4c8d92e15"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("tags") as batch:
        # Drop the old global unique constraint on name. SQLAlchemy gave
        # it an auto-generated name; batch_alter handles the rename
        # round-trip on SQLite.
        batch.drop_index("ix_tags_name", if_exists=True)
        # Older SQLAlchemy versions created the unique as a constraint
        # rather than an index, so attempt both. The if_exists guards
        # keep this idempotent across deploy histories.
        try:
            batch.drop_constraint("tags_name_key", type_="unique")
        except Exception:
            pass
        try:
            batch.drop_constraint("uq_tags_name", type_="unique")
        except Exception:
            pass
        batch.create_unique_constraint(
            "uq_tags_user_name", ["user_id", "name"]
        )


def downgrade() -> None:
    with op.batch_alter_table("tags") as batch:
        batch.drop_constraint("uq_tags_user_name", type_="unique")
        # Restore the old global unique — best-effort; if multiple users
        # created the same tag name in the meantime, this will fail and
        # an operator has to dedupe manually.
        batch.create_unique_constraint("tags_name_key", ["name"])
