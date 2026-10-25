"""everyday cash import schedules goals and alerts

Revision ID: a1002cf00002
Revises: a1002cf00001
Create Date: 2026-10-02 11:04:48.885543

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1002cf00002"
down_revision: Union[str, Sequence[str], None] = "a1002cf00001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NAMING = {"uq": "uq_%(table_name)s_%(column_0_name)s_%(column_1_name)s"}
M2_TABLES = [
    "cash_import_rows",
    "cash_import_batches",
    "cash_goal_allocations",
    "cash_installment_schedules",
    "cash_alerts",
    "cash_alert_scopes",
]


def old_unique(table, columns):
    for constraint in sa.inspect(op.get_bind()).get_unique_constraints(table):
        if constraint["column_names"] == columns:
            return constraint["name"] or f"uq_{table}_{columns[0]}_{columns[1]}"
    raise RuntimeError(
        f"Expected unique constraint missing on {table}; review the installation schema"
    )


def downgrade_guard():
    bind = op.get_bind()
    for table in M2_TABLES:
        if bind.execute(sa.text(f"SELECT count(*) FROM {table}")).scalar():
            raise RuntimeError(
                "M2 review/history exists; retain the additive schema on rollback"
            )
    if bind.execute(
        sa.text(
            "SELECT count(*) FROM cash_commitments WHERE interval_every <> 1 OR recurrence_days IS NOT NULL OR generated_through IS NOT NULL OR recurrence NOT IN ('once','weekly','monthly')"
        )
    ).scalar():
        raise RuntimeError("M2 schedules exist; retain the additive schema on rollback")
    if bind.execute(
        sa.text("SELECT count(*) FROM cash_occurrences WHERE schedule_slot <> 0")
    ).scalar():
        raise RuntimeError(
            "M2 split identities exist; retain the additive schema on rollback"
        )


def upgrade() -> None:
    """Upgrade only M2 tables/columns; retain all legacy indexes and types."""
    if (
        op.get_bind()
        .execute(
            sa.text(
                "SELECT source_key FROM cash_commitments WHERE source_key IS NOT NULL GROUP BY source_key HAVING count(*) > 1"
            )
        )
        .first()
    ):
        raise RuntimeError(
            "A source is linked in multiple workspaces; review those links before upgrading"
        )
    op.create_table(
        "cash_alert_scopes",
        sa.Column("scope_key", sa.String(length=64), nullable=False),
        sa.Column("as_of", sa.Date(), nullable=False),
        sa.Column("end", sa.Date(), nullable=False),
        sa.Column("account_ids", sa.JSON(), nullable=False),
        sa.Column("input_hash", sa.String(length=64), nullable=False),
        sa.Column("base_revision", sa.Integer(), nullable=False),
        sa.Column("evaluated_at", sa.DateTime(), nullable=False),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["cash_workspaces.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("workspace_id", "scope_key"),
    )
    with op.batch_alter_table("cash_alert_scopes", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_cash_alert_scopes_workspace_id"),
            ["workspace_id"],
            unique=False,
        )

    op.create_table(
        "cash_alerts",
        sa.Column("scope_id", sa.String(length=36), nullable=False),
        sa.Column("dedupe_key", sa.String(length=64), nullable=False),
        sa.Column("kind", sa.String(length=24), nullable=False),
        sa.Column("event_date", sa.Date(), nullable=True),
        sa.Column("base_revision", sa.Integer(), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("acknowledged", sa.Boolean(), nullable=False),
        sa.Column("detected_at", sa.DateTime(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(
            ["scope_id"],
            ["cash_alert_scopes.id"],
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["cash_workspaces.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("workspace_id", "dedupe_key"),
    )
    with op.batch_alter_table("cash_alerts", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_cash_alerts_scope_id"), ["scope_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_cash_alerts_workspace_id"), ["workspace_id"], unique=False
        )

    op.create_table(
        "cash_import_batches",
        sa.Column("account_id", sa.String(length=36), nullable=False),
        sa.Column("filename", sa.String(length=160), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
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
    )
    with op.batch_alter_table("cash_import_batches", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_cash_import_batches_workspace_id"),
            ["workspace_id"],
            unique=False,
        )

    op.create_table(
        "cash_goal_allocations",
        sa.Column("account_id", sa.String(length=36), nullable=False),
        sa.Column("goal_id", sa.String(length=36), nullable=True),
        sa.Column("transfer_id", sa.String(length=36), nullable=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("mode", sa.String(length=16), nullable=False),
        sa.Column("released", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["cash_accounts.id"],
        ),
        sa.ForeignKeyConstraint(["goal_id"], ["savings_goals.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["transfer_id"],
            ["cash_transfers.id"],
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["cash_workspaces.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("transfer_id"),
    )
    with op.batch_alter_table("cash_goal_allocations", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_cash_goal_allocations_workspace_id"),
            ["workspace_id"],
            unique=False,
        )

    op.create_table(
        "cash_import_rows",
        sa.Column("batch_id", sa.String(length=36), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("raw", sa.JSON(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("errors", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("transaction_id", sa.String(length=36), nullable=True),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(
            ["batch_id"],
            ["cash_import_batches.id"],
        ),
        sa.ForeignKeyConstraint(
            ["transaction_id"],
            ["transactions.id"],
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["cash_workspaces.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("batch_id", "row_number"),
        sa.UniqueConstraint("transaction_id"),
    )
    with op.batch_alter_table("cash_import_rows", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_cash_import_rows_batch_id"), ["batch_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_cash_import_rows_workspace_id"),
            ["workspace_id"],
            unique=False,
        )

    op.create_table(
        "cash_installment_schedules",
        sa.Column("commitment_id", sa.String(length=36), nullable=False),
        sa.Column("debt_id", sa.String(length=36), nullable=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(
            ["commitment_id"],
            ["cash_commitments.id"],
        ),
        sa.ForeignKeyConstraint(["debt_id"], ["debts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["cash_workspaces.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("commitment_id"),
    )
    with op.batch_alter_table("cash_installment_schedules", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_cash_installment_schedules_workspace_id"),
            ["workspace_id"],
            unique=False,
        )

    with op.batch_alter_table("cash_commitments", naming_convention=NAMING) as batch_op:
        batch_op.add_column(
            sa.Column(
                "interval_every", sa.Integer(), server_default="1", nullable=False
            )
        )
        batch_op.add_column(sa.Column("recurrence_days", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("generated_through", sa.Date(), nullable=True))
        batch_op.drop_constraint(
            old_unique("cash_commitments", ["workspace_id", "source_key"]),
            type_="unique",
        )
        batch_op.create_unique_constraint("uq_cash_commitment_source", ["source_key"])

    with op.batch_alter_table("cash_occurrences", naming_convention=NAMING) as batch_op:
        batch_op.add_column(
            sa.Column("schedule_slot", sa.Integer(), server_default="0", nullable=False)
        )
        batch_op.drop_constraint(
            old_unique("cash_occurrences", ["commitment_id", "nominal_date"]),
            type_="unique",
        )
        batch_op.create_unique_constraint(
            "uq_cash_occurrence_slot",
            ["commitment_id", "nominal_date", "schedule_slot"],
        )


def downgrade() -> None:
    """Only an unused M2 schema may be downgraded."""
    downgrade_guard()

    with op.batch_alter_table("cash_occurrences", naming_convention=NAMING) as batch_op:
        batch_op.drop_constraint("uq_cash_occurrence_slot", type_="unique")
        batch_op.create_unique_constraint(
            "uq_cash_occurrences_commitment_id_nominal_date",
            ["commitment_id", "nominal_date"],
        )
        batch_op.drop_column("schedule_slot")

    with op.batch_alter_table("cash_commitments", naming_convention=NAMING) as batch_op:
        batch_op.drop_constraint("uq_cash_commitment_source", type_="unique")
        batch_op.create_unique_constraint(
            "uq_cash_commitments_workspace_id_source_key",
            ["workspace_id", "source_key"],
        )
        batch_op.drop_column("generated_through")
        batch_op.drop_column("recurrence_days")
        batch_op.drop_column("interval_every")

    with op.batch_alter_table("cash_installment_schedules", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_cash_installment_schedules_workspace_id"))

    op.drop_table("cash_installment_schedules")
    with op.batch_alter_table("cash_import_rows", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_cash_import_rows_workspace_id"))
        batch_op.drop_index(batch_op.f("ix_cash_import_rows_batch_id"))

    op.drop_table("cash_import_rows")
    with op.batch_alter_table("cash_goal_allocations", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_cash_goal_allocations_workspace_id"))

    op.drop_table("cash_goal_allocations")
    with op.batch_alter_table("cash_import_batches", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_cash_import_batches_workspace_id"))

    op.drop_table("cash_import_batches")
    with op.batch_alter_table("cash_alerts", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_cash_alerts_workspace_id"))
        batch_op.drop_index(batch_op.f("ix_cash_alerts_scope_id"))

    op.drop_table("cash_alerts")
    with op.batch_alter_table("cash_alert_scopes", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_cash_alert_scopes_workspace_id"))

    op.drop_table("cash_alert_scopes")
