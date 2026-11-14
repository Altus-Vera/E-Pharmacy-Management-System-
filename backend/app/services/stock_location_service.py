from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.stock_location import StockLocation
from app.schemas.stock_location import StockLocationCreate, StockLocationResponse, StockLocationUpdate


class StockLocationService:
    def __init__(self, db: Session):
        self.db = db

    def create(self, data: StockLocationCreate) -> StockLocationResponse:
        existing = self.db.query(StockLocation).filter(StockLocation.name == data.name).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Location name already exists.")
        loc = StockLocation(**data.model_dump())
        self.db.add(loc)
        self.db.commit()
        self.db.refresh(loc)
        return StockLocationResponse.model_validate(loc)

    def list_all(self) -> list[StockLocationResponse]:
        rows = self.db.query(StockLocation).order_by(StockLocation.name).all()
        return [StockLocationResponse.model_validate(r) for r in rows]

    def get(self, loc_id: int) -> StockLocationResponse:
        loc = self.db.get(StockLocation, loc_id)
        if not loc:
            raise HTTPException(status_code=404, detail="Stock location not found.")
        return StockLocationResponse.model_validate(loc)

    def update(self, loc_id: int, data: StockLocationUpdate) -> StockLocationResponse:
        loc = self.db.get(StockLocation, loc_id)
        if not loc:
            raise HTTPException(status_code=404, detail="Stock location not found.")
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(loc, field, value)
        self.db.commit()
        self.db.refresh(loc)
        return StockLocationResponse.model_validate(loc)
