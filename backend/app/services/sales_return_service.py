from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.sales_return import SalesReturn, SalesReturnItem
from app.models.drug import Drug
from app.models.stock_movement import StockMovement, MovementType, ReferenceType
from app.schemas.sales_return import SalesReturnCreate, SalesReturnResponse


class SalesReturnService:
    def __init__(self, db: Session):
        self.db = db

    def _next_number(self) -> str:
        count = self.db.query(SalesReturn).count()
        return f"RET-{count + 1:05d}"

    def create(self, data: SalesReturnCreate, user_id: int) -> SalesReturnResponse:
        total_refund = sum(
            item.quantity_returned * item.unit_price for item in data.items
        )

        ret = SalesReturn(
            return_number=self._next_number(),
            invoice_id=data.invoice_id,
            customer_id=data.customer_id,
            return_date=data.return_date,
            reason=data.reason,
            notes=data.notes,
            total_refund=total_refund,
            processed_by_user_id=user_id,
        )
        self.db.add(ret)
        self.db.flush()

        for item_data in data.items:
            drug = self.db.get(Drug, item_data.drug_id)
            if not drug:
                raise HTTPException(status_code=404, detail=f"Drug {item_data.drug_id} not found.")

            line_total = item_data.quantity_returned * item_data.unit_price
            item = SalesReturnItem(
                sales_return_id=ret.id,
                drug_id=item_data.drug_id,
                quantity_returned=item_data.quantity_returned,
                unit_price=item_data.unit_price,
                line_total=line_total,
                restock=item_data.restock,
            )
            self.db.add(item)

            if item_data.restock:
                drug.quantity += item_data.quantity_returned
                movement = StockMovement(
                    drug_id=drug.id,
                    movement_type=MovementType.adjustment,
                    quantity=item_data.quantity_returned,
                    reference_type=ReferenceType.manual,
                    reference_id=ret.id,
                    notes=f"Sales return {ret.return_number}",
                    performed_by_user_id=user_id,
                )
                self.db.add(movement)

        self.db.commit()
        self.db.refresh(ret)
        return SalesReturnResponse.model_validate(ret)

    def list_all(self, skip: int = 0, limit: int = 100) -> list[SalesReturnResponse]:
        rows = self.db.query(SalesReturn).order_by(SalesReturn.created_at.desc()).offset(skip).limit(limit).all()
        return [SalesReturnResponse.model_validate(r) for r in rows]

    def get(self, ret_id: int) -> SalesReturnResponse:
        ret = self.db.get(SalesReturn, ret_id)
        if not ret:
            raise HTTPException(status_code=404, detail="Sales return not found.")
        return SalesReturnResponse.model_validate(ret)
