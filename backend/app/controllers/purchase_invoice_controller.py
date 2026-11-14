from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth_middleware import require_roles
from app.models.user import User, UserType
from app.schemas.purchase_invoice import PurchaseInvoiceCreate, PurchaseInvoiceResponse, PurchaseInvoiceUpdate
from app.services.purchase_invoice_service import PurchaseInvoiceService

router = APIRouter(prefix="/api/purchase-invoices", tags=["Purchase Invoices"])
_mgr = require_roles(UserType.stock_manager, UserType.pharmacy_manager, UserType.system_administrator)


@router.post("", response_model=PurchaseInvoiceResponse, status_code=201)
def create(body: PurchaseInvoiceCreate, db: Session = Depends(get_db), current_user: User = Depends(_mgr)):
    return PurchaseInvoiceService(db).create(body, current_user.id)


@router.get("", response_model=list[PurchaseInvoiceResponse])
def list_all(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _: User = Depends(_mgr)):
    return PurchaseInvoiceService(db).list_all(skip, limit)


@router.get("/{inv_id}", response_model=PurchaseInvoiceResponse)
def get_one(inv_id: int, db: Session = Depends(get_db), _: User = Depends(_mgr)):
    return PurchaseInvoiceService(db).get(inv_id)


@router.patch("/{inv_id}", response_model=PurchaseInvoiceResponse)
def update(inv_id: int, body: PurchaseInvoiceUpdate, db: Session = Depends(get_db), _: User = Depends(_mgr)):
    return PurchaseInvoiceService(db).update(inv_id, body)
