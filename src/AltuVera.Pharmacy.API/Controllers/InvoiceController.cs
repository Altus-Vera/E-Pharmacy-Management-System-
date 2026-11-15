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

    [Authorize(Roles = R.Pos)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] InvoiceCreateRequest req)
    {
        var userId = int.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : (int?)null;

        if (req.Items is null || req.Items.Count == 0)
            return BadRequest(new { detail = "Invoice has no items" });

        // Check stock, expiry and regulatory flags
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        bool anyRegulated = false, anyHighAlert = false, anyNarcotic = false;
        foreach (var g in req.Items.GroupBy(i => i.DrugId))
        {
            var drug = await db.Drugs.FindAsync(g.Key);
            if (drug is null) return BadRequest(new { detail = $"Drug {g.Key} not found" });
            if (g.Any(i => i.Quantity <= 0)) return BadRequest(new { detail = $"Invalid quantity for {drug.BrandName}" });
            var sellable = await BatchStock.SellableAsync(db, drug.Id);
            if (sellable.Sum(b => b.QuantityRemaining) < g.Sum(i => i.Quantity))
                return BadRequest(new { detail = $"Insufficient stock for {drug.BrandName}: {sellable.Sum(b => b.QuantityRemaining)} sellable (expired batches excluded)" });
            foreach (var bg in g.Where(i => i.DrugBatchId != null).GroupBy(i => i.DrugBatchId))
            {
                var batch = sellable.FirstOrDefault(b => b.Id == bg.Key);
                if (batch is null) return BadRequest(new { detail = $"{drug.BrandName}: the selected batch is sold out or expired. Re-add the item." });
                if (batch.QuantityRemaining < bg.Sum(i => i.Quantity))
                    return BadRequest(new { detail = $"{drug.BrandName} batch {batch.BatchNumber}: only {batch.QuantityRemaining} left. Re-add the item." });
                if (bg.Any(i => Math.Abs(i.UnitPrice - batch.SellingPrice) > 0.005m))
                    return BadRequest(new { detail = $"{drug.BrandName} batch {batch.BatchNumber} is now priced Rs. {batch.SellingPrice:0.00}. Re-add the item." });
            }
        }
        foreach (var item in req.Items)
        {
            var drug = (await db.Drugs.FindAsync(item.DrugId))!;
            if (!drug.IsActive) return BadRequest(new { detail = $"{drug.BrandName} is inactive" });
            if (drug.IsPrescriptionOnly || drug.IsHighAlert || drug.IsNarcotic) anyRegulated = true;
            if (drug.IsHighAlert) anyHighAlert = true;
            if (drug.IsNarcotic) anyNarcotic = true;
        }

        // Requirements: customer mandatory and scanned prescription required for POM / High Alert / Narcotic
        Customer? customer = null;
        if (req.CustomerId is not null)
        {
            customer = await db.Customers.FindAsync(req.CustomerId);
            if (customer is null) return BadRequest(new { detail = "Customer not found" });
        }
        if (anyRegulated)
        {
            if (customer is null)
                return BadRequest(new { detail = "A customer must be linked when selling POM, High Alert or Narcotic drugs." });
            if (req.PrescriptionId is null)
                return BadRequest(new { detail = "A prescription must be linked when selling POM, High Alert or Narcotic drugs." });
            var rx = await db.Prescriptions.FindAsync(req.PrescriptionId);
            if (rx is null || !rx.IsActive) return BadRequest(new { detail = "Prescription not found or inactive." });
            if (rx.CustomerId != customer.Id) return BadRequest(new { detail = "The prescription belongs to a different customer." });
            if (string.IsNullOrEmpty(rx.ScanFilePath))
                return BadRequest(new { detail = "The prescription has no scanned copy. Upload the scan before dispensing." });
            var validUntil = rx.IssueDate.AddDays(rx.ValidDays ?? 0).AddMonths(rx.ValidMonths ?? 0);
            if ((rx.ValidDays ?? 0) == 0 && (rx.ValidMonths ?? 0) == 0) validUntil = rx.IssueDate.AddMonths(1);
            if (today > validUntil)
                return BadRequest(new { detail = $"The prescription expired on {validUntil:yyyy-MM-dd}." });
            if (rx.ReproduceType == ReproduceType.OneTime &&
                await db.Invoices.AnyAsync(i => i.PrescriptionId == rx.Id && i.Status != InvoiceStatus.Cancelled))
                return BadRequest(new { detail = "This one-time prescription has already been dispensed." });
        }
        if (anyNarcotic && req.DoctorId is null)
            return BadRequest(new { detail = "Narcotic drugs need the prescribing doctor (SLMC registered) to be linked." });
        if (req.DoctorId is not null)
        {
            var doc = await db.Doctors.FindAsync(req.DoctorId);
            if (doc is null) return BadRequest(new { detail = "Doctor not found" });
            if (anyNarcotic && string.IsNullOrWhiteSpace(doc.SlmcRegNo))
                return BadRequest(new { detail = "The doctor has no SLMC Registration Number on record." });
        }

        // High Alert / Narcotic: prescription must be validated and confirmed by a pharmacist
        int? verifiedBy = null;
        if (anyHighAlert || anyNarcotic)
        {
            if (!string.IsNullOrWhiteSpace(req.VerifierUsername))
            {
                var v = await db.Users.FirstOrDefaultAsync(u => u.Username == req.VerifierUsername && u.IsActive);
                if (v is null || v.UserType == UserType.StockManager || !BCrypt.Net.BCrypt.Verify(req.VerifierPassword ?? "", v.HashedPassword))
                    return BadRequest(new { detail = "Pharmacist verification failed." });
                verifiedBy = v.Id;
            }
            else if (req.PharmacistVerified == true && userId is not null)
                verifiedBy = userId;
            else
                return BadRequest(new { detail = "High Alert / Narcotic items must be verified by a pharmacist." });
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
            VerifiedByUserId = verifiedBy,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        foreach (var item in req.Items)
        {
            var drug = (await db.Drugs.FindAsync(item.DrugId))!;
            int? batchId;
            if (item.DrugBatchId is not null)
            {
                var batch = await db.DrugBatches.FirstAsync(b => b.Id == item.DrugBatchId);
                BatchStock.Take(batch, drug, item.Quantity);
                batchId = batch.Id;
            }
            else
            {
                var taken = await BatchStock.ConsumeFifoAsync(db, drug, item.Quantity);
                batchId = taken[0].Batch.Id;
            }

            invoice.Items.Add(new InvoiceItem
            {
                DrugId = item.DrugId,
                DrugBatchId = batchId,
                Quantity = item.Quantity,
                UnitPrice = item.UnitPrice,
                DiscountRate = item.DiscountRate,
                DiscountAmount = item.DiscountAmount,
                LineTotal = item.LineTotal,
            });

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

        // Loyalty: 1 point per Rs. 100 spent
        if (customer is not null && req.TotalAmount > 0)
        {
            var pts = (int)Math.Floor(req.TotalAmount / 100m);
            invoice.LoyaltyPointsEarned = pts;
            customer.LoyaltyPoints += pts;
            customer.UpdatedAt = DateTime.UtcNow;
        }

        db.Invoices.Add(invoice);
        await db.SaveChangesAsync();
        await BatchStock.SyncAsync(db, req.Items.Select(i => i.DrugId).ToArray());
        return Ok(invoice);
    }

    [Authorize(Roles = R.Pos)]
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

        if (invoice.CustomerId is not null && invoice.LoyaltyPointsEarned > 0)
        {
            var c = await db.Customers.FindAsync(invoice.CustomerId);
            if (c is not null) { c.LoyaltyPoints = Math.Max(0, c.LoyaltyPoints - invoice.LoyaltyPointsEarned); c.UpdatedAt = DateTime.UtcNow; }
        }

        foreach (var item in invoice.Items)
        {
            var drug = await db.Drugs.FindAsync(item.DrugId);
            if (drug is not null) await BatchStock.RestoreAsync(db, drug, item.DrugBatchId, item.Quantity);
        }

        await db.SaveChangesAsync();
        await BatchStock.SyncAsync(db, invoice.Items.Select(i => i.DrugId).ToArray());
        return Ok(invoice);
    }
}

public record InvoiceItemRequest(int DrugId, int Quantity, decimal UnitPrice, decimal DiscountRate, decimal DiscountAmount, decimal LineTotal, int? DrugBatchId = null);
public record InvoiceCreateRequest(int? CustomerId, int? DoctorId, int? PrescriptionId,
    decimal Subtotal, decimal DiscountAmount, decimal TaxRate, decimal TaxAmount, decimal TotalAmount,
    string PaymentMode, string? Notes, List<InvoiceItemRequest> Items,
    bool? PharmacistVerified = null, string? VerifierUsername = null, string? VerifierPassword = null);
public record CancelRequest(string? Reason);
