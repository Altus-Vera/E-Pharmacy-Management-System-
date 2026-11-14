from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

import enum
from sqlalchemy import Enum as SAEnum


class TransferStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    in_transit = "in_transit"
    received = "received"
    cancelled = "cancelled"


class Outlet(Base):
    __tablename__ = "outlets"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False, unique=True)
    code: Mapped[str] = mapped_column(String(20), nullable=False, unique=True, index=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    manager_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_head_office: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    transfers_out: Mapped[list["StockTransfer"]] = relationship(
        "StockTransfer", foreign_keys="StockTransfer.from_outlet_id", back_populates="from_outlet"
    )
    transfers_in: Mapped[list["StockTransfer"]] = relationship(
        "StockTransfer", foreign_keys="StockTransfer.to_outlet_id", back_populates="to_outlet"
    )


class StockTransfer(Base):
    __tablename__ = "stock_transfers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    transfer_number: Mapped[str] = mapped_column(String(20), nullable=False, unique=True, index=True)
    from_outlet_id: Mapped[int] = mapped_column(ForeignKey("outlets.id", ondelete="RESTRICT"), nullable=False)
    to_outlet_id: Mapped[int] = mapped_column(ForeignKey("outlets.id", ondelete="RESTRICT"), nullable=False)
    drug_id: Mapped[int] = mapped_column(ForeignKey("drugs.id", ondelete="RESTRICT"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[TransferStatus] = mapped_column(SAEnum(TransferStatus), default=TransferStatus.pending, nullable=False)
    requested_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    from_outlet: Mapped["Outlet"] = relationship("Outlet", foreign_keys=[from_outlet_id], back_populates="transfers_out")
    to_outlet: Mapped["Outlet"] = relationship("Outlet", foreign_keys=[to_outlet_id], back_populates="transfers_in")
    drug: Mapped["Drug"] = relationship("Drug")
