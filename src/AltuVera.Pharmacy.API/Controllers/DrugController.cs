using AltuVera.Pharmacy.API.Services;
using AltuVera.Pharmacy.API.Security;
using AltuVera.Pharmacy.Domain.Entities;
using AltuVera.Pharmacy.Domain.Enums;
using AltuVera.Pharmacy.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.Pharmacy.API.Controllers;

[ApiController]
[Route("api/drugs")]
[Authorize]
public class DrugController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] bool? lowStock, [FromQuery] bool? expiringSoon,
        [FromQuery] string? search)
    {
        var today = BatchStock.Today;
        var q = db.Drugs.Include(d => d.Category).Include(d => d.Supplier)
            .Include(d => d.Batches.Where(b => b.QuantityRemaining > 0 && (b.ExpiryDate == null || b.ExpiryDate >= today))
                .OrderBy(b => b.ReceivedAt).ThenBy(b => b.Id))
            .AsSplitQuery().AsQueryable();
        if (search is not null)
            q = q.Where(d => EF.Functions.Like(d.BrandName, $"%{search}%") ||
                             EF.Functions.Like(d.GenericName, $"%{search}%") ||
                             EF.Functions.Like(d.ItemCode, $"%{search}%"));
        // "low stock" = at or below the reorder level (the threshold is the lower, critical level)
        if (lowStock == true) q = q.Where(d => d.IsActive && (d.Quantity <= d.ReorderLevel || d.Quantity <= d.LowStockThreshold));
        if (expiringSoon == true)
        {
            var threshold = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(90));
            q = q.Where(d => d.ExpiryDate.HasValue && d.ExpiryDate <= threshold);
        }
        return Ok(await q.OrderBy(d => d.BrandName).ToListAsync());
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        var today = BatchStock.Today;
        var d = await db.Drugs.Include(d => d.Category).Include(d => d.Supplier)
            .Include(d => d.Batches.Where(b => b.QuantityRemaining > 0 && (b.ExpiryDate == null || b.ExpiryDate >= today))
                .OrderBy(b => b.ReceivedAt).ThenBy(b => b.Id))
            .AsSplitQuery().FirstOrDefaultAsync(d => d.Id == id);
        return d is null ? NotFound() : Ok(d);
    }

    [Authorize(Roles = R.Stock)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] DrugRequest req)
    {
        if (StockLevelError(req) is { } err) return BadRequest(new { detail = err });
        if (await db.Drugs.AnyAsync(d => d.ItemCode == req.ItemCode))
            return BadRequest(new { detail = "Item code already exists" });
        var drug = MapToDrug(new Drug(), req);
        drug.CreatedAt = DateTime.UtcNow;
        drug.Quantity = 0;
        db.Drugs.Add(drug);
        if (req.Quantity > 0)
            BatchStock.Receive(db, drug, req.Quantity, req.UnitPrice, "Opening", req.BatchNumber, req.ExpiryDate, req.ManufacturedDate);
        await db.SaveChangesAsync();
        await BatchStock.SyncAsync(db, drug.Id);
        return Ok(drug);
    }

    [Authorize(Roles = R.Stock)]
    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] DrugRequest req)
    {
        var drug = await db.Drugs.FindAsync(id);
        if (drug is null) return NotFound();
        if (StockLevelError(req) is { } err) return BadRequest(new { detail = err });
        var priceChanged = drug.UnitPrice != req.UnitPrice || drug.Discount != req.Discount;
        if (priceChanged && !(User.IsInRole(R.PharmacyManager) || User.IsInRole(R.Admin)))
            return StatusCode(403, new { detail = "Only a Pharmacy Manager can change price or discount." });
        if (drug.UnitPrice != req.UnitPrice)
        {
            var uid = int.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var u) ? u : (int?)null;
            db.PriceAdjustments.Add(new PriceAdjustment
            {
                DrugId = drug.Id, OldPrice = drug.UnitPrice, NewPrice = req.UnitPrice,
                Reason = string.IsNullOrWhiteSpace(req.PriceChangeReason) ? "Price updated" : req.PriceChangeReason,
                AdjustedByUserId = uid, CreatedAt = DateTime.UtcNow,
            });
        }
        var oldQty = drug.Quantity;
        var oldBatchNo = drug.BatchNumber;
        var oldExpiry = drug.ExpiryDate;
        MapToDrug(drug, req);
        drug.Quantity = oldQty;                      // stock only changes through batches
        drug.UpdatedAt = DateTime.UtcNow;

        var inStock = await db.DrugBatches.Where(b => b.DrugId == id && b.QuantityRemaining > 0).Fifo().ToListAsync();
        // a price revision applies to all stock still on hand
        if (priceChanged) foreach (var b in inStock) { b.SellingPrice = req.UnitPrice; b.UpdatedAt = DateTime.UtcNow; }
        // batch no / expiry edits on the drug form correct the batch currently on sale
        var current = inStock.FirstOrDefault(BatchStock.IsSellable) ?? inStock.FirstOrDefault();
        if (current is not null && (req.BatchNumber != oldBatchNo || req.ExpiryDate != oldExpiry))
        {
            current.BatchNumber = req.BatchNumber; current.ExpiryDate = req.ExpiryDate; current.ManufacturedDate = req.ManufacturedDate;
        }
        try
        {
            var delta = req.Quantity - oldQty;
            if (delta > 0)
            {
                if (current is not null) await BatchStock.RestoreAsync(db, drug, current.Id, delta);
                else BatchStock.Receive(db, drug, delta, req.UnitPrice, "Manual", req.BatchNumber, req.ExpiryDate, req.ManufacturedDate);
            }
            else if (delta < 0) await BatchStock.ConsumeFifoAsync(db, drug, -delta, includeExpired: true);
            if (delta != 0)
                db.StockMovements.Add(new StockMovement { DrugId = id, MovementType = MovementType.Adjustment, Quantity = delta, ReferenceType = ReferenceType.Manual, Notes = "Quantity edited on drug record", CreatedAt = DateTime.UtcNow });
        }
        catch (InvalidOperationException ex) { return BadRequest(new { detail = ex.Message }); }
        await db.SaveChangesAsync();
        await BatchStock.SyncAsync(db, id);
        return Ok(drug);
    }

    /// <summary>All batches of a drug, oldest first (FIFO order), with what is left in each.</summary>
    [HttpGet("{id:int}/batches")]
    public async Task<IActionResult> Batches(int id, [FromQuery] bool includeEmpty = false)
    {
        var q = db.DrugBatches.Where(b => b.DrugId == id);
        if (!includeEmpty) q = q.Where(b => b.QuantityRemaining > 0);
        var today = BatchStock.Today;
        var list = await q.Fifo().ToListAsync();
        return Ok(list.Select(b => new
        {
            b.Id, b.DrugId, b.BatchNumber, b.ManufacturedDate, b.ExpiryDate, b.QuantityReceived, b.QuantityRemaining,
            b.UnitCost, b.SellingPrice, b.ReceivedAt, b.Source,
            is_expired = b.ExpiryDate != null && b.ExpiryDate < today,
        }));
    }

    [HttpGet("{id:int}/price-history")]
    public async Task<IActionResult> PriceHistory(int id) =>
        Ok(await db.PriceAdjustments.Where(p => p.DrugId == id).OrderByDescending(p => p.CreatedAt).ToListAsync());

    /// <summary>Edit one batch: selling price (manager only), batch number, expiry.</summary>
    [Authorize(Roles = R.Stock)]
    [HttpPatch("/api/drug-batches/{batchId:int}")]
    public async Task<IActionResult> UpdateBatch(int batchId, [FromBody] BatchUpdateRequest req)
    {
        var b = await db.DrugBatches.FindAsync(batchId);
        if (b is null) return NotFound();
        if (req.SellingPrice is { } price && price != b.SellingPrice)
        {
            if (!(User.IsInRole(R.PharmacyManager) || User.IsInRole(R.Admin)))
                return StatusCode(403, new { detail = "Only a Pharmacy Manager can change a selling price." });
            if (price < 0) return BadRequest(new { detail = "Selling price cannot be negative." });
            var uid = int.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var u) ? u : (int?)null;
            db.PriceAdjustments.Add(new PriceAdjustment
            {
                DrugId = b.DrugId, OldPrice = b.SellingPrice, NewPrice = price,
                Reason = $"Batch {b.BatchNumber ?? b.Id.ToString()}: {(string.IsNullOrWhiteSpace(req.Reason) ? "price updated" : req.Reason)}",
                AdjustedByUserId = uid, CreatedAt = DateTime.UtcNow,
            });
            b.SellingPrice = price;
        }
        if (req.BatchNumber is not null) b.BatchNumber = req.BatchNumber;
        if (req.ExpiryDate is not null) b.ExpiryDate = req.ExpiryDate;
        b.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await BatchStock.SyncAsync(db, b.DrugId);
        return Ok(b);
    }

    private static string? StockLevelError(DrugRequest req)
    {
        if (req.ReorderLevel < 0 || req.LowStockThreshold < 0) return "Reorder level and low stock threshold cannot be negative.";
        if (req.ReorderLevel < req.LowStockThreshold)
            return $"Reorder level ({req.ReorderLevel}) must be at least the low stock threshold ({req.LowStockThreshold}). Reorder first, critical later.";
        return null;
    }

    private static Drug MapToDrug(Drug drug, DrugRequest req)
    {
        drug.ItemCode = req.ItemCode;
        drug.BrandName = req.BrandName;
        drug.GenericName = req.GenericName;
        drug.ActiveIngredient = req.ActiveIngredient;
        drug.Description = req.Description;
        drug.Strength = req.Strength;
        drug.DosageForm = Enum.Parse<DosageForm>(req.DosageForm, true);
        drug.StorageRequirements = req.StorageRequirements;
        drug.BatchNumber = req.BatchNumber;
        drug.ManufacturedDate = req.ManufacturedDate;
        drug.ExpiryDate = req.ExpiryDate;
        drug.UnitPrice = req.UnitPrice;
        drug.Discount = req.Discount;
        drug.Quantity = req.Quantity;
        drug.PackSize = req.PackSize;
        drug.LowStockThreshold = req.LowStockThreshold;
        drug.ReorderLevel = req.ReorderLevel;
        drug.IsPrescriptionOnly = req.IsPrescriptionOnly;
        drug.IsOtc = req.IsOtc;
        drug.IsHighAlert = req.IsHighAlert;
        drug.IsNarcotic = req.IsNarcotic;
        drug.IsActive = req.IsActive;
        drug.CategoryId = req.CategoryId;
        drug.SupplierId = req.SupplierId;
        drug.UpdatedAt = DateTime.UtcNow;
        return drug;
    }
}

