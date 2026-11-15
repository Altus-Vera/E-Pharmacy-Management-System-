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
    /// <summary>Base units in one full pack (e.g. 100 tablets in a box; 1 for a bottle sold whole).</summary>
    public int? PackSize { get; set; }
    /// <summary>Unit stock and price are counted in: tablet, capsule, bottle, tube, inhaler, vial, pen, sachet…</summary>
    public string BaseUnit { get; set; } = "unit";
    /// <summary>Base units in one strip/card (e.g. 10), when sold by the strip.</summary>
    public int? UnitsPerStrip { get; set; }
    /// <summary>loose | strip | pack — see SellModes.</summary>
    public string SellMode { get; set; } = "loose";
    /// <summary>Why it cannot be sold loose (shown to the cashier).</summary>
    public string? NonLooseReason { get; set; }
    /// <summary>Smallest loose quantity allowed (e.g. 2).</summary>
    public int? MinLooseQty { get; set; }
    /// <summary>Unit the dose is measured in when different from the base unit (e.g. ml for a syrup sold by the bottle).</summary>
    public string? DoseUnit { get; set; }
    /// <summary>Dose units in one base unit (e.g. 100 ml in a bottle, 200 puffs in an inhaler).</summary>
    public decimal? ContentPerUnit { get; set; }
    /// <summary>Usual dose per intake, in dose units (pre-fills the days calculator).</summary>
    public decimal? DefaultDose { get; set; }
    /// <summary>Usual frequency code (pre-fills the days calculator).</summary>
    public string? DefaultFrequency { get; set; }
    /// <summary>Warn when a supply runs longer than this (e.g. antibiotics, narcotics).</summary>
    public int? MaxDays { get; set; }
    /// <summary>Warn when a supply is shorter than this (e.g. a full antibiotic course).</summary>
    public int? MinDays { get; set; }
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
