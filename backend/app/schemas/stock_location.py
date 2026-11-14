from datetime import datetime
from pydantic import BaseModel


class StockLocationCreate(BaseModel):
    name: str
    description: str | None = None


class StockLocationUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None


class StockLocationResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
