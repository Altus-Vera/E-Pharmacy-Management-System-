from datetime import date, datetime
from pydantic import BaseModel, Field

from app.models.purchase_requisition import RequisitionStatus


class RequisitionItemCreate(BaseModel):
    drug_id: int
    quantity_needed: int = Field(..., gt=0)
    notes: str | None = None


class RequisitionItemResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    drug_id: int
    quantity_needed: int
    notes: str | None


class RequisitionCreate(BaseModel):
    request_date: date
    required_by_date: date | None = None
    notes: str | None = None
    items: list[RequisitionItemCreate] = Field(..., min_length=1)


class RequisitionUpdate(BaseModel):
    status: RequisitionStatus | None = None
    notes: str | None = None
    purchase_order_id: int | None = None
    approved_by_user_id: int | None = None


class RequisitionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    req_number: str
    request_date: date
    required_by_date: date | None
    status: RequisitionStatus
    notes: str | None
    requested_by_user_id: int | None
    approved_by_user_id: int | None
    purchase_order_id: int | None
    items: list[RequisitionItemResponse]
    created_at: datetime
    updated_at: datetime
