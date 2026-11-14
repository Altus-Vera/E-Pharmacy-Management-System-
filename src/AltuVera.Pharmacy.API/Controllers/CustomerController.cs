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
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Customers.Add(customer);
        await db.SaveChangesAsync();
        return Ok(customer);
    }

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
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? search)
    {
        var q = db.Doctors.AsQueryable();
        if (search is not null)
            q = q.Where(d => EF.Functions.Like(d.Name, $"%{search}%"));
        return Ok(await q.OrderBy(d => d.Name).ToListAsync());
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] DoctorRequest req)
    {
        var doctor = new Doctor { Name = req.Name, Specialization = req.Specialization, ContactNumber = req.ContactNumber, Address = req.Address, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        db.Doctors.Add(doctor);
        await db.SaveChangesAsync();
        return Ok(doctor);
    }

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] DoctorRequest req)
    {
        var doctor = await db.Doctors.FindAsync(id);
        if (doctor is null) return NotFound();
        doctor.Name = req.Name;
        doctor.Specialization = req.Specialization;
        doctor.ContactNumber = req.ContactNumber;
        doctor.Address = req.Address;
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

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SupplierRequest req)
    {
        var supplier = new Supplier { Name = req.Name, Address = req.Address, ContactNumber = req.ContactNumber, SpecialRemarks = req.SpecialRemarks, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        db.Suppliers.Add(supplier);
        await db.SaveChangesAsync();
        return Ok(supplier);
    }

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

public record CustomerRequest(string Name, string ContactNumber, string? Email, string? Address, DateOnly? Dob, string? Gender, string? ClinicalRemarks);
public record DoctorRequest(string Name, string? Specialization, string? ContactNumber, string? Address);
public record SupplierRequest(string Name, string? Address, string? ContactNumber, string? SpecialRemarks);
