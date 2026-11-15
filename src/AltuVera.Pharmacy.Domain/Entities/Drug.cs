using AltuVera.Pharmacy.Domain.Enums;

namespace AltuVera.Pharmacy.Domain.Entities;

public class Drug
{
    public int Id { get; set; }
    public string ItemCode { get; set; } = string.Empty;
    public string BrandName { get; set; } = string.Empty;
    public string GenericName { get; set; } = string.Empty;
    public string? ActiveIngredient { get; set; }
    public string? Description { get; set; }
    public string? Strength { get; set; }
    public DosageForm DosageForm { get; set; }
    public string? StorageRequirements { get; set; }
    public string? BatchNumber { get; set; }
    public DateOnly? ManufacturedDate { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Discount { get; set; }
    public int Quantity { get; set; }
    public int? PackSize { get; set; }
    public int LowStockThreshold { get; set; } = 10;
    public int ReorderLevel { get; set; } = 10;
    public bool IsPrescriptionOnly { get; set; }
    public bool IsOtc { get; set; } = true;
    public bool IsHighAlert { get; set; }
    public bool IsNarcotic { get; set; }
    public bool IsActive { get; set; } = true;
    public int? CategoryId { get; set; }
    public int? SupplierId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public DrugCategory? Category { get; set; }
    public Supplier? Supplier { get; set; }
    /// <summary>Batches with stock, oldest first (filled by the API when listing).</summary>
    public ICollection<DrugBatch> Batches { get; set; } = [];
    [System.Text.Json.Serialization.JsonIgnore] public ICollection<PriceAdjustment> PriceAdjustments { get; set; } = [];
    [System.Text.Json.Serialization.JsonIgnore] public ICollection<StockMovement> StockMovements { get; set; } = [];
}

public class DrugCategory
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    [System.Text.Json.Serialization.JsonIgnore] public ICollection<Drug> Drugs { get; set; } = [];
}
