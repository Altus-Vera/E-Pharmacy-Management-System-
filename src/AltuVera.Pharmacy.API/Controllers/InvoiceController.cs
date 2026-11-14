using AltuVera.Pharmacy.Domain.Entities;
using AltuVera.Pharmacy.Domain.Enums;
using AltuVera.Pharmacy.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.Pharmacy.API.Controllers;

[ApiController]
[Route("api/invoices")]
[Authorize]
public class InvoiceController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int? customerId, [FromQuery] string? status,
        [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var q = db.Invoices.Include(i => i.Customer).Include(i => i.Items).AsQueryable();
        if (customerId.HasValue) q = q.Where(i => i.CustomerId == customerId);
        if (status is not null) q = q.Where(i => i.Status.ToString().ToLower() == status.ToLower());
        if (from.HasValue) q = q.Where(i => i.CreatedAt >= from);
        if (to.HasValue) q = q.Where(i => i.CreatedAt <= to);
        return Ok(await q.OrderByDescending(i => i.CreatedAt).ToListAsync());
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        var inv = await db.Invoices
            .Include(i => i.Customer).Include(i => i.Doctor).Include(i => i.Prescription)
            .Include(i => i.Items).ThenInclude(ii => ii.Drug)
            .FirstOrDefaultAsync(i => i.Id == id);
        return inv is null ? NotFound() : Ok(inv);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] InvoiceCreateRequest req)
    {
        var userId = int.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : (int?)null;

        // Check stock
        foreach (var item in req.Items)
        {
            var drug = await db.Drugs.FindAsync(item.DrugId);
            if (drug is null) return BadRequest(new { detail = $"Drug {item.DrugId} not found" });
            if (drug.Quantity < item.Quantity)
                return BadRequest(new { detail = $"Insufficient stock for {drug.BrandName}" });
        }

        var invoiceNumber = $"INV-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        var invoice = new Invoice
        {
            InvoiceNumber = invoiceNumber,
            CustomerId = req.CustomerId,
            DoctorId = req.DoctorId,
            PrescriptionId = req.PrescriptionId,
            Subtotal = req.Subtotal,
            DiscountAmount = req.DiscountAmount,
            TaxRate = req.TaxRate,
            TaxAmount = req.TaxAmount,
            TotalAmount = req.TotalAmount,
            PaymentMode = Enum.Parse<PaymentMode>(req.PaymentMode, true),
            Notes = req.Notes,
            ServedByUserId = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        foreach (var item in req.Items)
        {
            invoice.Items.Add(new InvoiceItem
            {
                DrugId = item.DrugId,
                Quantity = item.Quantity,
                UnitPrice = item.UnitPrice,
                DiscountRate = item.DiscountRate,
                DiscountAmount = item.DiscountAmount,
                LineTotal = item.LineTotal,
            });

            var drug = await db.Drugs.FindAsync(item.DrugId);
            drug!.Quantity -= item.Quantity;
            drug.UpdatedAt = DateTime.UtcNow;

            db.StockMovements.Add(new StockMovement
            {
                DrugId = item.DrugId,
                MovementType = MovementType.Sale,
                Quantity = -item.Quantity,
                ReferenceType = ReferenceType.Invoice,
                PerformedByUserId = userId,
                CreatedAt = DateTime.UtcNow,
            });
        }

        db.Invoices.Add(invoice);
        await db.SaveChangesAsync();
        return Ok(invoice);
    }

    [HttpPost("{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, [FromBody] CancelRequest req)
    {
        var invoice = await db.Invoices.Include(i => i.Items).FirstOrDefaultAsync(i => i.Id == id);
        if (invoice is null) return NotFound();
        if (invoice.Status == InvoiceStatus.Cancelled)
            return BadRequest(new { detail = "Invoice already cancelled" });

        invoice.Status = InvoiceStatus.Cancelled;
        invoice.CancelledAt = DateTime.UtcNow;
        invoice.CancellationReason = req.Reason;
        invoice.UpdatedAt = DateTime.UtcNow;

        foreach (var item in invoice.Items)
        {
            var drug = await db.Drugs.FindAsync(item.DrugId);
            if (drug is not null) { drug.Quantity += item.Quantity; drug.UpdatedAt = DateTime.UtcNow; }
        }

        await db.SaveChangesAsync();
        return Ok(invoice);
    }
}

public record InvoiceItemRequest(int DrugId, int Quantity, decimal UnitPrice, decimal DiscountRate, decimal DiscountAmount, decimal LineTotal);
public record InvoiceCreateRequest(int? CustomerId, int? DoctorId, int? PrescriptionId,
    decimal Subtotal, decimal DiscountAmount, decimal TaxRate, decimal TaxAmount, decimal TotalAmount,
    string PaymentMode, string? Notes, List<InvoiceItemRequest> Items);
public record CancelRequest(string? Reason);
