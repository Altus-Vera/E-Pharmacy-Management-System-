using AltuVera.Pharmacy.Domain.Entities;
using AltuVera.Pharmacy.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.Pharmacy.API.Services;

/// <summary>
/// Sale units (tablet / strip / pack), the loose-selling rules and the "how much for N days" calculation.
/// Stock is always counted in base units; a bill line sells Quantity × UnitsPerSaleUnit base units.
/// </summary>
public static class Dispensing
{
    public static int UnitsPer(Drug d, string saleUnit) => saleUnit switch
    {
        SaleUnits.Strip => Math.Max(d.UnitsPerStrip ?? 1, 1),
        SaleUnits.Pack => Math.Max(d.PackSize ?? 1, 1),
        _ => 1,
    };

    /// <summary>Price of one sale unit from a batch. A pack may carry its own (usually lower) price.</summary>
    public static decimal PriceFor(DrugBatch b, Drug d, string saleUnit) => saleUnit switch
    {
        SaleUnits.Pack => b.PackSellingPrice ?? b.SellingPrice * UnitsPer(d, SaleUnits.Pack),
        SaleUnits.Strip => b.SellingPrice * UnitsPer(d, SaleUnits.Strip),
        _ => b.SellingPrice,
    };

    /// <summary>Null when the quantity is allowed by the drug's selling rule, otherwise the reason.</summary>
    public static string? SaleUnitError(Drug d, string saleUnit, int qty)
    {
        if (!SaleUnits.All.Contains(saleUnit)) return $"Unknown sale unit '{saleUnit}'.";
        if (saleUnit == SaleUnits.Strip && (d.UnitsPerStrip ?? 0) < 1) return $"{d.BrandName} has no strip size set.";
        if (saleUnit == SaleUnits.Pack && (d.PackSize ?? 0) < 1 && d.SellMode != SellModes.Pack) return $"{d.BrandName} has no pack size set.";
        var baseQty = qty * UnitsPer(d, saleUnit);
        var why = string.IsNullOrWhiteSpace(d.NonLooseReason) ? "" : $" ({d.NonLooseReason})";
        switch (d.SellMode)
        {
            case SellModes.Pack when baseQty % UnitsPer(d, SaleUnits.Pack) != 0:
                return $"{d.BrandName} is sold in whole packs of {UnitsPer(d, SaleUnits.Pack)} only{why}.";
            case SellModes.Strip when baseQty % UnitsPer(d, SaleUnits.Strip) != 0 && baseQty % UnitsPer(d, SaleUnits.Pack) != 0:
                return $"{d.BrandName} is sold in whole strips of {UnitsPer(d, SaleUnits.Strip)} only{why}.";
            case SellModes.Loose when saleUnit == SaleUnits.Unit && d.MinLooseQty is > 1 && qty < d.MinLooseQty:
                return $"{d.BrandName}: at least {d.MinLooseQty} {d.BaseUnit}s when sold loose.";
        }
        return null;
    }

    public static string UnitLabel(Drug d, string saleUnit, int qty)
    {
        string plural(string w, int n) => n == 1 ? w : w + "s";
        return saleUnit switch
        {
            SaleUnits.Strip => $"{qty} {plural("strip", qty)} × {UnitsPer(d, saleUnit)} {d.BaseUnit}",
            SaleUnits.Pack => UnitsPer(d, saleUnit) > 1 ? $"{qty} {plural("pack", qty)} × {UnitsPer(d, saleUnit)} {d.BaseUnit}" : $"{qty} {plural(d.BaseUnit, qty)}",
            _ => $"{qty} {plural(d.BaseUnit, qty)}",
        };
    }

    public static string Directions(Drug d, decimal dose, FrequencyCode f, int days)
    {
        var unit = d.DoseUnit ?? d.BaseUnit;
        var doseText = dose == Math.Floor(dose) ? ((int)dose).ToString() : dose.ToString("0.##");
        var u = dose == 1 && d.DoseUnit is null ? unit : (d.DoseUnit is null ? unit + "s" : unit);
        return $"{doseText} {u}, {f.Description.ToLowerInvariant()}, for {days} day{(days == 1 ? "" : "s")}";
    }

    public record CalcLine(int DrugBatchId, string? BatchNumber, DateOnly? ExpiryDate, string SaleUnit, int UnitsPerSaleUnit,
        int Quantity, decimal UnitPrice, decimal LineTotal, string Label);

    public record CalcResult(int DrugId, string Drug, string SellMode, string? NonLooseReason, string BaseUnit,
        decimal Dose, string? DoseUnit, string FrequencyCode, decimal TimesPerDay, int Days,
        int UnitsNeeded, int UnitsSupplied, int ExtraUnits, decimal Total, string Directions,
        List<CalcLine> Lines, List<string> Warnings, bool Available);

