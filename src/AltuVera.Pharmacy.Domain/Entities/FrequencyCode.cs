namespace AltuVera.Pharmacy.Domain.Entities;

/// <summary>
/// Dosing frequency used by the days calculator: prescription codes (OD, BD, TDS, QDS…) and the
/// "1-0-1" style. TimesPerDay is null for "as needed" (SOS), where the quantity is entered by hand.
/// </summary>
public class FrequencyCode
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal? TimesPerDay { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>How a drug may be sold over the counter.</summary>
public static class SellModes
{
    public const string Loose = "loose";   // any number of base units (e.g. 9 tablets)
    public const string Strip = "strip";   // whole strips/cards only
    public const string Pack = "pack";     // whole packs only (bottles, tubes, inhalers, boxes)
    public static readonly string[] All = [Loose, Strip, Pack];
}

/// <summary>The unit a bill line is sold in.</summary>
public static class SaleUnits
{
    public const string Unit = "unit";
    public const string Strip = "strip";
    public const string Pack = "pack";
    public static readonly string[] All = [Unit, Strip, Pack];
}
