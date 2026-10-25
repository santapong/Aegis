"""owner scoped dated cash planning

Revision ID: a1002cf00001
Revises: a0923f1a0001
Create Date: 2026-10-02 01:12:01.089368

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1002cf00001"
down_revision: Union[str, Sequence[str], None] = "a0923f1a0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.create_table(
        "cash_workspaces",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("buffer", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("legacy_exclusion_hash", sa.String(length=64), nullable=True),
        sa.Column("create_key", sa.String(length=64), nullable=False),
        sa.Column("create_hash", sa.String(length=64), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "create_key"),
    )

    with op.batch_alter_table("cash_workspaces", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_cash_workspaces_user_id"), ["user_id"], unique=False
        )

    op.create_table(
        "cash_accounts",
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("archived", sa.Boolean(), nullable=False),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["cash_workspaces.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("cash_accounts", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_cash_accounts_workspace_id"), ["workspace_id"], unique=False
        )

    op.create_table(
        "cash_audit",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("operation", sa.String(length=40), nullable=False),
        sa.Column("request_key", sa.String(length=64), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["cash_workspaces.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("workspace_id", "request_key"),
    )

    with op.batch_alter_table("cash_audit", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_cash_audit_workspace_id"), ["workspace_id"], unique=False
        )

    op.create_table(
        "cash_scenarios",
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("base_revision", sa.Integer(), nullable=False),
        sa.Column("changes", sa.JSON(), nullable=False),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["cash_workspaces.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("cash_scenarios", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_cash_scenarios_workspace_id"), ["workspace_id"], unique=False
        )

    op.create_table(
        "cash_balance_anchors",
        sa.Column("account_id", sa.String(length=36), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("source", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["cash_accounts.id"],
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["cash_workspaces.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("account_id", "date"),
    )

    with op.batch_alter_table("cash_balance_anchors", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_cash_balance_anchors_workspace_id"),
            ["workspace_id"],
            unique=False,
        )

    op.create_table(
        "cash_commitments",
        sa.Column("account_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("direction", sa.String(length=16), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("recurrence", sa.String(length=16), nullable=False),
        sa.Column("weekend_rule", sa.String(length=16), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("cancelled", sa.Boolean(), nullable=False),
        sa.Column("source_key", sa.String(length=80), nullable=True),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["cash_accounts.id"],
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["cash_workspaces.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("workspace_id", "source_key"),
    )

    with op.batch_alter_table("cash_commitments", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_cash_commitments_workspace_id"),
            ["workspace_id"],
            unique=False,
        )

    op.create_table(
        "cash_transfers",
        sa.Column("from_account_id", sa.String(length=36), nullable=False),
        sa.Column("to_account_id", sa.String(length=36), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(
            ["from_account_id"],
            ["cash_accounts.id"],
        ),
        sa.ForeignKeyConstraint(
            ["to_account_id"],
            ["cash_accounts.id"],
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["cash_workspaces.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("cash_transfers", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_cash_transfers_workspace_id"), ["workspace_id"], unique=False
        )

    op.create_table(
        "cash_occurrences",
        sa.Column("commitment_id", sa.String(length=36), nullable=False),
        sa.Column("account_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("direction", sa.String(length=16), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("nominal_date", sa.Date(), nullable=False),
        sa.Column("expected_date", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("cancelled", sa.Boolean(), nullable=False),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["cash_accounts.id"],
        ),
        sa.ForeignKeyConstraint(
            ["commitment_id"],
            ["cash_commitments.id"],
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["cash_workspaces.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("commitment_id", "nominal_date"),
    )

    with op.batch_alter_table("cash_occurrences", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_cash_occurrences_workspace_id"),
            ["workspace_id"],
            unique=False,
        )

    op.create_table(
        "cash_settlements",
        sa.Column("transaction_id", sa.String(length=36), nullable=False),
        sa.Column("occurrence_id", sa.String(length=36), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("reversed", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(
            ["occurrence_id"],
            ["cash_occurrences.id"],
        ),
        sa.ForeignKeyConstraint(
            ["transaction_id"],
            ["transactions.id"],
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["cash_workspaces.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("cash_settlements", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_cash_settlements_workspace_id"),
            ["workspace_id"],
            unique=False,
        )

    with op.batch_alter_table("transactions") as batch_op:
        batch_op.add_column(
            sa.Column("workspace_id", sa.String(length=36), nullable=True)
        )
        batch_op.add_column(
            sa.Column("account_id", sa.String(length=36), nullable=True)
        )
        batch_op.add_column(
            sa.Column("cash_reversal_of_id", sa.String(length=36), nullable=True)
        )
        batch_op.add_column(sa.Column("currency", sa.String(length=3), nullable=True))
        batch_op.create_index(
            batch_op.f("ix_transactions_account_id"), ["account_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_transactions_workspace_id"), ["workspace_id"], unique=False
        )
        batch_op.create_unique_constraint(
            "uq_transactions_cash_reversal_of_id", ["cash_reversal_of_id"]
        )
        batch_op.create_foreign_key(
            "fk_transactions_cash_transactions",
            "transactions",
            ["cash_reversal_of_id"],
            ["id"],
        )
        batch_op.create_foreign_key(
            "fk_transactions_cash_cash_accounts",
            "cash_accounts",
            ["account_id"],
            ["id"],
        )
        batch_op.create_foreign_key(
            "fk_transactions_cash_cash_workspaces",
            "cash_workspaces",
            ["workspace_id"],
            ["id"],
        )


def downgrade():
    # Never treat dropping financial history as ordinary release rollback.
    if op.get_bind().execute(sa.text("SELECT count(*) FROM cash_workspaces")).scalar():
        raise RuntimeError(
            "Cash workspaces exist; retain the additive schema on rollback"
        )
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.drop_constraint(
            "fk_transactions_cash_transactions", type_="foreignkey"
        )
        batch_op.drop_constraint(
            "fk_transactions_cash_cash_accounts", type_="foreignkey"
        )
        batch_op.drop_constraint(
            "fk_transactions_cash_cash_workspaces", type_="foreignkey"
        )
        batch_op.drop_constraint("uq_transactions_cash_reversal_of_id", type_="unique")
        batch_op.drop_index("ix_transactions_account_id")
        batch_op.drop_index("ix_transactions_workspace_id")
        for name in ["currency", "cash_reversal_of_id", "account_id", "workspace_id"]:
            batch_op.drop_column(name)
    for name in [
        "cash_settlements",
        "cash_occurrences",
        "cash_transfers",
        "cash_commitments",
        "cash_balance_anchors",
        "cash_scenarios",
        "cash_audit",
        "cash_accounts",
        "cash_workspaces",
    ]:
        op.drop_table(name)
