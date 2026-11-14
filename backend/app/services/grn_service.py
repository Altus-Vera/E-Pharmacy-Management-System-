from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.goods_receipt import GoodsReceipt, GoodsReceiptItem
from app.models.drug import Drug
from app.models.stock_movement import StockMovement, MovementType, ReferenceType
from app.schemas.goods_receipt import GrnCreate, GrnResponse


class GrnService:
    def __init__(self, db: Session):
        self.db = db

    def _next_number(self) -> str:
        count = self.db.query(GoodsReceipt).count()
        return f"GRN-{count + 1:05d}"

    def create_grn(self, data: GrnCreate, user_id: int) -> GrnResponse:
        grn = GoodsReceipt(
            grn_number=self._next_number(),
            purchase_order_id=data.purchase_order_id,
            supplier_id=data.supplier_id,
            received_date=data.received_date,
            notes=data.notes,
            received_by_user_id=user_id,
        )
        self.db.add(grn)
        self.db.flush()

        for item_data in data.items:
            drug = self.db.get(Drug, item_data.drug_id)
            if not drug:
                raise HTTPException(status_code=404, detail=f"Drug {item_data.drug_id} not found.")

            item = GoodsReceiptItem(
                goods_receipt_id=grn.id,
                drug_id=item_data.drug_id,
                quantity_received=item_data.quantity_received,
                unit_cost=item_data.unit_cost,
                batch_number=item_data.batch_number,
                expiry_date=item_data.expiry_date,
                is_free_goods=item_data.is_free_goods,
            )
            self.db.add(item)

            drug.quantity += item_data.quantity_received
            if item_data.batch_number:
                drug.batch_number = item_data.batch_number
            if item_data.expiry_date:
                drug.expiry_date = item_data.expiry_date

            movement = StockMovement(
                drug_id=drug.id,
                movement_type=MovementType.purchase,
                quantity=item_data.quantity_received,
                unit_cost=item_data.unit_cost,
                reference_type=ReferenceType.goods_receipt,
                reference_id=grn.id,
                performed_by_user_id=user_id,
            )
            self.db.add(movement)

        self.db.commit()
        self.db.refresh(grn)
        return GrnResponse.model_validate(grn)

    def list_grns(self, skip: int = 0, limit: int = 100) -> list[GrnResponse]:
        rows = self.db.query(GoodsReceipt).order_by(GoodsReceipt.created_at.desc()).offset(skip).limit(limit).all()
        return [GrnResponse.model_validate(r) for r in rows]

    def get_grn(self, grn_id: int) -> GrnResponse:
        grn = self.db.get(GoodsReceipt, grn_id)
        if not grn:
            raise HTTPException(status_code=404, detail="GRN not found.")
        return GrnResponse.model_validate(grn)