[ApiController]
[Route("api/drug-categories")]
[Authorize]
public class DrugCategoryController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() => Ok(await db.DrugCategories.OrderBy(c => c.Name).ToListAsync());

    [Authorize(Roles = R.Stock)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CategoryRequest req)
    {
        var cat = new DrugCategory { Name = req.Name, Description = req.Description, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        db.DrugCategories.Add(cat);
        await db.SaveChangesAsync();
        return Ok(cat);
    }

    [Authorize(Roles = R.Stock)]
    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] CategoryRequest req)
    {
        var cat = await db.DrugCategories.FindAsync(id);
        if (cat is null) return NotFound();
        cat.Name = req.Name;
        cat.Description = req.Description;
        cat.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(cat);
    }
}

public record DrugRequest(string ItemCode, string BrandName, string GenericName, string? ActiveIngredient,
    string? Description, string? Strength, string DosageForm, string? StorageRequirements,
    string? BatchNumber, DateOnly? ManufacturedDate, DateOnly? ExpiryDate, decimal UnitPrice,
    decimal Discount, int Quantity, int? PackSize, int LowStockThreshold, int ReorderLevel,
    bool IsPrescriptionOnly, bool IsOtc, bool IsHighAlert, bool IsNarcotic, bool IsActive,
    int? CategoryId, int? SupplierId, string? PriceChangeReason = null);
public record CategoryRequest(string Name, string? Description);

public record BatchUpdateRequest(decimal? SellingPrice, string? BatchNumber, DateOnly? ExpiryDate, string? Reason);
