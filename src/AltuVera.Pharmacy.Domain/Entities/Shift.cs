namespace AltuVera.Pharmacy.Domain.Entities;

public enum ShiftStatus { Open, Closed }

/// <summary>
/// A cashier's working session at the POS: opened with a cash float, closed with a cash count.
/// Every sale and return made while it is open is linked to it. On close the totals are frozen here
/// so the shift report never changes afterwards.
/// </summary>
public class Shift
{
    public int Id { get; set; }
    public string ShiftNumber { get; set; } = string.Empty;
    public int UserId { get; set; }
    public string? Terminal { get; set; }
    public ShiftStatus Status { get; set; } = ShiftStatus.Open;

    public DateTime OpenedAt { get; set; }
    public decimal OpeningCash { get; set; }
    public string? OpeningNotes { get; set; }

    public DateTime? ClosedAt { get; set; }
    public int? ClosedByUserId { get; set; }
    public decimal? CountedCash { get; set; }
    public string? ClosingNotes { get; set; }

    // ── frozen totals (filled when the shift is closed) ──
    public int SalesCount { get; set; }
    public decimal GrossSales { get; set; }
    public decimal DiscountTotal { get; set; }
    public decimal NetSales { get; set; }
    public decimal CashSales { get; set; }
    public decimal CardSales { get; set; }
    public decimal OtherSales { get; set; }
    public int VoidCount { get; set; }
    public decimal VoidTotal { get; set; }
    public int ReturnCount { get; set; }
    public decimal ReturnTotal { get; set; }
    public int ItemsSold { get; set; }
    public decimal ExpectedCash { get; set; }
    public decimal CashDifference { get; set; }

    public User User { get; set; } = null!;
}
