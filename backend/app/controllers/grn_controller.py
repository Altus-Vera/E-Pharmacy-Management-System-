from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth_middleware import require_roles
from app.models.user import User, UserType
from app.schemas.goods_receipt import GrnCreate, GrnResponse
from app.services.grn_service import GrnService

router = APIRouter(prefix="/api/grn", tags=["Goods Receipt Notes"])
_mgr = require_roles(UserType.stock_manager, UserType.pharmacy_manager, UserType.system_administrator)


@router.post("", response_model=GrnResponse, status_code=201)
def create_grn(body: GrnCreate, db: Session = Depends(get_db), current_user: User = Depends(_mgr)):
    return GrnService(db).create_grn(body, current_user.id)


@router.get("", response_model=list[GrnResponse])
def list_grns(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _: User = Depends(_mgr)):
    return GrnService(db).list_grns(skip, limit)


@router.get("/{grn_id}", response_model=GrnResponse)
def get_grn(grn_id: int, db: Session = Depends(get_db), _: User = Depends(_mgr)):
    return GrnService(db).get_grn(grn_id)
