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
    # Probe what form the old global unique actually took before queueing
    # drops. The previous version guarded with `if_exists=True` and
    # try/except around batch ops — neither works under SQLite's batch
    # recreate path (ApplyBatchImpl rejects the kwarg on alembic 1.16+,
    # and batch ops only execute at context exit, after the except).
    # Inspector checks are portable to MySQL too, which has no
    # DROP INDEX IF EXISTS.
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_indexes = {ix["name"] for ix in insp.get_indexes("tags")}
    existing_uniques = {uc["name"] for uc in insp.get_unique_constraints("tags")}

    # Index form: drop outside the batch — SQLite indexes are standalone
    # objects, no table recreate needed.
    if "ix_tags_name" in existing_indexes:
        op.drop_index("ix_tags_name", table_name="tags")

    with op.batch_alter_table("tags") as batch:
        # Constraint form: older SQLAlchemy versions created the global
        # unique as a table constraint under either name.
        for name in ("tags_name_key", "uq_tags_name"):
            if name in existing_uniques:
                batch.drop_constraint(name, type_="unique")
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
