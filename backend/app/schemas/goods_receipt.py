from datetime import date, datetime
from pydantic import BaseModel, Field


class GrnItemCreate(BaseModel):
    drug_id: int
    quantity_received: int = Field(..., gt=0)
    unit_cost: float = Field(..., gt=0)
    batch_number: str | None = None
    expiry_date: date | None = None
    is_free_goods: bool = False


class GrnItemResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    drug_id: int
    quantity_received: int
    unit_cost: float
    batch_number: str | None
    expiry_date: date | None
    is_free_goods: bool


class GrnCreate(BaseModel):
    purchase_order_id: int | None = None
    supplier_id: int
    received_date: date
    notes: str | None = None
    items: list[GrnItemCreate] = Field(..., min_length=1)


class GrnResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    grn_number: str
    purchase_order_id: int | None
    supplier_id: int
    received_date: date
    notes: str | None
    received_by_user_id: int | None
    items: list[GrnItemResponse]
    created_at: datetime
    updated_at: datetime
