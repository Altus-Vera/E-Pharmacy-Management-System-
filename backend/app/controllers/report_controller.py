from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth_middleware import require_roles
from app.models.drug import Drug
from app.models.stock_movement import StockMovement, MovementType
from app.models.invoice import Invoice
from app.models.goods_receipt import GoodsReceipt

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/near-expiry")
def near_expiry_report(
    days: int = Query(90, ge=1, le=365),
    db: Session = Depends(get_db),
    _=Depends(require_roles(["pharmacist", "stock_manager", "pharmacy_manager", "system_administrator"])),
):
    threshold = date.today() + timedelta(days=days)
    drugs = (
        db.query(Drug)
        .filter(Drug.is_active == True, Drug.expiry_date != None, Drug.expiry_date <= threshold)
        .order_by(Drug.expiry_date)
        .all()
    )
    today = date.today()
    return [
        {
            "id": d.id,
            "item_code": d.item_code,
            "brand_name": d.brand_name,
            "generic_name": d.generic_name,
            "strength": d.strength,
            "batch_number": d.batch_number,
            "expiry_date": str(d.expiry_date) if d.expiry_date else None,
            "days_left": (d.expiry_date - today).days if d.expiry_date else None,
            "quantity": d.quantity,
            "unit_price": float(d.unit_price),
            "stock_value": float(d.unit_price) * d.quantity,
            "category_id": d.category_id,
            "supplier_id": d.supplier_id,
        }
        for d in drugs
    ]


@router.get("/low-stock")
def low_stock_report(
    db: Session = Depends(get_db),
    _=Depends(require_roles(["pharmacist", "stock_manager", "pharmacy_manager", "system_administrator"])),
):
    drugs = (
        db.query(Drug)
        .filter(Drug.is_active == True, Drug.quantity <= Drug.reorder_level)
        .order_by(Drug.quantity)
        .all()
    )
    return [
        {
            "id": d.id,
            "item_code": d.item_code,
            "brand_name": d.brand_name,
            "generic_name": d.generic_name,
            "strength": d.strength,
            "quantity": d.quantity,
            "reorder_level": d.reorder_level,
            "low_stock_threshold": d.low_stock_threshold,
            "unit_price": float(d.unit_price),
            "supplier_id": d.supplier_id,
            "status": "out_of_stock" if d.quantity == 0 else "reorder_now",
        }
        for d in drugs
    ]


@router.get("/fast-moving")
def fast_moving_report(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _=Depends(require_roles(["pharmacist", "stock_manager", "pharmacy_manager", "system_administrator"])),
):
    since = datetime.now() - timedelta(days=days)
    rows = (
        db.query(
            StockMovement.drug_id,
            func.sum(func.abs(StockMovement.quantity)).label("total_sold"),
            func.count(StockMovement.id).label("transaction_count"),
        )
        .filter(
            StockMovement.movement_type == MovementType.sale,
            StockMovement.created_at >= since,
        )
        .group_by(StockMovement.drug_id)
        .order_by(func.sum(func.abs(StockMovement.quantity)).desc())
        .limit(limit)
        .all()
    )
    drug_ids = [r.drug_id for r in rows]
    drugs = {d.id: d for d in db.query(Drug).filter(Drug.id.in_(drug_ids)).all()}
    return [
        {
            "drug_id": r.drug_id,
            "item_code": drugs[r.drug_id].item_code if r.drug_id in drugs else None,
            "brand_name": drugs[r.drug_id].brand_name if r.drug_id in drugs else None,
            "generic_name": drugs[r.drug_id].generic_name if r.drug_id in drugs else None,
            "strength": drugs[r.drug_id].strength if r.drug_id in drugs else None,
            "total_sold": int(r.total_sold),
            "transaction_count": int(r.transaction_count),
            "current_stock": drugs[r.drug_id].quantity if r.drug_id in drugs else None,
            "unit_price": float(drugs[r.drug_id].unit_price) if r.drug_id in drugs else None,
            "revenue": float(drugs[r.drug_id].unit_price) * int(r.total_sold) if r.drug_id in drugs else None,
        }
        for r in rows
        if r.drug_id in drugs
    ]


