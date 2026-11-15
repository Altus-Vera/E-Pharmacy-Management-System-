namespace AltuVera.Pharmacy.Domain.Entities;

/// <summary>
/// One received lot of a drug. Stock is sold first-in, first-out (oldest received batch first),
/// and each batch keeps its own selling price, so new stock can be priced differently from old stock.
/// Drug.Quantity is the sum of QuantityRemaining; Drug.UnitPrice / BatchNumber / ExpiryDate mirror the batch currently on sale.
/// </summary>
public class DrugBatch
{
    public int Id { get; set; }
    public int DrugId { get; set; }
    public string? BatchNumber { get; set; }
    public DateOnly? ManufacturedDate { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    public int QuantityReceived { get; set; }
    public int QuantityRemaining { get; set; }
    public decimal? UnitCost { get; set; }
    public decimal SellingPrice { get; set; }
    /// <summary>Optional price for a full pack (may be lower than units × unit price). Null = units × unit price.</summary>
    public decimal? PackSellingPrice { get; set; }
    public DateTime ReceivedAt { get; set; }
    public string Source { get; set; } = "GRN";          // Opening, GRN, Manual, Return
    public int? GoodsReceiptItemId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    [System.Text.Json.Serialization.JsonIgnore] public Drug Drug { get; set; } = null!;
}
