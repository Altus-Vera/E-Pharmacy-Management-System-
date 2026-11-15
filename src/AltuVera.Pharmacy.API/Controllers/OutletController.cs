using AltuVera.Pharmacy.API.Security;
using AltuVera.Pharmacy.Domain.Entities;
using AltuVera.Pharmacy.Domain.Enums;
using AltuVera.Pharmacy.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.Pharmacy.API.Controllers;

[ApiController]
[Route("api/outlets")]
[Authorize]
public class OutletController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() => Ok(await db.Outlets.OrderBy(o => o.Name).ToListAsync());

    [Authorize(Roles = R.Manager)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] OutletRequest req)
    {
        var outlet = new Outlet { Name = req.Name, Code = req.Code, Address = req.Address, ContactNumber = req.ContactNumber, ManagerName = req.ManagerName, IsHeadOffice = req.IsHeadOffice, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        db.Outlets.Add(outlet);
        await db.SaveChangesAsync();
        return Ok(outlet);
    }

    [Authorize(Roles = R.Manager)]
    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] OutletRequest req)
    {
        var outlet = await db.Outlets.FindAsync(id);
        if (outlet is null) return NotFound();
        outlet.Name = req.Name; outlet.Address = req.Address; outlet.ContactNumber = req.ContactNumber;
        outlet.ManagerName = req.ManagerName; outlet.IsHeadOffice = req.IsHeadOffice; outlet.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(outlet);
    }
}

[ApiController]
[Route("api/stock-transfers")]
[Authorize]
public class StockTransferController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() =>
        Ok(await db.StockTransfers.Include(t => t.FromOutlet).Include(t => t.ToOutlet).Include(t => t.Drug)
            .OrderByDescending(t => t.CreatedAt).ToListAsync());

    [Authorize(Roles = R.Stock)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] TransferRequest req)
    {
        var userId = int.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : (int?)null;
        var transfer = new StockTransfer
        {
            TransferNumber = $"TRF-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
            FromOutletId = req.FromOutletId, ToOutletId = req.ToOutletId, DrugId = req.DrugId,
            Quantity = req.Quantity, Notes = req.Notes, RequestedByUserId = userId,
            CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
        };
        db.StockTransfers.Add(transfer);
        await db.SaveChangesAsync();
        return Ok(transfer);
    }

    [Authorize(Roles = R.Stock)]
    [HttpPatch("{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] StatusRequest req)
    {
        var userId = int.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : (int?)null;
        var transfer = await db.StockTransfers.Include(t => t.Drug).FirstOrDefaultAsync(t => t.Id == id);
        if (transfer is null) return NotFound();

        var newStatus = Enum.Parse<TransferStatus>(req.Status, true);
        if (newStatus == TransferStatus.Received && transfer.Status != TransferStatus.Received)
        {
            if (transfer.Drug.Quantity < transfer.Quantity)
                return BadRequest(new { detail = "Insufficient stock for transfer" });
            transfer.Drug.Quantity -= transfer.Quantity;
            transfer.Drug.UpdatedAt = DateTime.UtcNow;
            transfer.ApprovedByUserId = userId;
        }
        transfer.Status = newStatus;
        transfer.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(transfer);
    }
}

[ApiController]
[Route("api/stock-adjustments")]
[Authorize]
public class StockAdjustmentController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() =>
        Ok(await db.StockAdjustments.Include(a => a.Drug).OrderByDescending(a => a.CreatedAt).ToListAsync());

    [Authorize(Roles = R.Stock)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] AdjustmentRequest req)
    {
        var userId = int.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : (int?)null;
        var drug = await db.Drugs.FindAsync(req.DrugId);
        if (drug is null) return NotFound(new { detail = "Drug not found" });

        var adjType = Enum.Parse<AdjustmentType>(req.AdjustmentType, true);
        if (adjType == AdjustmentType.Decrease && drug.Quantity < req.Quantity)
            return BadRequest(new { detail = "Insufficient stock" });

        var adj = new StockAdjustment
        {
            AdjustmentNumber = $"ADJ-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
            DrugId = req.DrugId, Quantity = req.Quantity, AdjustmentType = adjType,
            Reason = req.Reason, AdjustedByUserId = userId, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
        };
        drug.Quantity += adjType == AdjustmentType.Increase ? req.Quantity : -req.Quantity;
        drug.UpdatedAt = DateTime.UtcNow;

        db.StockAdjustments.Add(adj);
        db.StockMovements.Add(new StockMovement { DrugId = req.DrugId, MovementType = MovementType.Adjustment, Quantity = adjType == AdjustmentType.Increase ? req.Quantity : -req.Quantity, ReferenceType = ReferenceType.Manual, Notes = req.Reason, PerformedByUserId = userId, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
        return Ok(adj);
    }
}

[ApiController]
[Route("api/stock-locations")]
[Authorize]
public class StockLocationController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() => Ok(await db.StockLocations.OrderBy(l => l.Name).ToListAsync());

    [Authorize(Roles = R.Stock)]
    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] LocationUpdateRequest req)
    {
        var loc = await db.StockLocations.FindAsync(id);
        if (loc is null) return NotFound();
        if (!string.IsNullOrWhiteSpace(req.Name)) loc.Name = req.Name;
        if (req.Description is not null) loc.Description = req.Description;
        if (req.IsActive is not null) loc.IsActive = req.IsActive.Value;
        loc.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(loc);
    }

    [Authorize(Roles = R.Stock)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] LocationRequest req)
    {
        var loc = new StockLocation { Name = req.Name, Description = req.Description, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        db.StockLocations.Add(loc);
        await db.SaveChangesAsync();
        return Ok(loc);
    }
}

