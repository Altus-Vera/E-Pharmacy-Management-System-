from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

import enum


class ReturnReason(str, enum.Enum):
    wrong_item = "wrong_item"
    damaged = "damaged"
    expired = "expired"
    patient_refused = "patient_refused"
    other = "other"


class SalesReturn(Base):
    __tablename__ = "sales_returns"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    return_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    invoice_id: Mapped[int | None] = mapped_column(
        ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True
    )
    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customers.id", ondelete="SET NULL"), nullable=True
    )
    return_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[ReturnReason] = mapped_column(
        Enum(ReturnReason), default=ReturnReason.other, nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_refund: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    processed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    invoice: Mapped["Invoice"] = relationship("Invoice")
    customer: Mapped["Customer"] = relationship("Customer")
    items: Mapped[list["SalesReturnItem"]] = relationship(
        "SalesReturnItem", back_populates="sales_return", cascade="all, delete-orphan"
    )


class SalesReturnItem(Base):
    __tablename__ = "sales_return_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sales_return_id: Mapped[int] = mapped_column(
        ForeignKey("sales_returns.id", ondelete="CASCADE"), nullable=False
    )
    drug_id: Mapped[int] = mapped_column(
        ForeignKey("drugs.id", ondelete="RESTRICT"), nullable=False
    )
    quantity_returned: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    line_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    restock: Mapped[bool] = mapped_column(default=True)

    sales_return: Mapped["SalesReturn"] = relationship("SalesReturn", back_populates="items")
