using AltuVera.Pharmacy.API.Security;
using AltuVera.Pharmacy.Domain.Entities;
using AltuVera.Pharmacy.Domain.Enums;
using AltuVera.Pharmacy.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.Pharmacy.API.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UserController(AppDbContext db) : ControllerBase
{
    [Authorize(Roles = R.UserAdmin)]
    [HttpGet]
    public async Task<IActionResult> List() =>
        Ok(await db.Users.OrderBy(u => u.Name).ToListAsync());

    [Authorize(Roles = R.UserAdmin)]
    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        var u = await db.Users.FindAsync(id);
        return u is null ? NotFound() : Ok(u);
    }

    [Authorize(Roles = R.UserAdmin)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UserCreateRequest req)
    {
        if (!Enum.TryParse<UserType>(req.UserType.Replace("_", ""), true, out var userType) || !Enum.IsDefined(userType))
            return BadRequest(new { detail = "Unknown user type" });
        if (userType == UserType.SystemAdministrator && !User.IsInRole(R.Admin))
            return StatusCode(403, new { detail = "Only a System Administrator can create administrator accounts." });
        if (await db.Users.AnyAsync(u => u.Username == req.Username))
            return BadRequest(new { detail = "Username already exists" });

        var user = new User
        {
            Name = req.Name,
            Nic = req.Nic,
            UserType = userType,
            Address = req.Address,
            ContactNumber = req.ContactNumber,
            Username = req.Username,
            HashedPassword = BCrypt.Net.BCrypt.HashPassword(req.Password),
            Remarks = req.Remarks,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return Ok(user);
    }

    [Authorize(Roles = R.UserAdmin)]
    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UserUpdateRequest req)
    {
        var user = await db.Users.FindAsync(id);
        if (user is null) return NotFound();
        // stops a manager resetting an admin's password or disabling the admin account
        if (user.UserType == UserType.SystemAdministrator && !User.IsInRole(R.Admin))
            return StatusCode(403, new { detail = "Only a System Administrator can change administrator accounts." });

        if (req.Name is not null) user.Name = req.Name;
        if (req.ContactNumber is not null) user.ContactNumber = req.ContactNumber;
        if (req.Address is not null) user.Address = req.Address;
        if (req.IsActive.HasValue) user.IsActive = req.IsActive.Value;
        if (req.Password is not null) user.HashedPassword = BCrypt.Net.BCrypt.HashPassword(req.Password);
        user.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return Ok(user);
    }
}

public record UserCreateRequest(string Name, string Nic, string UserType, string Username, string Password,
    string? Address, string? ContactNumber, string? Remarks);
public record UserUpdateRequest(string? Name, string? ContactNumber, string? Address, bool? IsActive, string? Password);
