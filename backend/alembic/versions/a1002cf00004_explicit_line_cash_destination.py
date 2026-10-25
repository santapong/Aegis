"""Explicit workspace/account destinations; legacy links remain unassigned."""

import sqlalchemy as sa
from alembic import op

revision = "a1002cf00004"
down_revision = "a1002cf00003"
branch_labels = None
depends_on = None


def upgrade():
    for table in ("line_finance_codes", "line_finance_identities"):
        with op.batch_alter_table(table) as batch:
            batch.add_column(sa.Column("workspace_id", sa.String(36), nullable=True))
            batch.add_column(sa.Column("account_id", sa.String(36), nullable=True))
            batch.create_foreign_key(
                f"fk_{table}_cash_workspace",
                "cash_workspaces",
                ["workspace_id"],
                ["id"],
                ondelete="SET NULL",
            )
            batch.create_foreign_key(
                f"fk_{table}_cash_account",
                "cash_accounts",
                ["account_id"],
                ["id"],
                ondelete="SET NULL",
            )
    with op.batch_alter_table("line_finance_identities") as batch:
        batch.add_column(sa.Column("connection_id", sa.String(36), nullable=True))


def downgrade():
    bind = op.get_bind()
    for table in ("line_finance_codes", "line_finance_identities"):
        if bind.execute(
            sa.text(
                f"SELECT count(*) FROM {table} WHERE workspace_id IS NOT NULL OR account_id IS NOT NULL"
            )
        ).scalar():
            raise RuntimeError(
                "Reviewed LINE cash destinations exist; keep additive schema on rollback"
            )
    # Confirmed draft history also retains the explicit destination after unlink.
    for payload in bind.execute(
        sa.text("SELECT data FROM line_finance_drafts")
    ).scalars():
        import json

        data = json.loads(payload) if isinstance(payload, str) else payload
        if data and data.get("workspace_id"):
            raise RuntimeError(
                "Workspace LINE draft/history exists; keep additive schema on rollback"
            )
    for table in ("line_finance_codes", "line_finance_identities"):
        with op.batch_alter_table(table) as batch:
            batch.drop_constraint(f"fk_{table}_cash_account", type_="foreignkey")
            batch.drop_constraint(f"fk_{table}_cash_workspace", type_="foreignkey")
            batch.drop_column("account_id")
            batch.drop_column("workspace_id")
            if table == "line_finance_identities":
                batch.drop_column("connection_id")
