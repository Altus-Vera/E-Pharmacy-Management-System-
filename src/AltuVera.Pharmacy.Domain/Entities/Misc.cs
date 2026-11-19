using AltuVera.Pharmacy.Domain.Enums;

namespace AltuVera.Pharmacy.Domain.Entities;

public class StockLocation
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class UnitOfMeasure
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Abbreviation { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class PriceAdjustment
{
    public int Id { get; set; }
    public int DrugId { get; set; }
    public decimal OldPrice { get; set; }
    public decimal NewPrice { get; set; }
    public string? Reason { get; set; }
    public int? AdjustedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }

    public Drug Drug { get; set; } = null!;
}

public class PurchaseRequisition
{
    public int Id { get; set; }
    public string RequisitionNumber { get; set; } = string.Empty;
    public int DrugId { get; set; }
    public int QuantityRequested { get; set; }
    public string? Notes { get; set; }
    public string Status { get; set; } = "pending";
    public int? RequestedByUserId { get; set; }
    public int? ApprovedByUserId { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Drug Drug { get; set; } = null!;
}

public class PurchaseInvoice
{
    public int Id { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public int SupplierId { get; set; }
    public int? GoodsReceiptId { get; set; }
    public DateOnly InvoiceDate { get; set; }
    public decimal TotalAmount { get; set; }
    public bool IsPaid { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Supplier Supplier { get; set; } = null!;
    public GoodsReceipt? GoodsReceipt { get; set; }
}

public class SalesReturn
{
    public int Id { get; set; }
    public string ReturnNumber { get; set; } = string.Empty;
    public int InvoiceId { get; set; }
    public int DrugId { get; set; }
    public int Quantity { get; set; }
    public decimal RefundAmount { get; set; }
    public SalesReturnReason Reason { get; set; }
    public SalesReturnStatus Status { get; set; } = SalesReturnStatus.Pending;
    public string? Notes { get; set; }
    public int? ProcessedByUserId { get; set; }
    /// <summary>POS shift the refund was given in.</summary>
    public int? ShiftId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Invoice Invoice { get; set; } = null!;
    public Drug Drug { get; set; } = null!;
}

public class StockAdjustment
{
    public int Id { get; set; }
    public string AdjustmentNumber { get; set; } = string.Empty;
    public int DrugId { get; set; }
    public int Quantity { get; set; }
    public AdjustmentType AdjustmentType { get; set; }
    public string Reason { get; set; } = string.Empty;
    public int? AdjustedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Drug Drug { get; set; } = null!;
}

public class AuditLog
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public int? EntityId { get; set; }
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class SupplierReturn
{
    public int Id { get; set; }
    public string ReturnNumber { get; set; } = string.Empty;
    public int SupplierId { get; set; }
    public int DrugId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public string? Reason { get; set; }
    public int? ProcessedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Supplier Supplier { get; set; } = null!;
    public Drug Drug { get; set; } = null!;
}
