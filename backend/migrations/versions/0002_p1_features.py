"""p1 features: stock locations, uom, purchase requisitions, purchase invoices, sales returns

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-02
"""

from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stock_locations",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "units_of_measure",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("abbreviation", sa.String(20), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "purchase_requisitions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("req_number", sa.String(50), nullable=False, unique=True, index=True),
        sa.Column("request_date", sa.Date, nullable=False),
        sa.Column("required_by_date", sa.Date, nullable=True),
        sa.Column(
            "status",
            sa.Enum("draft", "submitted", "approved", "rejected", "ordered", name="requisitionstatus"),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("requested_by_user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_by_user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("purchase_order_id", sa.Integer, sa.ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "purchase_requisition_items",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("requisition_id", sa.Integer, sa.ForeignKey("purchase_requisitions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("drug_id", sa.Integer, sa.ForeignKey("drugs.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("quantity_needed", sa.Integer, nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
    )

    op.create_table(
        "purchase_invoices",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("invoice_number", sa.String(50), nullable=False, unique=True, index=True),
        sa.Column("supplier_id", sa.Integer, sa.ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("purchase_order_id", sa.Integer, sa.ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("grn_id", sa.Integer, sa.ForeignKey("goods_receipts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("invoice_date", sa.Date, nullable=False),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column("subtotal", sa.Numeric(12, 2), nullable=False),
        sa.Column("tax_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("discount_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("paid_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column(
            "status",
            sa.Enum("unpaid", "partially_paid", "paid", "overdue", name="purchaseinvoicestatus"),
            nullable=False,
            server_default="unpaid",
        ),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_by_user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "sales_returns",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("return_number", sa.String(50), nullable=False, unique=True, index=True),
        sa.Column("invoice_id", sa.Integer, sa.ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True),
        sa.Column("customer_id", sa.Integer, sa.ForeignKey("customers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("return_date", sa.Date, nullable=False),
        sa.Column(
            "reason",
            sa.Enum("wrong_item", "damaged", "expired", "patient_refused", "other", name="returnreason"),
            nullable=False,
            server_default="other",
        ),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("total_refund", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("processed_by_user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "sales_return_items",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("sales_return_id", sa.Integer, sa.ForeignKey("sales_returns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("drug_id", sa.Integer, sa.ForeignKey("drugs.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("quantity_returned", sa.Integer, nullable=False),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("line_total", sa.Numeric(12, 2), nullable=False),
        sa.Column("restock", sa.Boolean, nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_table("sales_return_items")
    op.drop_table("sales_returns")
    op.drop_table("purchase_invoices")
    op.drop_table("purchase_requisition_items")
    op.drop_table("purchase_requisitions")
    op.drop_table("units_of_measure")
    op.drop_table("stock_locations")
    op.execute("DROP TYPE IF EXISTS requisitionstatus")
    op.execute("DROP TYPE IF EXISTS purchaseinvoicestatus")
    op.execute("DROP TYPE IF EXISTS returnreason")
