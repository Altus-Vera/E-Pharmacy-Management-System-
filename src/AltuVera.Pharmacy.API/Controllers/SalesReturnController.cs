using AltuVera.Pharmacy.API.Security;
using AltuVera.Pharmacy.Domain.Entities;
using AltuVera.Pharmacy.Domain.Enums;
using AltuVera.Pharmacy.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.Pharmacy.API.Controllers;

[ApiController]
[Route("api/sales-returns")]
[Authorize]
public class SalesReturnController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() =>
        Ok(await db.SalesReturns.Include(r => r.Invoice).Include(r => r.Drug)
            .OrderByDescending(r => r.CreatedAt).ToListAsync());

    [Authorize(Roles = R.Pos)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SalesReturnRequest req)
    {
        var userId = int.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : (int?)null;
        var ret = new SalesReturn
        {
            ReturnNumber = $"RET-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
            InvoiceId = req.InvoiceId,
            DrugId = req.DrugId,
            Quantity = req.Quantity,
            RefundAmount = req.RefundAmount,
            Reason = Enum.Parse<SalesReturnReason>(req.Reason, true),
            Notes = req.Notes,
            ProcessedByUserId = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.SalesReturns.Add(ret);
        await db.SaveChangesAsync();
        return Ok(ret);
    }

    [Authorize(Roles = R.Manager)]
    [HttpPatch("{id:int}/approve")]
    public async Task<IActionResult> Approve(int id)
    {
        var ret = await db.SalesReturns.Include(r => r.Drug).FirstOrDefaultAsync(r => r.Id == id);
        if (ret is null) return NotFound();
        ret.Status = SalesReturnStatus.Approved;
        ret.Drug.Quantity += ret.Quantity;
        ret.Drug.UpdatedAt = DateTime.UtcNow;
        ret.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(ret);
    }
}

[ApiController]
[Route("api/purchase-requisitions")]
[Authorize]
public class PurchaseRequisitionController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() =>
        Ok(await db.PurchaseRequisitions.Include(r => r.Drug).OrderByDescending(r => r.CreatedAt).ToListAsync());

    [Authorize(Roles = R.Stock)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] RequisitionRequest req)
    {
        var userId = int.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : (int?)null;
        var req2 = new PurchaseRequisition
        {
            RequisitionNumber = $"REQ-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
            DrugId = req.DrugId,
            QuantityRequested = req.QuantityRequested,
            Notes = req.Notes,
            RequestedByUserId = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.PurchaseRequisitions.Add(req2);
        await db.SaveChangesAsync();
        return Ok(req2);
    }

    [Authorize(Roles = R.Manager)]
    [HttpPatch("{id:int}/approve")]
    public async Task<IActionResult> Approve(int id)
    {
        var userId = int.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : (int?)null;
        var req = await db.PurchaseRequisitions.FindAsync(id);
        if (req is null) return NotFound();
        req.Status = "approved";
        req.ApprovedByUserId = userId;
        req.ApprovedAt = DateTime.UtcNow;
        req.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(req);
    }
}

[ApiController]
[Route("api/purchase-invoices")]
[Authorize]
public class PurchaseInvoiceController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() =>
        Ok(await db.PurchaseInvoices.Include(i => i.Supplier).OrderByDescending(i => i.CreatedAt).ToListAsync());

    [Authorize(Roles = R.Stock)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] PurchaseInvoiceRequest req)
    {
        var inv = new PurchaseInvoice
        {
            InvoiceNumber = req.InvoiceNumber,
            SupplierId = req.SupplierId,
            GoodsReceiptId = req.GoodsReceiptId,
            InvoiceDate = req.InvoiceDate,
            TotalAmount = req.TotalAmount,
            Notes = req.Notes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.PurchaseInvoices.Add(inv);
        await db.SaveChangesAsync();
        return Ok(inv);
    }

    [Authorize(Roles = R.Manager)]
    [HttpPatch("{id:int}/pay")]
    public async Task<IActionResult> MarkPaid(int id)
    {
        var inv = await db.PurchaseInvoices.FindAsync(id);
        if (inv is null) return NotFound();
        inv.IsPaid = true;
        inv.PaidAt = DateTime.UtcNow;
        inv.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(inv);
    }
}

public record SalesReturnRequest(int InvoiceId, int DrugId, int Quantity, decimal RefundAmount, string Reason, string? Notes);
public record RequisitionRequest(int DrugId, int QuantityRequested, string? Notes);
public record PurchaseInvoiceRequest(string InvoiceNumber, int SupplierId, int? GoodsReceiptId, DateOnly InvoiceDate, decimal TotalAmount, string? Notes);
