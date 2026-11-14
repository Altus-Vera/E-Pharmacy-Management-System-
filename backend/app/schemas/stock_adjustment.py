from datetime import datetime
from pydantic import BaseModel

from app.models.stock_movement import MovementType


class StockAdjustmentCreate(BaseModel):
    drug_id: int
    quantity_change: int
    notes: str | None = None


class StockMovementResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    drug_id: int
    movement_type: MovementType
    quantity: int
    unit_cost: float | None
    notes: str | None
    performed_by_user_id: int | None
    created_at: datetime


class StockViewItem(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    item_code: str
    brand_name: str
    generic_name: str
    dosage_form: str
    strength: str | None
    quantity: int
    reorder_level: int
    low_stock_threshold: int
    unit_price: float
    expiry_date: str | None
    batch_number: str | None
    supplier_id: int | None
    is_active: bool
