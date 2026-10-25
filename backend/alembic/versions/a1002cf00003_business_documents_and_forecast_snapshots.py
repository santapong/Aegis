"""Business documents and immutable saved forecasts; additive M3 schema."""

from alembic import op
import sqlalchemy as sa

revision = "a1002cf00003"
down_revision = "a1002cf00002"
branch_labels = None
depends_on = None


def scoped_columns():
    return [
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.String(36),
            sa.ForeignKey("cash_workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
    ]


def upgrade():
    with op.batch_alter_table("cash_workspaces") as batch:
        batch.add_column(
            sa.Column("week_start", sa.Integer(), nullable=False, server_default="0")
        )
    op.create_table(
        "cash_business_documents",
        *scoped_columns(),
        sa.Column(
            "commitment_id",
            sa.String(36),
            sa.ForeignKey("cash_commitments.id"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("counterparty", sa.String(160), nullable=False),
        sa.Column("reference", sa.String(100), nullable=False),
        sa.Column("original_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("cancellation_reason", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("commitment_id"),
    )
    op.create_index(
        "ix_cash_business_documents_workspace_id",
        "cash_business_documents",
        ["workspace_id"],
    )
    op.create_table(
        "cash_document_adjustments",
        *scoped_columns(),
        sa.Column(
            "document_id",
            sa.String(36),
            sa.ForeignKey("cash_business_documents.id"),
            nullable=False,
        ),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("reason", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_cash_document_adjustments_workspace_id",
        "cash_document_adjustments",
        ["workspace_id"],
    )
    op.create_index(
        "ix_cash_document_adjustments_document_id",
        "cash_document_adjustments",
        ["document_id"],
    )
    op.create_table(
        "cash_forecast_snapshots",
        *scoped_columns(),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("as_of", sa.Date(), nullable=False),
        sa.Column("end", sa.Date(), nullable=False),
        sa.Column("base_revision", sa.Integer(), nullable=False),
        sa.Column("engine_version", sa.String(40), nullable=False),
        sa.Column("account_ids", sa.JSON(), nullable=False),
        sa.Column("source_hash", sa.String(64), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_cash_forecast_snapshots_workspace_id",
        "cash_forecast_snapshots",
        ["workspace_id"],
    )


def downgrade():
    bind = op.get_bind()
    for table in (
        "cash_business_documents",
        "cash_document_adjustments",
        "cash_forecast_snapshots",
    ):
        if bind.execute(sa.text(f"SELECT count(*) FROM {table}")).scalar():
            raise RuntimeError(
                "M3 documents/snapshots exist; retain the additive schema on rollback"
            )
    if bind.execute(
        sa.text("SELECT count(*) FROM cash_workspaces WHERE week_start <> 0")
    ).scalar():
        raise RuntimeError(
            "Reviewed week boundaries exist; retain the additive schema on rollback"
        )
    op.drop_table("cash_forecast_snapshots")
    op.drop_table("cash_document_adjustments")
    op.drop_table("cash_business_documents")
    with op.batch_alter_table("cash_workspaces") as batch:
        batch.drop_column("week_start")
