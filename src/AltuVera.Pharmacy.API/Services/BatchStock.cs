using AltuVera.Pharmacy.Domain.Entities;
using AltuVera.Pharmacy.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.Pharmacy.API.Services;

/// <summary>
/// Batch-level stock: every stock change goes through here so batches stay the source of truth.
/// Selling order is FIFO — the oldest received batch with stock goes first; expired batches are never sold.
/// After saving, call <see cref="SyncAsync"/> so the drug row reflects its batches.
/// </summary>
public static class BatchStock
{
    public static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    public static IOrderedQueryable<DrugBatch> Fifo(this IQueryable<DrugBatch> q) => q.OrderBy(b => b.ReceivedAt).ThenBy(b => b.Id);

    public static bool IsSellable(DrugBatch b) => b.QuantityRemaining > 0 && (b.ExpiryDate == null || b.ExpiryDate >= Today);

    /// <summary>Batches with stock that may be sold, oldest first.</summary>
    public static Task<List<DrugBatch>> SellableAsync(AppDbContext db, int drugId)
    {
        var today = Today;
        return db.DrugBatches.Where(b => b.DrugId == drugId && b.QuantityRemaining > 0 && (b.ExpiryDate == null || b.ExpiryDate >= today))
            .Fifo().ToListAsync();
    }

    public static DrugBatch Receive(AppDbContext db, Drug drug, int qty, decimal sellingPrice, string source,
        string? batchNo = null, DateOnly? expiry = null, DateOnly? mfg = null, decimal? unitCost = null)
    {
        var now = DateTime.UtcNow;
        var b = new DrugBatch
        {
            DrugId = drug.Id, Drug = drug, BatchNumber = batchNo, ExpiryDate = expiry, ManufacturedDate = mfg,
            QuantityReceived = qty, QuantityRemaining = qty, UnitCost = unitCost, SellingPrice = sellingPrice,
            ReceivedAt = now, Source = source, CreatedAt = now, UpdatedAt = now,
        };
        db.DrugBatches.Add(b);
        drug.Quantity += qty;
        drug.UpdatedAt = now;
        return b;
    }

    /// <summary>Takes qty out FIFO. Sales skip expired batches; write-offs/returns may include them (expired first).</summary>
    public static async Task<List<(DrugBatch Batch, int Qty)>> ConsumeFifoAsync(AppDbContext db, Drug drug, int qty, bool includeExpired = false)
    {
        var today = Today;
        var q = db.DrugBatches.Where(b => b.DrugId == drug.Id && b.QuantityRemaining > 0);
        if (!includeExpired) q = q.Where(b => b.ExpiryDate == null || b.ExpiryDate >= today);
        var batches = await q.Fifo().ToListAsync();
        if (includeExpired) batches = batches.OrderBy(b => b.ExpiryDate != null && b.ExpiryDate < today ? 0 : 1).ToList();
        var available = batches.Sum(b => b.QuantityRemaining);
        if (available < qty)
            throw new InvalidOperationException($"Insufficient stock for {drug.BrandName}: {available} available");
        var taken = new List<(DrugBatch, int)>();
        var left = qty;
        foreach (var b in batches)
        {
            if (left == 0) break;
            var t = Math.Min(left, b.QuantityRemaining);
            Take(b, drug, t);
            taken.Add((b, t));
            left -= t;
        }
        return taken;
    }

    public static void Take(DrugBatch b, Drug drug, int qty)
    {
        if (qty > b.QuantityRemaining)
            throw new InvalidOperationException($"Batch {b.BatchNumber ?? b.Id.ToString()} of {drug.BrandName} has only {b.QuantityRemaining} left");
        b.QuantityRemaining -= qty;
        b.UpdatedAt = DateTime.UtcNow;
        drug.Quantity -= qty;
        drug.UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Puts stock back into its original batch (void / return); falls back to the newest batch, or a new one.</summary>
    public static async Task RestoreAsync(AppDbContext db, Drug drug, int? batchId, int qty)
    {
        DrugBatch? b = batchId is null ? null : await db.DrugBatches.FirstOrDefaultAsync(x => x.Id == batchId && x.DrugId == drug.Id);
        b ??= await db.DrugBatches.Where(x => x.DrugId == drug.Id).OrderByDescending(x => x.ReceivedAt).ThenByDescending(x => x.Id).FirstOrDefaultAsync();
        if (b is null) { Receive(db, drug, qty, drug.UnitPrice, "Return", drug.BatchNumber, drug.ExpiryDate); return; }
        b.QuantityRemaining += qty;
        b.UpdatedAt = DateTime.UtcNow;
        drug.Quantity += qty;
        drug.UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Recomputes the drug rows from their batches and saves (call after SaveChanges).</summary>
    public static async Task SyncAsync(AppDbContext db, params int[] drugIds)
    {
        foreach (var id in drugIds.Distinct())
        {
            var drug = await db.Drugs.FindAsync(id);
            if (drug is null) continue;
            var batches = await db.DrugBatches.Where(b => b.DrugId == id && b.QuantityRemaining > 0).Fifo().ToListAsync();
            drug.Quantity = batches.Sum(b => b.QuantityRemaining);
            var current = batches.FirstOrDefault(IsSellable) ?? batches.FirstOrDefault();
            if (current is not null)
            {
                drug.UnitPrice = current.SellingPrice;
                drug.BatchNumber = current.BatchNumber;
                drug.ExpiryDate = current.ExpiryDate;
                drug.ManufacturedDate = current.ManufacturedDate;
            }
        }
        await db.SaveChangesAsync();
    }
}
