using System.Text.Json;
using AltuVera.Pharmacy.API.Security;
using AltuVera.Pharmacy.API.Services;
using Anthropic.Exceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AltuVera.Pharmacy.API.Controllers;

/// <summary>
/// Supplier invoice photo → suggested GRN lines for the storekeeper to check. Separate from the GRN save itself:
/// nothing touches stock until the normal "Create GRN" is submitted. Photos + reading are kept under uploads/grn-ocr.
/// </summary>
[ApiController]
[Route("api/grn/ocr")]
[Authorize(Roles = R.Stock)]
public class InvoiceOcrController(InvoiceOcr ocr, PrescriptionOcr vision, IWebHostEnvironment env, ILogger<InvoiceOcrController> log) : ControllerBase
{
    private static readonly string[] Allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower, WriteIndented = true };
    private string Dir => Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", "uploads", "grn-ocr"));

    [HttpGet("status")]
    public IActionResult Status() => Ok(new { enabled = vision.Enabled, provider = vision.Provider, model = vision.Model });

    /// <summary>Upload 1–4 photos of the invoice (multi-page invoices: one photo per page).</summary>
    [HttpPost]
    [RequestSizeLimit(30_000_000)]
    public async Task<IActionResult> Read([FromForm] List<IFormFile> files, [FromForm] string? hint, CancellationToken ct)
    {
        if (!vision.Enabled) return StatusCode(503, new { detail = "Invoice reading is not set up. Add the Google key (GEMINI_API_KEY) or Anthropic key (ANTHROPIC_API_KEY) on the server." });
        if (files.Count is 0 or > 4) return BadRequest(new { detail = "Attach 1 to 4 photos of the invoice." });
        Directory.CreateDirectory(Dir);
        var id = Guid.NewGuid().ToString("N");
        var images = new List<(byte[], string)>();
        var i = 0;
        foreach (var f in files)
        {
            var type = f.ContentType.ToLowerInvariant();
            if (!Allowed.Contains(type)) return BadRequest(new { detail = $"{f.FileName}: use a JPG, PNG or WebP photo." });
            if (f.Length > 5_000_000) return BadRequest(new { detail = $"{f.FileName} is over 5 MB. Send a smaller photo." });
            using var ms = new MemoryStream();
            await f.CopyToAsync(ms, ct);
            images.Add((ms.ToArray(), type));
            var ext = type switch { "image/png" => ".png", "image/webp" => ".webp", "image/gif" => ".gif", _ => ".jpg" };
            await System.IO.File.WriteAllBytesAsync(Path.Combine(Dir, $"{id}_{i++}{ext}"), ms.ToArray(), ct);
        }
        try
        {
            var result = await ocr.ReadAsync(images, hint, ct);
            await System.IO.File.WriteAllTextAsync(Path.Combine(Dir, $"{id}.read.json"),
                JsonSerializer.Serialize(new { at = DateTime.UtcNow, user = User.Identity?.Name, hint, result }, Json), ct);
            return Ok(new { scan_id = id, result });
        }
        catch (InvalidOperationException e) { return UnprocessableEntity(new { detail = e.Message }); }
        catch (OcrServiceException e) { return StatusCode(e.Status is 429 or 504 ? e.Status : 502, new { detail = e.Message }); }
        catch (AnthropicRateLimitException) { return StatusCode(429, new { detail = "The reading service is busy. Try again in a minute." }); }
        catch (AnthropicApiException e)
        {
            log.LogError(e, "Invoice OCR failed");
            return StatusCode(502, new { detail = "The reading service could not be reached. Enter the lines by hand or try again." });
        }
    }
}
