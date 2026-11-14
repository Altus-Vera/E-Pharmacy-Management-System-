"""add outlets and stock_transfers tables

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "outlets",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(150), nullable=False, unique=True),
        sa.Column("code", sa.String(20), nullable=False, unique=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("contact_number", sa.String(20), nullable=True),
        sa.Column("manager_name", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_head_office", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_outlets_code", "outlets", ["code"])

    op.execute("CREATE TYPE transferstatus AS ENUM ('pending','approved','in_transit','received','cancelled')")

    op.create_table(
        "stock_transfers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("transfer_number", sa.String(20), nullable=False, unique=True),
        sa.Column("from_outlet_id", sa.Integer(), sa.ForeignKey("outlets.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("to_outlet_id", sa.Integer(), sa.ForeignKey("outlets.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("drug_id", sa.Integer(), sa.ForeignKey("drugs.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", postgresql.ENUM("pending", "approved", "in_transit", "received", "cancelled", name="transferstatus", create_type=False), nullable=False, server_default="pending"),
        sa.Column("requested_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_stock_transfers_transfer_number", "stock_transfers", ["transfer_number"])


def downgrade() -> None:
    op.drop_index("ix_stock_transfers_transfer_number", "stock_transfers")
    op.drop_table("stock_transfers")
    op.execute("DROP TYPE IF EXISTS transferstatus")
    op.drop_index("ix_outlets_code", "outlets")
    op.drop_table("outlets")
