using AltuVera.Pharmacy.API.Security;
using AltuVera.Pharmacy.Domain.Entities;
using AltuVera.Pharmacy.Domain.Enums;
using AltuVera.Pharmacy.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.Pharmacy.API.Controllers;

[ApiController]
[Route("api/prescriptions")]
[Authorize]
public class PrescriptionController(AppDbContext db, IWebHostEnvironment env) : ControllerBase
{
    [Authorize(Roles = R.Pos)]
    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] PrescriptionUpdateRequest req)
    {
        var rx = await db.Prescriptions.FindAsync(id);
        if (rx is null) return NotFound();
        if (req.IsActive is not null) rx.IsActive = req.IsActive.Value;
        rx.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(rx);
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int? customerId)
    {
        var q = db.Prescriptions.Include(p => p.Customer).Include(p => p.Doctor).AsQueryable();
        if (customerId.HasValue) q = q.Where(p => p.CustomerId == customerId);
        return Ok(await q.OrderByDescending(p => p.CreatedAt).ToListAsync());
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        var p = await db.Prescriptions.Include(p => p.Customer).Include(p => p.Doctor).FirstOrDefaultAsync(p => p.Id == id);
        return p is null ? NotFound() : Ok(p);
    }

    [Authorize(Roles = R.Pos)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] PrescriptionRequest req)
    {
        var prescription = new Prescription
        {
            CustomerId = req.CustomerId,
            DoctorId = req.DoctorId,
            IssueDate = req.IssueDate,
            DrugDetailsText = req.DrugDetailsText,
            ReproduceType = Enum.Parse<ReproduceType>(req.ReproduceType, true),
            ValidDays = req.ValidDays,
            ValidMonths = req.ValidMonths,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Prescriptions.Add(prescription);
        await db.SaveChangesAsync();
        return Ok(prescription);
    }

    [Authorize(Roles = R.Pos)]
    [HttpPost("{id:int}/scan")]
    [RequestSizeLimit(12_000_000)]
    public async Task<IActionResult> UploadScan(int id, IFormFile file, CancellationToken ct)
    {
        var prescription = await db.Prescriptions.FindAsync(id);
        if (prescription is null) return NotFound();

        if (file.Length > 10_000_000) return BadRequest(new { detail = "The scan is over 10 MB. Send a smaller file." });
        var bytes = await FileSniffer.ReadAllAsync(file, ct);
        var type = FileSniffer.Detect(bytes);
        if (type is null or "image/gif") return BadRequest(new { detail = "Use a JPG, PNG or WebP photo, or a PDF." });

        var uploadsDir = Path.Combine(env.ContentRootPath, "..", "uploads", "prescriptions");
        Directory.CreateDirectory(uploadsDir);
        var fileName = $"rx_{id}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}{FileSniffer.ExtFor(type)}";
        await System.IO.File.WriteAllBytesAsync(Path.Combine(uploadsDir, fileName), bytes, ct);

        prescription.ScanFilePath = $"prescriptions/{fileName}";
        prescription.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(prescription);
    }
}

public record PrescriptionRequest(int CustomerId, int? DoctorId, DateOnly IssueDate, string? DrugDetailsText,
    string ReproduceType, int? ValidDays, int? ValidMonths);

public record PrescriptionUpdateRequest(bool? IsActive);
