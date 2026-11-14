from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.purchase_invoice import PurchaseInvoice, PurchaseInvoiceStatus
from app.schemas.purchase_invoice import PurchaseInvoiceCreate, PurchaseInvoiceResponse, PurchaseInvoiceUpdate


class PurchaseInvoiceService:
    def __init__(self, db: Session):
        self.db = db

    def _next_number(self) -> str:
        count = self.db.query(PurchaseInvoice).count()
        return f"PINV-{count + 1:05d}"

    def create(self, data: PurchaseInvoiceCreate, user_id: int) -> PurchaseInvoiceResponse:
        inv = PurchaseInvoice(
            invoice_number=self._next_number(),
            created_by_user_id=user_id,
            **data.model_dump(),
        )
        self.db.add(inv)
        self.db.commit()
        self.db.refresh(inv)
        return PurchaseInvoiceResponse.model_validate(inv)

    def list_all(self, skip: int = 0, limit: int = 100) -> list[PurchaseInvoiceResponse]:
        rows = self.db.query(PurchaseInvoice).order_by(PurchaseInvoice.created_at.desc()).offset(skip).limit(limit).all()
        return [PurchaseInvoiceResponse.model_validate(r) for r in rows]

    def get(self, inv_id: int) -> PurchaseInvoiceResponse:
        inv = self.db.get(PurchaseInvoice, inv_id)
        if not inv:
            raise HTTPException(status_code=404, detail="Purchase invoice not found.")
        return PurchaseInvoiceResponse.model_validate(inv)

    def update(self, inv_id: int, data: PurchaseInvoiceUpdate) -> PurchaseInvoiceResponse:
        inv = self.db.get(PurchaseInvoice, inv_id)
        if not inv:
            raise HTTPException(status_code=404, detail="Purchase invoice not found.")
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(inv, field, value)
        remaining = float(inv.total_amount) - float(inv.paid_amount)
        if remaining <= 0:
            inv.status = PurchaseInvoiceStatus.paid
        elif float(inv.paid_amount) > 0:
            inv.status = PurchaseInvoiceStatus.partially_paid
        self.db.commit()
        self.db.refresh(inv)
        return PurchaseInvoiceResponse.model_validate(inv)
