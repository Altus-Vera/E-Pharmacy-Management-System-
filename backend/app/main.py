from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.middleware.error_handler import register_error_handlers
from app.controllers import (
    auth_controller,
    customer_controller,
    doctor_controller,
    drug_controller,
    grn_controller,
    invoice_controller,
    prescription_controller,
    purchase_invoice_controller,
    purchase_order_controller,
    purchase_requisition_controller,
    outlet_controller,
    report_controller,
    sales_return_controller,
    stock_adjustment_controller,
    stock_location_controller,
    supplier_controller,
    uom_controller,
    user_controller,
)

app = FastAPI(
    title="E-Pharmacy Management System",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5120", "http://localhost:5121"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

app.include_router(auth_controller.router)
app.include_router(user_controller.router)
app.include_router(customer_controller.router)
app.include_router(doctor_controller.router)
app.include_router(drug_controller.router)
app.include_router(supplier_controller.router)
app.include_router(prescription_controller.router)
app.include_router(invoice_controller.router)
app.include_router(purchase_order_controller.router)
app.include_router(stock_location_controller.router)
app.include_router(uom_controller.router)
app.include_router(grn_controller.router)
app.include_router(purchase_requisition_controller.router)
app.include_router(purchase_invoice_controller.router)
app.include_router(sales_return_controller.router)
app.include_router(stock_adjustment_controller.router)
app.include_router(outlet_controller.router)
app.include_router(outlet_controller.transfer_router)
app.include_router(report_controller.router)

app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
