from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

import enum


class RequisitionStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    approved = "approved"
    rejected = "rejected"
    ordered = "ordered"


class PurchaseRequisition(Base):
    __tablename__ = "purchase_requisitions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    req_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    request_date: Mapped[date] = mapped_column(Date, nullable=False)
    required_by_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[RequisitionStatus] = mapped_column(
        Enum(RequisitionStatus), default=RequisitionStatus.draft, nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    requested_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    purchase_order_id: Mapped[int | None] = mapped_column(
        ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    items: Mapped[list["PurchaseRequisitionItem"]] = relationship(
        "PurchaseRequisitionItem", back_populates="requisition", cascade="all, delete-orphan"
    )


class PurchaseRequisitionItem(Base):
    __tablename__ = "purchase_requisition_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    requisition_id: Mapped[int] = mapped_column(
        ForeignKey("purchase_requisitions.id", ondelete="CASCADE"), nullable=False
    )
    drug_id: Mapped[int] = mapped_column(
        ForeignKey("drugs.id", ondelete="RESTRICT"), nullable=False
    )
    quantity_needed: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    requisition: Mapped["PurchaseRequisition"] = relationship(
        "PurchaseRequisition", back_populates="items"
    )
