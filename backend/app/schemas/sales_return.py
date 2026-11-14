from datetime import date, datetime
from pydantic import BaseModel, Field

from app.models.sales_return import ReturnReason


class SalesReturnItemCreate(BaseModel):
    drug_id: int
    quantity_returned: int = Field(..., gt=0)
    unit_price: float = Field(..., gt=0)
    restock: bool = True


class SalesReturnItemResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    drug_id: int
    quantity_returned: int
    unit_price: float
    line_total: float
    restock: bool


class SalesReturnCreate(BaseModel):
    invoice_id: int | None = None
    customer_id: int | None = None
    return_date: date
    reason: ReturnReason
    notes: str | None = None
    items: list[SalesReturnItemCreate] = Field(..., min_length=1)


class SalesReturnResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    return_number: str
    invoice_id: int | None
    customer_id: int | None
    return_date: date
    reason: ReturnReason
    notes: str | None
    total_refund: float
    processed_by_user_id: int | None
    items: list[SalesReturnItemResponse]
    created_at: datetime
    updated_at: datetime
