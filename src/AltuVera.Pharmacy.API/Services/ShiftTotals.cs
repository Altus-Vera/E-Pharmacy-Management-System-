using AltuVera.Pharmacy.Domain.Entities;
using AltuVera.Pharmacy.Domain.Enums;
using AltuVera.Pharmacy.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.Pharmacy.API.Services;

/// <summary>Works out a shift's figures from the sales and returns linked to it.</summary>
public static class ShiftTotals
{
    public record Totals(
        int SalesCount, decimal GrossSales, decimal DiscountTotal, decimal NetSales,
        decimal CashSales, decimal CardSales, decimal OtherSales,
        int VoidCount, decimal VoidTotal, int ReturnCount, decimal ReturnTotal, int ItemsSold,
        decimal OpeningCash, decimal ExpectedCash, string? FirstInvoice, string? LastInvoice, DateTime? LastSaleAt);

    public record TopItem(string Name, int Quantity, decimal Amount);

    /// <summary>Open shift of a user (null if none).</summary>
    public static Task<Shift?> OpenForAsync(AppDbContext db, int userId) =>
        db.Shifts.FirstOrDefaultAsync(s => s.UserId == userId && s.Status == ShiftStatus.Open);

    public static async Task<Totals> ComputeAsync(AppDbContext db, Shift s)
    {
        var inv = await db.Invoices.AsNoTracking().Where(i => i.ShiftId == s.Id)
            .Select(i => new { i.InvoiceNumber, i.Status, i.Subtotal, i.DiscountAmount, i.TotalAmount, i.PaymentMode, i.CreatedAt, Units = i.Items.Sum(x => (int?)x.Quantity) ?? 0 })
            .ToListAsync();
        var done = inv.Where(i => i.Status == InvoiceStatus.Completed).ToList();
        var voids = inv.Where(i => i.Status == InvoiceStatus.Cancelled).ToList();
        var rets = await db.SalesReturns.AsNoTracking()
            .Where(r => r.ShiftId == s.Id && r.Status != SalesReturnStatus.Rejected)
            .Select(r => r.RefundAmount).ToListAsync();

        decimal By(PaymentMode m) => done.Where(i => i.PaymentMode == m).Sum(i => i.TotalAmount);
        var cash = By(PaymentMode.Cash);
        var refunds = rets.Sum();
        var ordered = done.OrderBy(i => i.CreatedAt).ToList();
        return new Totals(
            done.Count, done.Sum(i => i.Subtotal), done.Sum(i => i.DiscountAmount), done.Sum(i => i.TotalAmount),
            cash, By(PaymentMode.Card), By(PaymentMode.Other),
            voids.Count, voids.Sum(i => i.TotalAmount), rets.Count, refunds, done.Sum(i => i.Units),
            s.OpeningCash,
            // refunds are paid out of the drawer
            s.OpeningCash + cash - refunds,
            ordered.FirstOrDefault()?.InvoiceNumber, ordered.LastOrDefault()?.InvoiceNumber, ordered.LastOrDefault()?.CreatedAt);
    }

    public static async Task<List<TopItem>> TopItemsAsync(AppDbContext db, int shiftId, int take = 10)
    {
        var rows = await db.InvoiceItems.AsNoTracking()
            .Where(x => x.Invoice.ShiftId == shiftId && x.Invoice.Status == InvoiceStatus.Completed)
            .Select(x => new { x.Drug.BrandName, x.Quantity, x.LineTotal })
            .ToListAsync();
        return rows.GroupBy(x => x.BrandName)
            .Select(g => new TopItem(g.Key, g.Sum(x => x.Quantity), g.Sum(x => x.LineTotal)))
            .OrderByDescending(x => x.Amount).Take(take).ToList();
    }

    /// <summary>Copy the figures onto the shift so the closed report never changes.</summary>
    public static void Freeze(Shift s, Totals t)
    {
        s.SalesCount = t.SalesCount; s.GrossSales = t.GrossSales; s.DiscountTotal = t.DiscountTotal; s.NetSales = t.NetSales;
        s.CashSales = t.CashSales; s.CardSales = t.CardSales; s.OtherSales = t.OtherSales;
        s.VoidCount = t.VoidCount; s.VoidTotal = t.VoidTotal; s.ReturnCount = t.ReturnCount; s.ReturnTotal = t.ReturnTotal;
        s.ItemsSold = t.ItemsSold; s.ExpectedCash = t.ExpectedCash;
        s.CashDifference = (s.CountedCash ?? 0) - t.ExpectedCash;
    }

    public static Totals FromFrozen(Shift s) => new(
        s.SalesCount, s.GrossSales, s.DiscountTotal, s.NetSales, s.CashSales, s.CardSales, s.OtherSales,
        s.VoidCount, s.VoidTotal, s.ReturnCount, s.ReturnTotal, s.ItemsSold, s.OpeningCash, s.ExpectedCash, null, null, null);
}
