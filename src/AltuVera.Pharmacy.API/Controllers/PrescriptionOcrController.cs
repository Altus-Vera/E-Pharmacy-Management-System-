using System.Text.Json;
using AltuVera.Pharmacy.API.Security;
using AltuVera.Pharmacy.API.Services;
using Anthropic.Exceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AltuVera.Pharmacy.API.Controllers;

/// <summary>
/// Prescription photo (e.g. received on WhatsApp) → suggested bill lines for the cashier to check.
/// Each scan is kept under uploads/rx-ocr with what was read and what the cashier confirmed, for audit.
/// </summary>
[ApiController]
[Route("api/prescriptions/ocr")]
[Authorize(Roles = R.Pos)]
public class PrescriptionOcrController(PrescriptionOcr ocr, IWebHostEnvironment env, ILogger<PrescriptionOcrController> log) : ControllerBase
{
    private static readonly string[] Allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower, WriteIndented = true };
    private string Dir => Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", "uploads", "rx-ocr"));

    [HttpGet("status")]
    public IActionResult Status() => Ok(new { enabled = ocr.Enabled, provider = ocr.Provider, model = ocr.Model });

    /// <summary>Upload 1–4 photos (prescription + any description photo). Optional hint = the WhatsApp message text.</summary>
    [HttpPost]
    [RequestSizeLimit(30_000_000)]
    public async Task<IActionResult> Read([FromForm] List<IFormFile> files, [FromForm] string? hint, [FromForm] string? scanId, CancellationToken ct)
    {
        if (!ocr.Enabled) return StatusCode(503, new { detail = "Prescription reading is not set up. Add the Google key (GEMINI_API_KEY) or Anthropic key (ANTHROPIC_API_KEY) on the server." });
        Directory.CreateDirectory(Dir);

        var images = new List<(byte[], string)>();
        var id = scanId is { Length: > 0 } && Guid.TryParse(scanId, out var g) ? g.ToString("N") : null;
        if (id is not null && files.Count == 0)
        {
            // re-read an earlier scan (e.g. with a corrected hint from the cashier)
            foreach (var path in Directory.GetFiles(Dir, $"{id}_*").Where(p => !p.EndsWith(".json")).Order())
                images.Add((await System.IO.File.ReadAllBytesAsync(path, ct), MediaFromExt(Path.GetExtension(path))));
            if (images.Count == 0) return NotFound(new { detail = "Scan not found" });
        }
        else
        {
            if (files.Count is 0 or > 4) return BadRequest(new { detail = "Attach 1 to 4 photos of the prescription." });
            id = Guid.NewGuid().ToString("N");
            var i = 0;
            foreach (var f in files)
            {
                var type = f.ContentType.ToLowerInvariant();
                if (!Allowed.Contains(type)) return BadRequest(new { detail = $"{f.FileName}: use a JPG, PNG or WebP photo." });
                if (f.Length > 5_000_000) return BadRequest(new { detail = $"{f.FileName} is over 5 MB. Send a smaller photo." });
                using var ms = new MemoryStream();
                await f.CopyToAsync(ms, ct);
                var bytes = ms.ToArray();
                images.Add((bytes, type));
                await System.IO.File.WriteAllBytesAsync(Path.Combine(Dir, $"{id}_{i++}{ExtFor(type)}"), bytes, ct);
            }
        }

        try
        {
            var result = await ocr.ReadAsync(images, hint, ct);
            await System.IO.File.WriteAllTextAsync(Path.Combine(Dir, $"{id}.read.json"),
                JsonSerializer.Serialize(new { at = DateTime.UtcNow, user = User.Identity?.Name, hint, result }, Json), ct);
            var urls = Directory.GetFiles(Dir, $"{id}_*").Where(p => !p.EndsWith(".json")).Order().Select(p => $"/uploads/rx-ocr/{Path.GetFileName(p)}");
            return Ok(new { scan_id = id, images = urls, result });
        }
        catch (InvalidOperationException e) { return UnprocessableEntity(new { detail = e.Message, scan_id = id }); }
        catch (OcrServiceException e) { return StatusCode(e.Status is 429 or 504 ? e.Status : 502, new { detail = e.Message, scan_id = id }); }
        catch (AnthropicRateLimitException) { return StatusCode(429, new { detail = "The reading service is busy. Try again in a minute.", scan_id = id }); }
        catch (AnthropicApiException e)
        {
            log.LogError(e, "Rx OCR failed");
            return StatusCode(502, new { detail = "The reading service could not be reached. Enter the lines by hand or try again.", scan_id = id });
        }
    }

    /// <summary>What the cashier finally accepted, line by line (kept for audit and to measure reading accuracy).</summary>
    [HttpPost("{scanId}/confirm")]
    public async Task<IActionResult> Confirm(string scanId, [FromBody] JsonElement body, CancellationToken ct)
    {
        if (!Guid.TryParse(scanId, out var g)) return BadRequest(new { detail = "Bad scan id" });
        var path = Path.Combine(Dir, $"{g:N}.confirmed.json");
        if (!System.IO.File.Exists(Path.Combine(Dir, $"{g:N}.read.json"))) return NotFound(new { detail = "Scan not found" });
        await System.IO.File.WriteAllTextAsync(path, JsonSerializer.Serialize(new { at = DateTime.UtcNow, user = User.Identity?.Name, confirmed = body }, Json), ct);
        return Ok(new { ok = true });
    }

    private static string ExtFor(string type) => type switch { "image/png" => ".png", "image/webp" => ".webp", "image/gif" => ".gif", _ => ".jpg" };
    private static string MediaFromExt(string ext) => ext switch { ".png" => "image/png", ".webp" => "image/webp", ".gif" => "image/gif", _ => "image/jpeg" };
}
