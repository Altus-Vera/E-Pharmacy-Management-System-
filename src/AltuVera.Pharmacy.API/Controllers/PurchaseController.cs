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
[Route("api/purchase-orders")]
[Authorize]
public class PurchaseOrderController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() =>
        Ok(await db.PurchaseOrders.Include(po => po.Supplier).Include(po => po.Items)
            .OrderByDescending(po => po.CreatedAt).ToListAsync());

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        var po = await db.PurchaseOrders.Include(po => po.Supplier)
            .Include(po => po.Items).ThenInclude(i => i.Drug)
            .FirstOrDefaultAsync(po => po.Id == id);
        return po is null ? NotFound() : Ok(po);
    }

    [Authorize(Roles = R.Stock)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] PurchaseOrderRequest req)
    {
        var userId = int.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : (int?)null;
        var po = new PurchaseOrder
        {
            OrderNumber = $"PO-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
            SupplierId = req.SupplierId,
            OrderDate = req.OrderDate,
            ExpectedDeliveryDate = req.ExpectedDeliveryDate,
            Remarks = req.Remarks,
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        foreach (var item in req.Items)
            po.Items.Add(new PurchaseOrderItem { DrugId = item.DrugId, QuantityOrdered = item.QuantityOrdered, UnitCost = item.UnitCost });
        db.PurchaseOrders.Add(po);
        await db.SaveChangesAsync();
        return Ok(po);
    }

    [Authorize(Roles = R.Stock)]
    [HttpPatch("{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] StatusRequest req)
    {
        var po = await db.PurchaseOrders.FindAsync(id);
        if (po is null) return NotFound();
        po.Status = Enum.Parse<PurchaseOrderStatus>(req.Status, true);
        po.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(po);
    }
}

[ApiController]
[Route("api/grn")]
[Authorize]
public class GoodsReceiptController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() =>
        Ok(await db.GoodsReceipts.Include(gr => gr.Supplier).Include(gr => gr.Items)
            .OrderByDescending(gr => gr.CreatedAt).ToListAsync());

    [Authorize(Roles = R.Stock)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] GrnRequest req)
    {
        var userId = int.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : (int?)null;
        var grn = new GoodsReceipt
        {
            GrnNumber = $"GRN-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
            PurchaseOrderId = req.PurchaseOrderId,
            SupplierId = req.SupplierId,
            ReceivedDate = req.ReceivedDate,
            Notes = req.Notes,
            ReceivedByUserId = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        if (req.Items is null || req.Items.Count == 0) return BadRequest(new { detail = "GRN has no items" });
        var pairs = new List<(GoodsReceiptItem Line, DrugBatch Batch)>();
        foreach (var item in req.Items)
        {
            if (item.QuantityReceived <= 0) return BadRequest(new { detail = "Received quantity must be above zero." });
            var drug = await db.Drugs.FindAsync(item.DrugId);
            if (drug is null) return BadRequest(new { detail = $"Drug {item.DrugId} not found" });
            if (item.SellingPrice is < 0) return BadRequest(new { detail = $"Selling price for {drug.BrandName} cannot be negative." });
            if (item.ExpiryDate is { } exp && exp < BatchStock.Today) return BadRequest(new { detail = $"{drug.BrandName} batch {item.BatchNumber} is already expired." });
            var price = item.SellingPrice ?? drug.UnitPrice;   // new stock may carry a new selling price
            var line = new GoodsReceiptItem
            {
                DrugId = item.DrugId, QuantityReceived = item.QuantityReceived, UnitCost = item.UnitCost, IsFreeGoods = item.IsFreeGoods,
                BatchNumber = item.BatchNumber, ExpiryDate = item.ExpiryDate, SellingPrice = price,
            };
            grn.Items.Add(line);
            var batch = BatchStock.Receive(db, drug, item.QuantityReceived, price, "GRN", item.BatchNumber, item.ExpiryDate, item.ManufacturedDate,
                item.IsFreeGoods ? 0 : item.UnitCost);
            pairs.Add((line, batch));
            db.StockMovements.Add(new StockMovement { DrugId = item.DrugId, MovementType = MovementType.Purchase, Quantity = item.QuantityReceived, UnitCost = item.UnitCost, ReferenceType = ReferenceType.GoodsReceipt, Notes = item.BatchNumber is null ? null : $"Batch {item.BatchNumber}", PerformedByUserId = userId, CreatedAt = DateTime.UtcNow });
        }
        db.GoodsReceipts.Add(grn);
        await db.SaveChangesAsync();
        foreach (var (line, batch) in pairs) { line.DrugBatchId = batch.Id; batch.GoodsReceiptItemId = line.Id; }
        await BatchStock.SyncAsync(db, req.Items.Select(i => i.DrugId).ToArray());
        return Ok(grn);
    }
}

public record PoItemRequest(int DrugId, int QuantityOrdered, decimal UnitCost);
public record PurchaseOrderRequest(int SupplierId, DateOnly OrderDate, DateOnly? ExpectedDeliveryDate, string? Remarks, List<PoItemRequest> Items);
public record GrnItemRequest(int DrugId, int QuantityReceived, decimal UnitCost, bool IsFreeGoods,
    string? BatchNumber = null, DateOnly? ExpiryDate = null, DateOnly? ManufacturedDate = null, decimal? SellingPrice = null);
public record GrnRequest(int? PurchaseOrderId, int SupplierId, DateOnly ReceivedDate, string? Notes, List<GrnItemRequest> Items);
public record StatusRequest(string Status);
