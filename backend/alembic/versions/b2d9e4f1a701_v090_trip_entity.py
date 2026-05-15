"""v0.9.0 add trips table and trip_id columns on budgets/transactions

Revision ID: b2d9e4f1a701
Revises: a1c8f3b4e501
Create Date: 2026-05-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2d9e4f1a701"
down_revision: Union[str, Sequence[str], None] = "a1c8f3b4e501"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "trips",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("destination", sa.String(length=255), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("total_budget", sa.Numeric(12, 2), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "planned",
                "active",
                "completed",
                name="tripstatus",
                native_enum=False,
                length=16,
            ),
            nullable=False,
            server_default="planned",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("trips", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_trips_user_id"), ["user_id"], unique=False)
        batch_op.create_index("ix_trips_user_status", ["user_id", "status"], unique=False)

    with op.batch_alter_table("budgets", schema=None) as batch_op:
        batch_op.add_column(sa.Column("trip_id", sa.String(length=36), nullable=True))
        batch_op.create_foreign_key(
            "fk_budgets_trip_id_trips",
            "trips",
            ["trip_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index(batch_op.f("ix_budgets_trip_id"), ["trip_id"], unique=False)

    with op.batch_alter_table("transactions", schema=None) as batch_op:
        batch_op.add_column(sa.Column("trip_id", sa.String(length=36), nullable=True))
        batch_op.create_foreign_key(
            "fk_transactions_trip_id_trips",
            "trips",
            ["trip_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index(batch_op.f("ix_transactions_trip_id"), ["trip_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("transactions", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_transactions_trip_id"))
        batch_op.drop_constraint("fk_transactions_trip_id_trips", type_="foreignkey")
        batch_op.drop_column("trip_id")

    with op.batch_alter_table("budgets", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_budgets_trip_id"))
        batch_op.drop_constraint("fk_budgets_trip_id_trips", type_="foreignkey")
        batch_op.drop_column("trip_id")

    with op.batch_alter_table("trips", schema=None) as batch_op:
        batch_op.drop_index("ix_trips_user_status")
        batch_op.drop_index(batch_op.f("ix_trips_user_id"))
    op.drop_table("trips")
