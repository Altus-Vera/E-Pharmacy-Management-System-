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
/// POS shifts. A cashier starts a shift with an opening cash float, sells, then ends it with a cash count.
/// Managers and admins can see every shift, including live figures for shifts still open.
/// </summary>
[ApiController]
[Route("api/shifts")]
[Authorize(Roles = R.Pos)]
public class ShiftController(AppDbContext db) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    private bool IsManager => User.IsInRole(R.PharmacyManager) || User.IsInRole(R.Admin);

    /// <summary>The signed-in user's open shift with live figures (shift = null when none is open).</summary>
    [HttpGet("current")]
    public async Task<IActionResult> Current()
    {
        var s = await db.Shifts.Include(x => x.User).FirstOrDefaultAsync(x => x.UserId == UserId && x.Status == ShiftStatus.Open);
        return Ok(new { shift = s is null ? null : await View(s, false) });
    }

    [HttpPost("start")]
    public async Task<IActionResult> Start([FromBody] StartShiftRequest req)
    {
        if (req.OpeningCash < 0) return BadRequest(new { detail = "Opening cash cannot be negative." });
        if (await ShiftTotals.OpenForAsync(db, UserId) is { } open)
            return Conflict(new { detail = $"You already have shift {open.ShiftNumber} open. End it before starting a new one." });
        var now = DateTime.UtcNow;
        var s = new Shift
        {
            ShiftNumber = $"SH-{now.ToLocalTime():yyyyMMdd}-{now.ToLocalTime():HHmmss}-{UserId}",
            UserId = UserId,
            Terminal = string.IsNullOrWhiteSpace(req.Terminal) ? null : req.Terminal.Trim(),
            OpeningCash = req.OpeningCash,
            OpeningNotes = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes.Trim(),
            OpenedAt = now,
        };
        db.Shifts.Add(s);
        await db.SaveChangesAsync();
        await db.Entry(s).Reference(x => x.User).LoadAsync();
        return Ok(await View(s, false));
    }

    /// <summary>End a shift: the cashier counts the drawer; the figures are frozen and the report is returned.</summary>
    [HttpPost("{id:int}/end")]
    public async Task<IActionResult> End(int id, [FromBody] EndShiftRequest req)
    {
        var s = await db.Shifts.Include(x => x.User).FirstOrDefaultAsync(x => x.Id == id);
        if (s is null) return NotFound();
        if (s.UserId != UserId && !IsManager) return Forbid();
        if (s.Status == ShiftStatus.Closed) return BadRequest(new { detail = "This shift is already ended." });
        if (req.CountedCash < 0) return BadRequest(new { detail = "Counted cash cannot be negative." });

        s.CountedCash = req.CountedCash;
        s.ClosingNotes = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes.Trim();
        s.ClosedAt = DateTime.UtcNow;
        s.ClosedByUserId = UserId;
        s.Status = ShiftStatus.Closed;
        ShiftTotals.Freeze(s, await ShiftTotals.ComputeAsync(db, s));
        await db.SaveChangesAsync();
        return Ok(await View(s, true));
    }

    /// <summary>Shift report (owner, or a manager/admin).</summary>
    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        var s = await db.Shifts.Include(x => x.User).FirstOrDefaultAsync(x => x.Id == id);
        if (s is null) return NotFound();
        if (s.UserId != UserId && !IsManager) return Forbid();
        return Ok(await View(s, true));
    }

    /// <summary>Shifts list for managers/admins. Open shifts carry live figures.</summary>
    [Authorize(Roles = R.Manager)]
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] string? status, [FromQuery] int? userId)
    {
        var q = db.Shifts.Include(x => x.User).AsQueryable();
        if (from.HasValue) q = q.Where(x => x.OpenedAt >= from.Value.ToUniversalTime());
        if (to.HasValue) q = q.Where(x => x.OpenedAt < to.Value.ToUniversalTime());
        if (userId.HasValue) q = q.Where(x => x.UserId == userId);
        if (status is not null && Enum.TryParse<ShiftStatus>(status, true, out var st)) q = q.Where(x => x.Status == st);
        var list = await q.OrderByDescending(x => x.Status == ShiftStatus.Open).ThenByDescending(x => x.OpenedAt).Take(300).ToListAsync();
        var outp = new List<object>();
        foreach (var s in list) outp.Add(await View(s, false));
        return Ok(outp);
    }

    private static DateTime Utc(DateTime d) => DateTime.SpecifyKind(d, DateTimeKind.Utc);

    private async Task<object> View(Shift s, bool withDetail)
    {
        var live = s.Status == ShiftStatus.Open;
        var t = live ? await ShiftTotals.ComputeAsync(db, s) : ShiftTotals.FromFrozen(s);
        string? closedBy = s.ClosedByUserId is { } cb && cb != s.UserId ? await db.Users.Where(u => u.Id == cb).Select(u => u.Name).FirstOrDefaultAsync() : null;
        return new
        {
            s.Id, s.ShiftNumber, s.UserId, CashierName = s.User?.Name, CashierUsername = s.User?.Username, s.Terminal,
            Status = s.Status.ToString().ToLowerInvariant(), Live = live,
            OpenedAt = Utc(s.OpenedAt), ClosedAt = s.ClosedAt is { } ca ? Utc(ca) : (DateTime?)null, ClosedByName = closedBy,
            DurationMinutes = (int)((s.ClosedAt ?? DateTime.UtcNow) - s.OpenedAt).TotalMinutes,
            s.OpeningCash, s.OpeningNotes, s.CountedCash, s.ClosingNotes,
            Totals = t with { LastSaleAt = t.LastSaleAt is { } ls ? Utc(ls) : null },
            CashDifference = live ? (decimal?)null : s.CashDifference,
            TopItems = withDetail ? await ShiftTotals.TopItemsAsync(db, s.Id) : null,
        };
    }
}

public record StartShiftRequest(decimal OpeningCash, string? Terminal, string? Notes);
public record EndShiftRequest(decimal CountedCash, string? Notes);
