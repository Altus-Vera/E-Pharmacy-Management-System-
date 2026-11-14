from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth_middleware import require_roles
from app.models.user import User, UserType
from app.schemas.sales_return import SalesReturnCreate, SalesReturnResponse
from app.services.sales_return_service import SalesReturnService

router = APIRouter(prefix="/api/sales-returns", tags=["Sales Returns"])
_roles = require_roles(UserType.pharmacist, UserType.stock_manager, UserType.pharmacy_manager, UserType.system_administrator)


@router.post("", response_model=SalesReturnResponse, status_code=201)
def create(body: SalesReturnCreate, db: Session = Depends(get_db), current_user: User = Depends(_roles)):
    return SalesReturnService(db).create(body, current_user.id)


@router.get("", response_model=list[SalesReturnResponse])
def list_all(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _: User = Depends(_roles)):
    return SalesReturnService(db).list_all(skip, limit)


@router.get("/{ret_id}", response_model=SalesReturnResponse)
def get_one(ret_id: int, db: Session = Depends(get_db), _: User = Depends(_roles)):
    return SalesReturnService(db).get(ret_id)
