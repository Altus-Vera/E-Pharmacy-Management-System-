using System.Security.Claims;
using AltuVera.Pharmacy.API.Security;
using AltuVera.Pharmacy.API.Services;
using AltuVera.Pharmacy.Domain.Entities;
using AltuVera.Pharmacy.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.Pharmacy.API.Controllers;

/// <summary>
/// Optional prescription copies kept with POS bills, numbered in a daily queue.
/// Files are served only through this controller (signed-in staff), never from the public uploads folder.
/// </summary>
[ApiController]
[Authorize(Roles = R.Pos)]
public class BillPrescriptionController(AppDbContext db, IWebHostEnvironment env) : ControllerBase
{
    private static readonly Dictionary<string, string> Types = new()
    {
        ["image/jpeg"] = ".jpg", ["image/png"] = ".png", ["image/webp"] = ".webp", ["application/pdf"] = ".pdf",
    };
    private string Dir => Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", "private-uploads", "bill-rx"));
    private int? UserId => int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var u) ? u : null;

    /// <summary>Attach 1–4 photos/PDF pages of the prescription to a bill. Adds pages if the bill already has a copy.</summary>
    [HttpPost("api/invoices/{invoiceId:int}/rx-copy")]
    [RequestSizeLimit(30_000_000)]
    public async Task<IActionResult> Attach(int invoiceId, [FromForm] List<IFormFile> files, [FromForm] string? note, CancellationToken ct)
    {
        var inv = await db.Invoices.FindAsync([invoiceId], ct);
        if (inv is null) return NotFound(new { detail = "Bill not found." });
        if (files.Count is 0 or > 4) return BadRequest(new { detail = "Attach 1 to 4 pages of the prescription." });
        var pages = new List<(byte[] Bytes, string Type)>();
        foreach (var f in files)
        {
            if (f.Length > 8_000_000) return BadRequest(new { detail = $"{f.FileName} is over 8 MB." });
            var bytes = await FileSniffer.ReadAllAsync(f, ct);
            var type = FileSniffer.Detect(bytes);
            if (type is null || !Types.ContainsKey(type)) return BadRequest(new { detail = $"{f.FileName}: use a JPG, PNG or WebP photo, or a PDF." });
            pages.Add((bytes, type));
        }

        Directory.CreateDirectory(Dir);
        var saved = new List<string>();
        foreach (var (bytes, type) in pages)
        {
            var name = $"{Guid.NewGuid():N}{Types[type]}";
            await System.IO.File.WriteAllBytesAsync(Path.Combine(Dir, name), bytes, ct);
            saved.Add(name);
        }

        var existing = await db.BillPrescriptions.FirstOrDefaultAsync(b => b.InvoiceId == invoiceId, ct);
        if (existing is not null)
        {
            var all = existing.Files.Split('|', StringSplitOptions.RemoveEmptyEntries).Concat(saved).ToList();
            existing.Files = string.Join('|', all);
            if (!string.IsNullOrWhiteSpace(note)) existing.Note = note.Trim();
            await db.SaveChangesAsync(ct);
            return Ok(await ViewOne(existing.Id));
        }

        var shiftId = UserId is { } u ? (await ShiftTotals.OpenForAsync(db, u))?.Id : null;
        // the bill's own (local) day, so a copy attached later still files with that day's bills
        var today = DateOnly.FromDateTime(DateTime.SpecifyKind(inv.CreatedAt, DateTimeKind.Utc).ToLocalTime());
        // next number in today's queue; the unique index catches two tills saving at the same moment
        for (var attempt = 0; ; attempt++)
        {
            var next = (await db.BillPrescriptions.Where(b => b.QueueDate == today).MaxAsync(b => (int?)b.QueueNumber, ct) ?? 0) + 1;
            var row = new BillPrescription
            {
                InvoiceId = invoiceId, QueueDate = today, QueueNumber = next, Files = string.Join('|', saved),
                Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(), UploadedByUserId = UserId, ShiftId = shiftId, CreatedAt = DateTime.UtcNow,
            };
            db.BillPrescriptions.Add(row);
            try { await db.SaveChangesAsync(ct); return Ok(await ViewOne(row.Id)); }
            catch (DbUpdateException) when (attempt < 4) { db.Entry(row).State = EntityState.Detached; }
        }
    }

    /// <summary>The prescription queue for one day (default today), in queue order.</summary>
    [HttpGet("api/bill-rx")]
    public async Task<IActionResult> List([FromQuery] DateOnly? date, [FromQuery] string? search)
    {
        var day = date ?? DateOnly.FromDateTime(DateTime.Now);
        var q = db.BillPrescriptions.Where(b => b.QueueDate == day);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var t = search.Trim();
            q = q.Where(b => b.Invoice.InvoiceNumber.Contains(t) || (b.Invoice.Customer != null && b.Invoice.Customer.Name.Contains(t)) || (b.Note != null && b.Note.Contains(t)));
        }
        var ids = await q.OrderBy(b => b.QueueNumber).Select(b => b.Id).ToListAsync();
        var outp = new List<object>();
        foreach (var id in ids) outp.Add(await ViewOne(id));
        return Ok(outp);
    }

    /// <summary>Queue entry for one bill (null when the bill has no prescription copy).</summary>
    [HttpGet("api/invoices/{invoiceId:int}/rx-copy")]
    public async Task<IActionResult> ForInvoice(int invoiceId)
    {
        var id = await db.BillPrescriptions.Where(b => b.InvoiceId == invoiceId).Select(b => (int?)b.Id).FirstOrDefaultAsync();
        return Ok(new { rx_copy = id is null ? null : await ViewOne(id.Value) });
    }

    [HttpGet("api/bill-rx/{id:int}/files/{n:int}")]
    public async Task<IActionResult> File(int id, int n)
    {
        var b = await db.BillPrescriptions.FindAsync(id);
        if (b is null) return NotFound();
        var files = b.Files.Split('|', StringSplitOptions.RemoveEmptyEntries);
        if (n < 0 || n >= files.Length) return NotFound();
        var path = Path.Combine(Dir, Path.GetFileName(files[n]));
        if (!System.IO.File.Exists(path)) return NotFound();
        var type = Types.FirstOrDefault(kv => path.EndsWith(kv.Value, StringComparison.OrdinalIgnoreCase)).Key ?? "application/octet-stream";
        return PhysicalFile(path, type);
    }

    private async Task<object> ViewOne(int id)
    {
        var b = await db.BillPrescriptions.AsNoTracking()
            .Include(x => x.Invoice).ThenInclude(i => i.Customer)
            .Include(x => x.Invoice).ThenInclude(i => i.Doctor)
            .FirstAsync(x => x.Id == id);
        var by = b.UploadedByUserId is { } u ? await db.Users.Where(x => x.Id == u).Select(x => x.Name).FirstOrDefaultAsync() : null;
        var files = b.Files.Split('|', StringSplitOptions.RemoveEmptyEntries);
        return new
        {
            b.Id, b.QueueDate, b.QueueNumber, b.Note, b.ShiftId,
            CreatedAt = DateTime.SpecifyKind(b.CreatedAt, DateTimeKind.Utc),
            UploadedBy = by,
            b.InvoiceId, b.Invoice.InvoiceNumber, InvoiceTotal = b.Invoice.TotalAmount,
            InvoiceStatus = b.Invoice.Status.ToString().ToLowerInvariant(),
            InvoiceAt = DateTime.SpecifyKind(b.Invoice.CreatedAt, DateTimeKind.Utc),
            CustomerName = b.Invoice.Customer?.Name, DoctorName = b.Invoice.Doctor?.Name,
            Files = files.Select((f, i) => new { Index = i, Kind = f.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase) ? "pdf" : "image" }),
        };
    }
}
