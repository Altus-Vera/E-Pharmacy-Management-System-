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
        foreach (var item in req.Items)
        {
            grn.Items.Add(new GoodsReceiptItem { DrugId = item.DrugId, QuantityReceived = item.QuantityReceived, UnitCost = item.UnitCost, IsFreeGoods = item.IsFreeGoods });
            var drug = await db.Drugs.FindAsync(item.DrugId);
            if (drug is not null) { drug.Quantity += item.QuantityReceived; drug.UpdatedAt = DateTime.UtcNow; }
            db.StockMovements.Add(new StockMovement { DrugId = item.DrugId, MovementType = MovementType.Purchase, Quantity = item.QuantityReceived, UnitCost = item.UnitCost, ReferenceType = ReferenceType.GoodsReceipt, PerformedByUserId = userId, CreatedAt = DateTime.UtcNow });
        }
        db.GoodsReceipts.Add(grn);
        await db.SaveChangesAsync();
        return Ok(grn);
    }
}

public record PoItemRequest(int DrugId, int QuantityOrdered, decimal UnitCost);
public record PurchaseOrderRequest(int SupplierId, DateOnly OrderDate, DateOnly? ExpectedDeliveryDate, string? Remarks, List<PoItemRequest> Items);
public record GrnItemRequest(int DrugId, int QuantityReceived, decimal UnitCost, bool IsFreeGoods);
public record GrnRequest(int? PurchaseOrderId, int SupplierId, DateOnly ReceivedDate, string? Notes, List<GrnItemRequest> Items);
public record StatusRequest(string Status);
