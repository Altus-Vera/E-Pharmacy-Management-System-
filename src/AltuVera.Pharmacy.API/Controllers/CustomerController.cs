using AltuVera.Pharmacy.API.Security;
using AltuVera.Pharmacy.Domain.Entities;
using AltuVera.Pharmacy.Domain.Enums;
using AltuVera.Pharmacy.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.Pharmacy.API.Controllers;

[ApiController]
[Route("api/customers")]
[Authorize]
public class CustomerController(AppDbContext db) : ControllerBase
{
    private bool IsManager() => User.IsInRole(R.PharmacyManager) || User.IsInRole(R.Admin);

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? search)
    {
        var q = db.Customers.AsQueryable();
        if (search is not null)
            q = q.Where(c => EF.Functions.Like(c.Name, $"%{search}%") ||
                             EF.Functions.Like(c.ContactNumber, $"%{search}%"));
        return Ok(await q.OrderBy(c => c.Name).ToListAsync());
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        var c = await db.Customers.FindAsync(id);
        return c is null ? NotFound() : Ok(c);
    }

    [Authorize(Roles = R.Pos)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CustomerRequest req)
    {
        var customer = new Customer
        {
            Name = req.Name,
            ContactNumber = req.ContactNumber,
            Email = req.Email,
            Address = req.Address,
            Dob = req.Dob,
            Gender = req.Gender is not null ? Enum.Parse<Gender>(req.Gender, true) : null,
            ClinicalRemarks = req.ClinicalRemarks,
            DiscountRate = IsManager() ? Math.Clamp(req.DiscountRate ?? 0, 0, 100) : 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Customers.Add(customer);
        await db.SaveChangesAsync();
        return Ok(customer);
    }

    [Authorize(Roles = R.Pos)]
    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] CustomerRequest req)
    {
        var customer = await db.Customers.FindAsync(id);
        if (customer is null) return NotFound();
        customer.Name = req.Name;
        customer.ContactNumber = req.ContactNumber;
        customer.Email = req.Email;
        customer.Address = req.Address;
        customer.Dob = req.Dob;
        customer.Gender = req.Gender is not null ? Enum.Parse<Gender>(req.Gender, true) : null;
        customer.ClinicalRemarks = req.ClinicalRemarks;
        if (req.DiscountRate is not null && req.DiscountRate != customer.DiscountRate)
        {
            if (!IsManager()) return StatusCode(403, new { detail = "Only a Pharmacy Manager can set customer discount rates." });
            customer.DiscountRate = Math.Clamp(req.DiscountRate.Value, 0, 100);
        }
        if (req.IsActive is not null) customer.IsActive = req.IsActive.Value;
        customer.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(customer);
    }
}

[ApiController]
[Route("api/doctors")]
[Authorize]
public class DoctorController(AppDbContext db) : ControllerBase
{
    private bool IsManager() => User.IsInRole(R.PharmacyManager) || User.IsInRole(R.Admin);

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? search)
    {
        var q = db.Doctors.AsQueryable();
        if (search is not null)
            q = q.Where(d => EF.Functions.Like(d.Name, $"%{search}%") ||
                             EF.Functions.Like(d.SlmcRegNo!, $"%{search}%") ||
                             EF.Functions.Like(d.ContactNumber!, $"%{search}%"));
        return Ok(await q.OrderBy(d => d.Name).ToListAsync());
    }

    [Authorize(Roles = R.Pos)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] DoctorRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { detail = "Doctor name is required." });
        if (string.IsNullOrWhiteSpace(req.SlmcRegNo))
            return BadRequest(new { detail = "SLMC Registration Number is required." });
        if (await db.Doctors.AnyAsync(d => d.SlmcRegNo == req.SlmcRegNo))
            return BadRequest(new { detail = "A doctor with this SLMC Registration Number already exists." });
        var doctor = new Doctor
        {
            Name = req.Name.Trim(), SlmcRegNo = req.SlmcRegNo.Trim(), Specialization = req.Specialization,
            ContactNumber = req.ContactNumber, Email = req.Email, Hospital = req.Hospital, Address = req.Address,
            DiscountRate = IsManager() ? Math.Clamp(req.DiscountRate ?? 0, 0, 100) : 0,
            CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
        };
        db.Doctors.Add(doctor);
        await db.SaveChangesAsync();
        return Ok(doctor);
    }

    [Authorize(Roles = R.Pos)]
    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] DoctorRequest req)
    {
        var doctor = await db.Doctors.FindAsync(id);
        if (doctor is null) return NotFound();
        if (req.Name is not null) doctor.Name = req.Name;
        if (req.SlmcRegNo is not null)
        {
            if (await db.Doctors.AnyAsync(d => d.Id != id && d.SlmcRegNo == req.SlmcRegNo))
                return BadRequest(new { detail = "Another doctor already has this SLMC Registration Number." });
            doctor.SlmcRegNo = req.SlmcRegNo.Trim();
        }
        if (req.Specialization is not null) doctor.Specialization = req.Specialization;
        if (req.ContactNumber is not null) doctor.ContactNumber = req.ContactNumber;
        if (req.Email is not null) doctor.Email = req.Email;
        if (req.Hospital is not null) doctor.Hospital = req.Hospital;
        if (req.Address is not null) doctor.Address = req.Address;
        if (req.IsActive is not null) doctor.IsActive = req.IsActive.Value;
        if (req.DiscountRate is not null && req.DiscountRate != doctor.DiscountRate)
        {
            if (!IsManager()) return StatusCode(403, new { detail = "Only a Pharmacy Manager can set doctor discount rates." });
            doctor.DiscountRate = Math.Clamp(req.DiscountRate.Value, 0, 100);
        }
        doctor.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(doctor);
    }
}

[ApiController]
[Route("api/suppliers")]
[Authorize]
public class SupplierController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() => Ok(await db.Suppliers.OrderBy(s => s.Name).ToListAsync());

    [Authorize(Roles = R.Stock)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SupplierRequest req)
    {
        var supplier = new Supplier { Name = req.Name, Address = req.Address, ContactNumber = req.ContactNumber, SpecialRemarks = req.SpecialRemarks, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        db.Suppliers.Add(supplier);
        await db.SaveChangesAsync();
        return Ok(supplier);
    }

    [Authorize(Roles = R.Stock)]
    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] SupplierRequest req)
    {
        var s = await db.Suppliers.FindAsync(id);
        if (s is null) return NotFound();
        s.Name = req.Name; s.Address = req.Address; s.ContactNumber = req.ContactNumber; s.SpecialRemarks = req.SpecialRemarks; s.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(s);
    }
}

public record CustomerRequest(string Name, string ContactNumber, string? Email, string? Address, DateOnly? Dob, string? Gender, string? ClinicalRemarks,
    decimal? DiscountRate = null, bool? IsActive = null);
public record DoctorRequest(string? Name, string? SlmcRegNo, string? Specialization, string? ContactNumber, string? Address,
    string? Email = null, string? Hospital = null, decimal? DiscountRate = null, bool? IsActive = null);
public record SupplierRequest(string Name, string? Address, string? ContactNumber, string? SpecialRemarks);
