from datetime import datetime
from pydantic import BaseModel


class UomCreate(BaseModel):
    name: str
    abbreviation: str


class UomUpdate(BaseModel):
    name: str | None = None
    abbreviation: str | None = None
    is_active: bool | None = None


class UomResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    abbreviation: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
