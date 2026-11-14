from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.unit_of_measure import UnitOfMeasure
from app.schemas.unit_of_measure import UomCreate, UomResponse, UomUpdate


class UomService:
    def __init__(self, db: Session):
        self.db = db

    def create(self, data: UomCreate) -> UomResponse:
        existing = self.db.query(UnitOfMeasure).filter(UnitOfMeasure.name == data.name).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="UoM name already exists.")
        uom = UnitOfMeasure(**data.model_dump())
        self.db.add(uom)
        self.db.commit()
        self.db.refresh(uom)
        return UomResponse.model_validate(uom)

    def list_all(self) -> list[UomResponse]:
        rows = self.db.query(UnitOfMeasure).order_by(UnitOfMeasure.name).all()
        return [UomResponse.model_validate(r) for r in rows]

    def get(self, uom_id: int) -> UomResponse:
        uom = self.db.get(UnitOfMeasure, uom_id)
        if not uom:
            raise HTTPException(status_code=404, detail="Unit of measure not found.")
        return UomResponse.model_validate(uom)

    def update(self, uom_id: int, data: UomUpdate) -> UomResponse:
        uom = self.db.get(UnitOfMeasure, uom_id)
        if not uom:
            raise HTTPException(status_code=404, detail="Unit of measure not found.")
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(uom, field, value)
        self.db.commit()
        self.db.refresh(uom)
        return UomResponse.model_validate(uom)