    /// <summary>
    /// How much of a drug is needed for dose × frequency × days, rounded to what may be sold
    /// (loose units, whole strips or whole packs), allocated to batches oldest-first and priced per batch.
    /// </summary>
    public static async Task<CalcResult> CalculateAsync(AppDbContext db, Drug d, decimal dose, FrequencyCode f, int days)
    {
        var warnings = new List<string>();
        var tpd = f.TimesPerDay ?? 0;
        var content = d.ContentPerUnit is > 0 ? d.ContentPerUnit.Value : 1m;
        var needed = (int)Math.Ceiling(dose * tpd * days / content - 0.0000001m);
        if (needed < 1) needed = 1;

        // plan: which sale units, how many
        var plan = new List<(string Unit, int Qty)>();
        var pack = UnitsPer(d, SaleUnits.Pack);
        var strip = UnitsPer(d, SaleUnits.Strip);
        switch (d.SellMode)
        {
            case SellModes.Pack:
                plan.Add(pack > 1 ? (SaleUnits.Pack, (int)Math.Ceiling(needed / (decimal)pack)) : (SaleUnits.Unit, needed));
                break;
            case SellModes.Strip:
                if (strip <= 1) { plan.Add((SaleUnits.Unit, needed)); break; }
                var strips = (int)Math.Ceiling(needed / (decimal)strip);
                // a long supply: whole packs first (often cheaper), the rest as strips
                if (pack > strip && pack % strip == 0 && strips * strip >= pack)
                {
                    var packs = strips * strip / pack;
                    plan.Add((SaleUnits.Pack, packs));
                    var restStrips = strips - packs * (pack / strip);
                    if (restStrips > 0) plan.Add((SaleUnits.Strip, restStrips));
                }
                else plan.Add((SaleUnits.Strip, strips));
                break;
            default:
                var units = Math.Max(needed, d.MinLooseQty ?? 1);
                if (pack > 1 && units >= pack)
                {
                    plan.Add((SaleUnits.Pack, units / pack));
                    var rest = units % pack;
                    if (rest > 0) plan.Add((SaleUnits.Unit, Math.Max(rest, d.MinLooseQty ?? 1)));
                }
                else plan.Add((SaleUnits.Unit, units));
                break;
        }

        // allocate FIFO across sellable batches (a strip/pack comes out of one batch)
        var batches = await BatchStock.SellableAsync(db, d.Id);
        var left = batches.ToDictionary(b => b.Id, b => b.QuantityRemaining);
        var lines = new List<CalcLine>();
        var available = true;
        foreach (var (unit, qty) in plan)
        {
            var per = UnitsPer(d, unit);
            var want = qty;
            foreach (var b in batches)
            {
                if (want == 0) break;
                var fit = left[b.Id] / per;
                if (fit <= 0) continue;
                var take = Math.Min(fit, want);
                left[b.Id] -= take * per;
                var price = PriceFor(b, d, unit);
                var existing = lines.FindIndex(l => l.DrugBatchId == b.Id && l.SaleUnit == unit);
                if (existing >= 0)
                {
                    var e = lines[existing];
                    lines[existing] = e with { Quantity = e.Quantity + take, LineTotal = price * (e.Quantity + take), Label = UnitLabel(d, unit, e.Quantity + take) };
                }
                else lines.Add(new CalcLine(b.Id, b.BatchNumber, b.ExpiryDate, unit, per, take, price, price * take, UnitLabel(d, unit, take)));
                want -= take;
            }
            if (want > 0) available = false;
        }

        var supplied = lines.Sum(l => l.Quantity * l.UnitsPerSaleUnit);
        if (!available) warnings.Add($"Only {batches.Sum(b => b.QuantityRemaining)} {d.BaseUnit}s in sellable stock — not enough for {days} days.");
        if (supplied > needed && available)
            warnings.Add($"{(d.SellMode == SellModes.Loose ? "Rounded" : d.SellMode == SellModes.Strip ? "Sold in whole strips" : "Sold in whole packs")}: {supplied - needed} extra {d.BaseUnit}{(supplied - needed == 1 ? "" : "s")}.");
        if (d.MaxDays is > 0 && days > d.MaxDays) warnings.Add($"More than the {d.MaxDays}-day maximum for {d.BrandName}.");
        if (d.MinDays is > 0 && days < d.MinDays) warnings.Add($"Shorter than the {d.MinDays}-day minimum course for {d.BrandName}.");

        return new CalcResult(d.Id, d.BrandName, d.SellMode, d.NonLooseReason, d.BaseUnit, dose, d.DoseUnit, f.Code, tpd, days,
            needed, supplied, Math.Max(supplied - needed, 0), lines.Sum(l => l.LineTotal), Directions(d, dose, f, days), lines, warnings, available);
    }
}
