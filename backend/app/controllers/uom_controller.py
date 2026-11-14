from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth_middleware import require_roles
from app.models.user import User, UserType
from app.schemas.unit_of_measure import UomCreate, UomResponse, UomUpdate
from app.services.uom_service import UomService

router = APIRouter(prefix="/api/uom", tags=["Units of Measure"])
_mgr = require_roles(UserType.stock_manager, UserType.pharmacy_manager, UserType.system_administrator)


@router.post("", response_model=UomResponse, status_code=201)
def create(body: UomCreate, db: Session = Depends(get_db), _: User = Depends(_mgr)):
    return UomService(db).create(body)


@router.get("", response_model=list[UomResponse])
def list_all(db: Session = Depends(get_db), _: User = Depends(require_roles(
    UserType.pharmacist, UserType.stock_manager, UserType.pharmacy_manager, UserType.system_administrator
))):
    return UomService(db).list_all()


@router.get("/{uom_id}", response_model=UomResponse)
def get_one(uom_id: int, db: Session = Depends(get_db), _: User = Depends(_mgr)):
    return UomService(db).get(uom_id)


@router.patch("/{uom_id}", response_model=UomResponse)
def update(uom_id: int, body: UomUpdate, db: Session = Depends(get_db), _: User = Depends(_mgr)):
    return UomService(db).update(uom_id, body)
