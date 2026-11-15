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
        var q = db.Drugs.Include(d => d.Category).Include(d => d.Supplier).AsQueryable();
        if (search is not null)
            q = q.Where(d => EF.Functions.Like(d.BrandName, $"%{search}%") ||
                             EF.Functions.Like(d.GenericName, $"%{search}%") ||
                             EF.Functions.Like(d.ItemCode, $"%{search}%"));
        if (lowStock == true) q = q.Where(d => d.Quantity <= d.LowStockThreshold);
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
        var d = await db.Drugs.Include(d => d.Category).Include(d => d.Supplier).FirstOrDefaultAsync(d => d.Id == id);
        return d is null ? NotFound() : Ok(d);
    }

    [Authorize(Roles = R.Stock)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] DrugRequest req)
    {
        if (await db.Drugs.AnyAsync(d => d.ItemCode == req.ItemCode))
            return BadRequest(new { detail = "Item code already exists" });
        var drug = MapToDrug(new Drug(), req);
        drug.CreatedAt = DateTime.UtcNow;
        db.Drugs.Add(drug);
        await db.SaveChangesAsync();
        return Ok(drug);
    }

    [Authorize(Roles = R.Stock)]
    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] DrugRequest req)
    {
        var drug = await db.Drugs.FindAsync(id);
        if (drug is null) return NotFound();
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
        MapToDrug(drug, req);
        drug.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(drug);
    }

    [HttpGet("{id:int}/price-history")]
    public async Task<IActionResult> PriceHistory(int id) =>
        Ok(await db.PriceAdjustments.Where(p => p.DrugId == id).OrderByDescending(p => p.CreatedAt).ToListAsync());

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
