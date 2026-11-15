using AltuVera.Pharmacy.API.Security;
using AltuVera.Pharmacy.API.Services;
using AltuVera.Pharmacy.Domain.Entities;
using AltuVera.Pharmacy.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.Pharmacy.API.Controllers;

/// <summary>Dosing frequencies (OD, BD, TDS, 1-0-1 …) used by the days calculator.</summary>
[ApiController]
[Route("api/frequency-codes")]
[Authorize]
public class FrequencyCodeController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] bool all = false) =>
        Ok(await db.FrequencyCodes.Where(f => all || f.IsActive).OrderBy(f => f.SortOrder).ThenBy(f => f.Code).ToListAsync());

    [Authorize(Roles = R.Manager)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] FrequencyRequest req)
    {
        if (Invalid(req) is { } err) return BadRequest(new { detail = err });
        var code = req.Code.Trim().ToUpperInvariant();
        if (await db.FrequencyCodes.AnyAsync(f => f.Code == code)) return BadRequest(new { detail = $"Code {code} already exists" });
        var f = new FrequencyCode
        {
            Code = code, Description = req.Description.Trim(), TimesPerDay = req.TimesPerDay, SortOrder = req.SortOrder ?? 100,
            IsActive = req.IsActive ?? true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
        };
        db.FrequencyCodes.Add(f);
        await db.SaveChangesAsync();
        return Ok(f);
    }

    [Authorize(Roles = R.Manager)]
    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] FrequencyRequest req)
    {
        var f = await db.FrequencyCodes.FindAsync(id);
        if (f is null) return NotFound();
        if (Invalid(req) is { } err) return BadRequest(new { detail = err });
        f.Description = req.Description.Trim();
        f.TimesPerDay = req.TimesPerDay;
        if (req.SortOrder is not null) f.SortOrder = req.SortOrder.Value;
        if (req.IsActive is not null) f.IsActive = req.IsActive.Value;
        f.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(f);
    }

    private static string? Invalid(FrequencyRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.Code) || string.IsNullOrWhiteSpace(r.Description)) return "Code and description are required.";
        if (r.TimesPerDay is < 0 or > 24) return "Times per day must be between 0 and 24 (leave empty for 'as needed').";
        return null;
    }
}

/// <summary>"How much for N days": quantity, loose/strip/pack rounding and FIFO price for one drug or a whole bill.</summary>
[ApiController]
[Route("api/dispense")]
[Authorize]
public class DispenseController(AppDbContext db) : ControllerBase
{
    [HttpPost("calculate")]
    public async Task<IActionResult> Calculate([FromBody] CalcRequest req)
    {
        if (req.Items is null || req.Items.Count == 0) return BadRequest(new { detail = "No items" });
        var freqs = await db.FrequencyCodes.ToDictionaryAsync(f => f.Code);
        var results = new List<object>();
        var errors = new List<object>();
        foreach (var it in req.Items)
        {
            var drug = await db.Drugs.FindAsync(it.DrugId);
            if (drug is null) { errors.Add(new { drug_id = it.DrugId, detail = "Drug not found" }); continue; }
            var days = it.Days ?? req.Days ?? 0;
            var dose = it.Dose ?? drug.DefaultDose ?? 1;
            var code = (it.FrequencyCode ?? drug.DefaultFrequency ?? "TDS").ToUpperInvariant();
            if (days < 1 || days > 365) { errors.Add(new { drug_id = drug.Id, drug = drug.BrandName, detail = "Days must be 1–365" }); continue; }
            if (dose <= 0) { errors.Add(new { drug_id = drug.Id, drug = drug.BrandName, detail = "Dose must be above zero" }); continue; }
            if (!freqs.TryGetValue(code, out var f)) { errors.Add(new { drug_id = drug.Id, drug = drug.BrandName, detail = $"Unknown frequency {code}" }); continue; }
            if (drug.DoseUnit is not null && drug.ContentPerUnit is null or <= 0)
            { errors.Add(new { drug_id = drug.Id, drug = drug.BrandName, detail = $"Set how many {drug.DoseUnit} are in one {drug.BaseUnit} (ERP drug record) to calculate days" }); continue; }
            if (f.TimesPerDay is null or 0) { errors.Add(new { drug_id = drug.Id, drug = drug.BrandName, detail = $"{f.Code} is 'as needed' — enter the quantity by hand" }); continue; }
            results.Add(await Dispensing.CalculateAsync(db, drug, dose, f, days));
        }
        var total = results.Cast<Dispensing.CalcResult>().Sum(r => r.Total);
        return Ok(new { items = results, errors, total });
    }
}

public record FrequencyRequest(string Code, string Description, decimal? TimesPerDay, int? SortOrder, bool? IsActive);
public record CalcItem(int DrugId, decimal? Dose, string? FrequencyCode, int? Days);
public record CalcRequest(List<CalcItem> Items, int? Days);
