from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth_middleware import require_roles
from app.models.outlet import Outlet, StockTransfer, TransferStatus
from app.models.drug import Drug

router = APIRouter(prefix="/api/outlets", tags=["outlets"])
transfer_router = APIRouter(prefix="/api/stock-transfers", tags=["stock-transfers"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class OutletCreate(BaseModel):
    name: str
    code: str
    address: Optional[str] = None
    contact_number: Optional[str] = None
    manager_name: Optional[str] = None
    is_head_office: bool = False

class OutletUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    contact_number: Optional[str] = None
    manager_name: Optional[str] = None
    is_active: Optional[bool] = None
    is_head_office: Optional[bool] = None

class TransferCreate(BaseModel):
    from_outlet_id: int
    to_outlet_id: int
    drug_id: int
    quantity: int
    notes: Optional[str] = None

class TransferStatusUpdate(BaseModel):
    status: TransferStatus


def _outlet_dict(o: Outlet) -> dict:
    return {
        "id": o.id, "name": o.name, "code": o.code, "address": o.address,
        "contact_number": o.contact_number, "manager_name": o.manager_name,
        "is_active": o.is_active, "is_head_office": o.is_head_office,
        "created_at": o.created_at.isoformat(),
    }

def _transfer_dict(t: StockTransfer) -> dict:
    return {
        "id": t.id, "transfer_number": t.transfer_number,
        "from_outlet_id": t.from_outlet_id,
        "from_outlet_name": t.from_outlet.name if t.from_outlet else None,
        "to_outlet_id": t.to_outlet_id,
        "to_outlet_name": t.to_outlet.name if t.to_outlet else None,
        "drug_id": t.drug_id,
        "drug_name": t.drug.brand_name if t.drug else None,
        "quantity": t.quantity, "notes": t.notes, "status": t.status,
        "created_at": t.created_at.isoformat(),
        "updated_at": t.updated_at.isoformat(),
    }


# ── Outlets ────────────────────────────────────────────────────────────────────

@router.post("")
def create_outlet(
    body: OutletCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(["pharmacy_manager", "system_administrator"])),
):
    if db.query(Outlet).filter(Outlet.code == body.code).first():
        raise HTTPException(400, "Outlet code already exists")
    outlet = Outlet(**body.model_dump())
    db.add(outlet)
    db.commit()
    db.refresh(outlet)
    return _outlet_dict(outlet)


@router.get("")
def list_outlets(
    db: Session = Depends(get_db),
    _=Depends(require_roles(["pharmacist", "stock_manager", "pharmacy_manager", "system_administrator"])),
):
    return [_outlet_dict(o) for o in db.query(Outlet).order_by(Outlet.name).all()]


@router.patch("/{outlet_id}")
def update_outlet(
    outlet_id: int,
    body: OutletUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(["pharmacy_manager", "system_administrator"])),
):
    outlet = db.get(Outlet, outlet_id)
    if not outlet:
        raise HTTPException(404, "Outlet not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(outlet, k, v)
    db.commit()
    db.refresh(outlet)
    return _outlet_dict(outlet)


# ── Transfers ──────────────────────────────────────────────────────────────────

@transfer_router.post("")
def create_transfer(
    body: TransferCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(["stock_manager", "pharmacy_manager", "system_administrator"])),
):
    if body.from_outlet_id == body.to_outlet_id:
        raise HTTPException(400, "From and To outlets must differ")
    drug = db.get(Drug, body.drug_id)
    if not drug:
        raise HTTPException(404, "Drug not found")
    if drug.quantity < body.quantity:
        raise HTTPException(400, f"Insufficient stock: available {drug.quantity}")

    count = db.query(StockTransfer).count()
    transfer_number = f"TRF-{(count + 1):05d}"

    transfer = StockTransfer(
        transfer_number=transfer_number,
        from_outlet_id=body.from_outlet_id,
        to_outlet_id=body.to_outlet_id,
        drug_id=body.drug_id,
        quantity=body.quantity,
        notes=body.notes,
        status=TransferStatus.pending,
    )
    db.add(transfer)
    db.commit()
    db.refresh(transfer)
    return _transfer_dict(transfer)


@transfer_router.get("")
def list_transfers(
    db: Session = Depends(get_db),
    _=Depends(require_roles(["pharmacist", "stock_manager", "pharmacy_manager", "system_administrator"])),
):
    transfers = db.query(StockTransfer).order_by(StockTransfer.created_at.desc()).all()
    return [_transfer_dict(t) for t in transfers]


@transfer_router.patch("/{transfer_id}/status")
def update_transfer_status(
    transfer_id: int,
    body: TransferStatusUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(["stock_manager", "pharmacy_manager", "system_administrator"])),
):
    transfer = db.get(StockTransfer, transfer_id)
    if not transfer:
        raise HTTPException(404, "Transfer not found")

    if body.status == TransferStatus.received and transfer.status != TransferStatus.received:
        drug = db.get(Drug, transfer.drug_id)
        if drug:
            if drug.quantity < transfer.quantity:
                raise HTTPException(400, f"Insufficient stock to complete transfer: available {drug.quantity}")
            drug.quantity -= transfer.quantity
            db.flush()

    transfer.status = body.status
    db.commit()
    db.refresh(transfer)
    return _transfer_dict(transfer)
