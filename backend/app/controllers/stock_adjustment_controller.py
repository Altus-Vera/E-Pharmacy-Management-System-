from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth_middleware import require_roles
from app.models.user import User, UserType
from app.schemas.stock_adjustment import StockAdjustmentCreate, StockMovementResponse, StockViewItem
from app.services.stock_adjustment_service import StockAdjustmentService

router = APIRouter(prefix="/api/stock", tags=["Stock"])
_mgr = require_roles(UserType.stock_manager, UserType.pharmacy_manager, UserType.system_administrator)
_all = require_roles(UserType.pharmacist, UserType.stock_manager, UserType.pharmacy_manager, UserType.system_administrator)


@router.get("/view", response_model=list[StockViewItem])
def stock_view(skip: int = 0, limit: int = 200, db: Session = Depends(get_db), _: User = Depends(_all)):
    return StockAdjustmentService(db).get_stock_view(skip, limit)


@router.post("/adjust", response_model=StockMovementResponse, status_code=201)
def adjust(body: StockAdjustmentCreate, db: Session = Depends(get_db), current_user: User = Depends(_mgr)):
    return StockAdjustmentService(db).adjust(body, current_user.id)


@router.get("/movements/{drug_id}", response_model=list[StockMovementResponse])
def drug_movements(drug_id: int, limit: int = 50, db: Session = Depends(get_db), _: User = Depends(_mgr)):
    return StockAdjustmentService(db).get_movements(drug_id, limit)
