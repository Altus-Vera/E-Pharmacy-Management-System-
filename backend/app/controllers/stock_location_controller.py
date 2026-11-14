from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth_middleware import require_roles
from app.models.user import User, UserType
from app.schemas.stock_location import StockLocationCreate, StockLocationResponse, StockLocationUpdate
from app.services.stock_location_service import StockLocationService

router = APIRouter(prefix="/api/stock-locations", tags=["Stock Locations"])
_mgr = require_roles(UserType.stock_manager, UserType.pharmacy_manager, UserType.system_administrator)


@router.post("", response_model=StockLocationResponse, status_code=201)
def create(body: StockLocationCreate, db: Session = Depends(get_db), _: User = Depends(_mgr)):
    return StockLocationService(db).create(body)


@router.get("", response_model=list[StockLocationResponse])
def list_all(db: Session = Depends(get_db), _: User = Depends(require_roles(
    UserType.pharmacist, UserType.stock_manager, UserType.pharmacy_manager, UserType.system_administrator
))):
    return StockLocationService(db).list_all()


@router.get("/{loc_id}", response_model=StockLocationResponse)
def get_one(loc_id: int, db: Session = Depends(get_db), _: User = Depends(_mgr)):
    return StockLocationService(db).get(loc_id)


@router.patch("/{loc_id}", response_model=StockLocationResponse)
def update(loc_id: int, body: StockLocationUpdate, db: Session = Depends(get_db), _: User = Depends(_mgr)):
    return StockLocationService(db).update(loc_id, body)
