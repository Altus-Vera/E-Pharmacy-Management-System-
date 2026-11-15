using AltuVera.Pharmacy.Domain.Enums;

namespace AltuVera.Pharmacy.Domain.Entities;

public class Invoice
{
    public int Id { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public int? CustomerId { get; set; }
    public int? DoctorId { get; set; }
    public int? PrescriptionId { get; set; }
    public decimal Subtotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TaxRate { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public PaymentMode PaymentMode { get; set; }
    public InvoiceStatus Status { get; set; } = InvoiceStatus.Completed;
    public string? Notes { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancellationReason { get; set; }
    public int? ServedByUserId { get; set; }
    public int? VerifiedByUserId { get; set; }
    public int LoyaltyPointsEarned { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Customer? Customer { get; set; }
    public Doctor? Doctor { get; set; }
    public Prescription? Prescription { get; set; }
    public ICollection<InvoiceItem> Items { get; set; } = [];
}

public class InvoiceItem
{
    public int Id { get; set; }
    public int InvoiceId { get; set; }
    public int DrugId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal DiscountRate { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal LineTotal { get; set; }
    public int? DrugBatchId { get; set; }
    /// <summary>unit | strip | pack — Quantity and UnitPrice are in this unit.</summary>
    public string SaleUnit { get; set; } = "unit";
    /// <summary>Base units in one sale unit (stock moved = Quantity × this).</summary>
    public int UnitsPerSaleUnit { get; set; } = 1;
    public decimal? Dose { get; set; }
    public string? FrequencyCode { get; set; }
    public int? Days { get; set; }
    public string? Directions { get; set; }

    public Invoice Invoice { get; set; } = null!;
    public Drug Drug { get; set; } = null!;
}