[ApiController]
[Route("api/uom")]
[Authorize]
public class UomController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() => Ok(await db.UnitsOfMeasure.OrderBy(u => u.Name).ToListAsync());

    [Authorize(Roles = R.Stock)]
    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UomUpdateRequest req)
    {
        var uom = await db.UnitsOfMeasure.FindAsync(id);
        if (uom is null) return NotFound();
        if (!string.IsNullOrWhiteSpace(req.Name)) uom.Name = req.Name;
        if (req.Abbreviation is not null) uom.Abbreviation = req.Abbreviation;
        if (req.IsActive is not null) uom.IsActive = req.IsActive.Value;
        uom.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(uom);
    }

    [Authorize(Roles = R.Stock)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UomRequest req)
    {
        var uom = new UnitOfMeasure { Name = req.Name, Abbreviation = req.Abbreviation, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        db.UnitsOfMeasure.Add(uom);
        await db.SaveChangesAsync();
        return Ok(uom);
    }
}

public record OutletRequest(string Name, string Code, string? Address, string? ContactNumber, string? ManagerName, bool IsHeadOffice);
public record TransferRequest(int FromOutletId, int ToOutletId, int DrugId, int Quantity, string? Notes);
public record AdjustmentRequest(int DrugId, int Quantity, string AdjustmentType, string Reason);
public record LocationRequest(string Name, string? Description);
public record UomRequest(string Name, string? Abbreviation);
public record LocationUpdateRequest(string? Name, string? Description, bool? IsActive);
public record UomUpdateRequest(string? Name, string? Abbreviation, bool? IsActive);

[ApiController]
[Route("api/stock-movements")]
[Authorize]
public class StockMovementController(AppDbContext db) : ControllerBase
{
    // Read-only stock ledger, optionally filtered by drug.
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int? drugId, [FromQuery] int take = 200)
    {
        var q = db.StockMovements.AsQueryable();
        if (drugId is not null) q = q.Where(m => m.DrugId == drugId);
        return Ok(await q.OrderByDescending(m => m.CreatedAt).Take(Math.Clamp(take, 1, 1000)).ToListAsync());
    }
}
