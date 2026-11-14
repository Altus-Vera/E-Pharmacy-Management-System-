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

    [HttpPost("{id:int}/scan")]
    public async Task<IActionResult> UploadScan(int id, IFormFile file)
    {
        var prescription = await db.Prescriptions.FindAsync(id);
        if (prescription is null) return NotFound();

        var uploadsDir = Path.Combine(env.ContentRootPath, "..", "uploads", "prescriptions");
        Directory.CreateDirectory(uploadsDir);
        var ext = Path.GetExtension(file.FileName);
        var fileName = $"rx_{id}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}{ext}";
        var fullPath = Path.Combine(uploadsDir, fileName);
        await using var stream = System.IO.File.Create(fullPath);
        await file.CopyToAsync(stream);

        prescription.ScanFilePath = $"prescriptions/{fileName}";
        prescription.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(prescription);
    }
}

public record PrescriptionRequest(int CustomerId, int? DoctorId, DateOnly IssueDate, string? DrugDetailsText,
    string ReproduceType, int? ValidDays, int? ValidMonths);
