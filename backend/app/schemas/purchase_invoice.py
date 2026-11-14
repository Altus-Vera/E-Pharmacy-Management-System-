from datetime import date, datetime
from pydantic import BaseModel

from app.models.purchase_invoice import PurchaseInvoiceStatus


class PurchaseInvoiceCreate(BaseModel):
    supplier_id: int
    purchase_order_id: int | None = None
    grn_id: int | None = None
    invoice_date: date
    due_date: date | None = None
    subtotal: float
    tax_amount: float = 0.0
    discount_amount: float = 0.0
    total_amount: float
    notes: str | None = None


class PurchaseInvoiceUpdate(BaseModel):
    due_date: date | None = None
    paid_amount: float | None = None
    status: PurchaseInvoiceStatus | None = None
    notes: str | None = None


class PurchaseInvoiceResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    invoice_number: str
    supplier_id: int
    purchase_order_id: int | None
    grn_id: int | None
    invoice_date: date
    due_date: date | None
    subtotal: float
    tax_amount: float
    discount_amount: float
    total_amount: float
    paid_amount: float
    status: PurchaseInvoiceStatus
    notes: str | None
    created_by_user_id: int | None
    created_at: datetime
    updated_at: datetime
