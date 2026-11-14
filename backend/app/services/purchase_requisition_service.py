from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.purchase_requisition import PurchaseRequisition, PurchaseRequisitionItem
from app.schemas.purchase_requisition import RequisitionCreate, RequisitionResponse, RequisitionUpdate


class PurchaseRequisitionService:
    def __init__(self, db: Session):
        self.db = db

    def _next_number(self) -> str:
        count = self.db.query(PurchaseRequisition).count()
        return f"REQ-{count + 1:05d}"

    def create(self, data: RequisitionCreate, user_id: int) -> RequisitionResponse:
        req = PurchaseRequisition(
            req_number=self._next_number(),
            request_date=data.request_date,
            required_by_date=data.required_by_date,
            notes=data.notes,
            requested_by_user_id=user_id,
        )
        self.db.add(req)
        self.db.flush()

        for item_data in data.items:
            item = PurchaseRequisitionItem(
                requisition_id=req.id,
                drug_id=item_data.drug_id,
                quantity_needed=item_data.quantity_needed,
                notes=item_data.notes,
            )
            self.db.add(item)

        self.db.commit()
        self.db.refresh(req)
        return RequisitionResponse.model_validate(req)

    def list_all(self, skip: int = 0, limit: int = 100) -> list[RequisitionResponse]:
        rows = self.db.query(PurchaseRequisition).order_by(PurchaseRequisition.created_at.desc()).offset(skip).limit(limit).all()
        return [RequisitionResponse.model_validate(r) for r in rows]

    def get(self, req_id: int) -> RequisitionResponse:
        req = self.db.get(PurchaseRequisition, req_id)
        if not req:
            raise HTTPException(status_code=404, detail="Requisition not found.")
        return RequisitionResponse.model_validate(req)

    def update(self, req_id: int, data: RequisitionUpdate) -> RequisitionResponse:
        req = self.db.get(PurchaseRequisition, req_id)
        if not req:
            raise HTTPException(status_code=404, detail="Requisition not found.")
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(req, field, value)
        self.db.commit()
        self.db.refresh(req)
        return RequisitionResponse.model_validate(req)
