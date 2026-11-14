from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.drug import Drug
from app.models.stock_movement import StockMovement, MovementType, ReferenceType
from app.schemas.stock_adjustment import StockAdjustmentCreate, StockMovementResponse, StockViewItem


class StockAdjustmentService:
    def __init__(self, db: Session):
        self.db = db

    def adjust(self, data: StockAdjustmentCreate, user_id: int) -> StockMovementResponse:
        drug = self.db.get(Drug, data.drug_id)
        if not drug:
            raise HTTPException(status_code=404, detail="Drug not found.")

        new_qty = drug.quantity + data.quantity_change
        if new_qty < 0:
            raise HTTPException(status_code=400, detail="Adjustment would result in negative stock.")

        drug.quantity = new_qty
        movement = StockMovement(
            drug_id=drug.id,
            movement_type=MovementType.adjustment,
            quantity=data.quantity_change,
            reference_type=ReferenceType.manual,
            notes=data.notes,
            performed_by_user_id=user_id,
        )
        self.db.add(movement)
        self.db.commit()
        self.db.refresh(movement)
        return StockMovementResponse.model_validate(movement)

    def get_stock_view(self, skip: int = 0, limit: int = 200) -> list[StockViewItem]:
        drugs = self.db.query(Drug).filter(Drug.is_active == True).order_by(Drug.brand_name).offset(skip).limit(limit).all()
        result = []
        for d in drugs:
            result.append(StockViewItem(
                id=d.id,
                item_code=d.item_code,
                brand_name=d.brand_name,
                generic_name=d.generic_name,
                dosage_form=d.dosage_form.value,
                strength=d.strength,
                quantity=d.quantity,
                reorder_level=d.reorder_level,
                low_stock_threshold=d.low_stock_threshold,
                unit_price=float(d.unit_price),
                expiry_date=d.expiry_date.isoformat() if d.expiry_date else None,
                batch_number=d.batch_number,
                supplier_id=d.supplier_id,
                is_active=d.is_active,
            ))
        return result

    def get_movements(self, drug_id: int, limit: int = 50) -> list[StockMovementResponse]:
        rows = (
            self.db.query(StockMovement)
            .filter(StockMovement.drug_id == drug_id)
            .order_by(StockMovement.created_at.desc())
            .limit(limit)
            .all()
        )
        return [StockMovementResponse.model_validate(r) for r in rows]
