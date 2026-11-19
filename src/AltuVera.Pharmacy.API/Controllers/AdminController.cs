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
[Route("api/audit-logs")]
[Authorize(Roles = R.Manager)]
public class AuditLogController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] int? userId, [FromQuery] string? entity, [FromQuery] int take = 500)
    {
        var q = db.AuditLogs.AsQueryable();
        if (from is not null) q = q.Where(a => a.CreatedAt >= from);
        if (to is not null) q = q.Where(a => a.CreatedAt < to.Value.Date.AddDays(1));
        if (userId is not null) q = q.Where(a => a.UserId == userId);
        if (!string.IsNullOrWhiteSpace(entity)) q = q.Where(a => a.EntityType == entity);
        var logs = await q.OrderByDescending(a => a.CreatedAt).Take(Math.Clamp(take, 1, 5000)).ToListAsync();
        var users = await db.Users.ToDictionaryAsync(u => u.Id, u => u.Name);
        return Ok(logs.Select(a => new
        {
            a.Id, a.UserId, user_name = a.UserId is int id && users.TryGetValue(id, out var n) ? n : null,
            a.Action, a.EntityType, a.EntityId, a.NewValue, a.IpAddress, a.CreatedAt,
        }));
    }
}

[ApiController]
[Route("api/supplier-returns")]
[Authorize]
public class SupplierReturnController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() =>
        Ok(await db.SupplierReturns.Include(r => r.Supplier).Include(r => r.Drug)
            .OrderByDescending(r => r.CreatedAt).ToListAsync());

    /// <summary>Return goods to a supplier: reduces stock and writes a stock movement.</summary>
    [Authorize(Roles = R.Stock)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SupplierReturnRequest req)
    {
        if (req.Quantity <= 0) return BadRequest(new { detail = "Quantity must be above zero." });
        var drug = await db.Drugs.FindAsync(req.DrugId);
        if (drug is null) return NotFound(new { detail = "Drug not found" });
        if (!await db.Suppliers.AnyAsync(s => s.Id == req.SupplierId)) return NotFound(new { detail = "Supplier not found" });

        var userId = int.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : (int?)null;
        var ret = new SupplierReturn
        {
            ReturnNumber = $"SRN-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
            SupplierId = req.SupplierId, DrugId = req.DrugId, Quantity = req.Quantity,
            UnitCost = req.UnitCost, Reason = req.Reason, ProcessedByUserId = userId,
            CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
        };
        try
        {
            if (req.DrugBatchId is not null)
            {
                var b = await db.DrugBatches.FirstOrDefaultAsync(x => x.Id == req.DrugBatchId && x.DrugId == drug.Id);
                if (b is null) return BadRequest(new { detail = "Batch not found for this drug" });
                BatchStock.Take(b, drug, req.Quantity);
            }
            else await BatchStock.ConsumeFifoAsync(db, drug, req.Quantity, includeExpired: true);
        }
        catch (InvalidOperationException ex) { return BadRequest(new { detail = ex.Message }); }
        db.SupplierReturns.Add(ret);
        db.StockMovements.Add(new StockMovement
        {
            DrugId = req.DrugId, MovementType = MovementType.ReturnToSupplier, Quantity = -req.Quantity,
            UnitCost = req.UnitCost, ReferenceType = ReferenceType.SupplierReturn, Notes = req.Reason,
            PerformedByUserId = userId, CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();
        await BatchStock.SyncAsync(db, drug.Id);
        return Ok(ret);
    }
}

[ApiController]
[Route("api/admin")]
[Authorize(Roles = R.Admin)]
public class SystemAdminController(AppDbContext db) : ControllerBase
{
    /// <summary>Full SQL Server backup into the server's default backup folder. Never modifies data.</summary>
    [HttpPost("backup")]
    public async Task<IActionResult> Backup()
    {
        var dbName = db.Database.GetDbConnection().Database;
        var file = $"{dbName}_{DateTime.Now:yyyyMMdd_HHmmss}.bak";
        db.Database.SetCommandTimeout(600);
        await db.Database.ExecuteSqlAsync($"BACKUP DATABASE {dbName} TO DISK = {file} WITH INIT, NAME = N'AltusVera backup', STATS = 10");
        return Ok(new { file, database = dbName, created_at = DateTime.Now, message = "Backup written to the SQL Server default backup folder." });
    }

    [HttpGet("backups")]
    public async Task<IActionResult> Backups()
    {
        var dbName = db.Database.GetDbConnection().Database;
        var rows = await db.Database.SqlQueryRaw<BackupRow>(
            "SELECT TOP 50 b.backup_finish_date AS FinishedAt, m.physical_device_name AS Device, CAST(b.backup_size AS bigint) AS SizeBytes " +
            "FROM msdb.dbo.backupset b JOIN msdb.dbo.backupmediafamily m ON b.media_set_id = m.media_set_id " +
            "WHERE b.database_name = {0} ORDER BY b.backup_finish_date DESC", dbName).ToListAsync();
        return Ok(rows);
    }
}

public record SupplierReturnRequest(int SupplierId, int DrugId, int Quantity, decimal UnitCost, string? Reason, int? DrugBatchId = null);
public class BackupRow
{
    public DateTime? FinishedAt { get; set; }
    public string? Device { get; set; }
    public long? SizeBytes { get; set; }
}