@router.get("/slow-moving")
def slow_moving_report(
    days: int = Query(30, ge=1, le=365),
    max_qty: int = Query(5, ge=0),
    db: Session = Depends(get_db),
    _=Depends(require_roles(["pharmacist", "stock_manager", "pharmacy_manager", "system_administrator"])),
):
    since = datetime.now() - timedelta(days=days)
    sold_drug_ids_rows = (
        db.query(StockMovement.drug_id)
        .filter(
            StockMovement.movement_type == MovementType.sale,
            StockMovement.created_at >= since,
        )
        .group_by(StockMovement.drug_id)
        .having(func.sum(func.abs(StockMovement.quantity)) > max_qty)
        .all()
    )
    exclude_ids = {r.drug_id for r in sold_drug_ids_rows}

    drugs = (
        db.query(Drug)
        .filter(Drug.is_active == True, Drug.quantity > 0, ~Drug.id.in_(exclude_ids))
        .order_by(Drug.quantity.desc())
        .limit(200)
        .all()
    )
    return [
        {
            "id": d.id,
            "item_code": d.item_code,
            "brand_name": d.brand_name,
            "generic_name": d.generic_name,
            "strength": d.strength,
            "quantity": d.quantity,
            "unit_price": float(d.unit_price),
            "stock_value": float(d.unit_price) * d.quantity,
            "expiry_date": str(d.expiry_date) if d.expiry_date else None,
            "supplier_id": d.supplier_id,
        }
        for d in drugs
    ]


@router.get("/stock-valuation")
def stock_valuation_report(
    db: Session = Depends(get_db),
    _=Depends(require_roles(["pharmacist", "stock_manager", "pharmacy_manager", "system_administrator"])),
):
    drugs = db.query(Drug).filter(Drug.is_active == True, Drug.quantity > 0).order_by(Drug.brand_name).all()
    total_value = sum(float(d.unit_price) * d.quantity for d in drugs)
    return {
        "generated_at": datetime.now().isoformat(),
        "total_stock_value": total_value,
        "total_items": len(drugs),
        "total_units": sum(d.quantity for d in drugs),
        "items": [
            {
                "id": d.id,
                "item_code": d.item_code,
                "brand_name": d.brand_name,
                "generic_name": d.generic_name,
                "strength": d.strength,
                "dosage_form": d.dosage_form,
                "quantity": d.quantity,
                "unit_price": float(d.unit_price),
                "stock_value": float(d.unit_price) * d.quantity,
                "expiry_date": str(d.expiry_date) if d.expiry_date else None,
                "category_id": d.category_id,
            }
            for d in drugs
        ],
    }


@router.get("/stock-taking")
def stock_taking_report(
    db: Session = Depends(get_db),
    _=Depends(require_roles(["pharmacist", "stock_manager", "pharmacy_manager", "system_administrator"])),
):
    drugs = db.query(Drug).filter(Drug.is_active == True).order_by(Drug.brand_name).all()
    return [
        {
            "id": d.id,
            "item_code": d.item_code,
            "brand_name": d.brand_name,
            "generic_name": d.generic_name,
            "strength": d.strength,
            "dosage_form": d.dosage_form,
            "batch_number": d.batch_number,
            "expiry_date": str(d.expiry_date) if d.expiry_date else None,
            "quantity": d.quantity,
            "unit_price": float(d.unit_price),
            "reorder_level": d.reorder_level,
            "is_prescription_only": d.is_prescription_only,
            "is_high_alert": d.is_high_alert,
            "is_narcotic": d.is_narcotic,
        }
        for d in drugs
    ]


@router.get("/sales-summary")
def sales_summary_report(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(require_roles(["pharmacist", "stock_manager", "pharmacy_manager", "system_administrator"])),
):
    q = db.query(Invoice)
    if date_from:
        q = q.filter(Invoice.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        q = q.filter(Invoice.created_at <= datetime.fromisoformat(date_to + "T23:59:59"))
    invoices = q.order_by(Invoice.created_at.desc()).all()

    total = sum(float(i.total_amount) for i in invoices)
    completed = [i for i in invoices if i.status == "completed"]
    by_payment = {}
    for i in completed:
        by_payment[i.payment_mode] = by_payment.get(i.payment_mode, 0) + float(i.total_amount)

    return {
        "total_invoices": len(invoices),
        "completed_invoices": len(completed),
        "total_revenue": sum(float(i.total_amount) for i in completed),
        "by_payment_mode": by_payment,
        "invoices": [
            {
                "id": i.id,
                "invoice_number": i.invoice_number,
                "created_at": i.created_at.isoformat(),
                "payment_mode": i.payment_mode,
                "total_amount": float(i.total_amount),
                "discount_amount": float(i.discount_amount) if i.discount_amount else 0,
                "status": i.status,
                "customer_id": i.customer_id,
            }
            for i in invoices
        ],
    }
