from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth_middleware import require_roles
from app.models.user import User, UserType
from app.schemas.purchase_requisition import RequisitionCreate, RequisitionResponse, RequisitionUpdate
from app.services.purchase_requisition_service import PurchaseRequisitionService

router = APIRouter(prefix="/api/purchase-requisitions", tags=["Purchase Requisitions"])
_mgr = require_roles(UserType.pharmacist, UserType.stock_manager, UserType.pharmacy_manager, UserType.system_administrator)


@router.post("", response_model=RequisitionResponse, status_code=201)
def create(body: RequisitionCreate, db: Session = Depends(get_db), current_user: User = Depends(_mgr)):
    return PurchaseRequisitionService(db).create(body, current_user.id)


@router.get("", response_model=list[RequisitionResponse])
def list_all(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _: User = Depends(_mgr)):
    return PurchaseRequisitionService(db).list_all(skip, limit)


@router.get("/{req_id}", response_model=RequisitionResponse)
def get_one(req_id: int, db: Session = Depends(get_db), _: User = Depends(_mgr)):
    return PurchaseRequisitionService(db).get(req_id)


@router.patch("/{req_id}", response_model=RequisitionResponse)
def update(req_id: int, body: RequisitionUpdate, db: Session = Depends(get_db), _: User = Depends(_mgr)):
    return PurchaseRequisitionService(db).update(req_id, body)
