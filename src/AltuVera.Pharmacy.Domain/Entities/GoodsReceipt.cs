namespace AltuVera.Pharmacy.Domain.Entities;

public class GoodsReceipt
{
    public int Id { get; set; }
    public string GrnNumber { get; set; } = string.Empty;
    public int? PurchaseOrderId { get; set; }
    public int SupplierId { get; set; }
    public DateOnly ReceivedDate { get; set; }
    public string? Notes { get; set; }
    public int? ReceivedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public PurchaseOrder? PurchaseOrder { get; set; }
    public Supplier Supplier { get; set; } = null!;
    public ICollection<GoodsReceiptItem> Items { get; set; } = [];
}

public class GoodsReceiptItem
{
    public int Id { get; set; }
    public int GoodsReceiptId { get; set; }
    public int DrugId { get; set; }
    public int QuantityReceived { get; set; }
    public decimal UnitCost { get; set; }
    public bool IsFreeGoods { get; set; }
    public string? BatchNumber { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    public decimal? SellingPrice { get; set; }
    public int? DrugBatchId { get; set; }

    public GoodsReceipt GoodsReceipt { get; set; } = null!;
    public Drug Drug { get; set; } = null!;
}
