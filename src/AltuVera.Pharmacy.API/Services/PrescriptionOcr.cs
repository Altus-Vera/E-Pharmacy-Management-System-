using System.Text.Json;
using System.Text.RegularExpressions;
using AltuVera.Pharmacy.Infrastructure.Data;
using Anthropic;
using Anthropic.Models.Messages;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.Pharmacy.API.Services;

/// <summary>
/// Reads a photographed (often handwritten) prescription with Claude vision and turns it into bill lines.
/// The model is given the store's drug catalogue and dose codes so it can resolve messy handwriting
/// to real products; every line carries a confidence and alternatives, and the cashier must confirm
/// each line before it reaches the bill. Nothing here is trusted blindly.
/// </summary>
public class PrescriptionOcr(AppDbContext db, IConfiguration config, ILogger<PrescriptionOcr> log)
{
    public const string ClaudeModel = "claude-opus-5-5";

    /// <summary>"gemini" (Google, has a free tier) or "anthropic". Default: whichever has a key, Gemini first.</summary>
    public string Provider => (config["Ocr:Provider"] ?? "").ToLowerInvariant() is var p && p is "anthropic" or "gemini" ? p
        : string.IsNullOrWhiteSpace(GeminiKey) && !string.IsNullOrWhiteSpace(ApiKey) ? "anthropic" : "gemini";
    public string Model => Provider == "gemini" ? (config["Ocr:GeminiModel"] is { Length: > 0 } m ? m : "gemini-3.5-flash") : ClaudeModel;
    public bool Enabled => !string.IsNullOrWhiteSpace(Provider == "gemini" ? GeminiKey : ApiKey);
    private string? ApiKey => config["Ocr:AnthropicApiKey"] is { Length: > 0 } k ? k : Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY");
    private string? GeminiKey => config["Ocr:GeminiApiKey"] is { Length: > 0 } k ? k : Environment.GetEnvironmentVariable("GEMINI_API_KEY");
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(90) };

    public record Match(int DrugId, string BrandName, string? GenericName, string? Strength, string? DosageForm, int Quantity, double Score);
    public record OcrLine(int LineNo, string RawText, string? DrugName, string? Strength, string? Form,
        decimal? Dose, string? FrequencyCode, string? FrequencyText, int? Days, int? Quantity,
        string Confidence, string? Note, int? MatchedDrugId, List<Match> Matches);
    public record OcrResult(string? PatientName, string? DoctorName, string? RxDate, string? Notes,
        List<OcrLine> Lines, List<string> Warnings, string Model);

    private static readonly Dictionary<string, JsonElement> Schema = BuildSchema();

    private static Dictionary<string, JsonElement> BuildSchema()
    {
        object str = new { type = new[] { "string", "null" } };
        object num = new { type = new[] { "number", "null" } };
        object integer = new { type = new[] { "integer", "null" } };
        var line = new
        {
            type = "object",
            additionalProperties = false,
            required = new[] { "raw_text", "drug_name", "strength", "form", "catalogue_id", "alternative_ids", "dose", "frequency_code", "frequency_text", "days", "quantity", "confidence", "note" },
            properties = new Dictionary<string, object>
            {
                ["raw_text"] = new { type = "string", description = "The line exactly as written, abbreviations kept" },
                ["drug_name"] = str, ["strength"] = str, ["form"] = str,
                ["catalogue_id"] = integer,
                ["alternative_ids"] = new { type = "array", items = new { type = "integer" } },
                ["dose"] = num, ["frequency_code"] = str, ["frequency_text"] = str,
                ["days"] = integer, ["quantity"] = integer,
                ["confidence"] = new { type = "string", @enum = new[] { "high", "medium", "low" } },
                ["note"] = str,
            },
        };
        var root = new
        {
            type = "object",
            additionalProperties = false,
            required = new[] { "patient_name", "doctor_name", "rx_date", "notes", "lines" },
            properties = new Dictionary<string, object>
            {
                ["patient_name"] = str, ["doctor_name"] = str, ["rx_date"] = str, ["notes"] = str,
                ["lines"] = new { type = "array", items = line },
            },
        };
        var el = JsonSerializer.SerializeToElement(root);
        return el.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.Clone());
    }

    public async Task<OcrResult> ReadAsync(List<(byte[] Bytes, string MediaType)> images, string? cashierHint, CancellationToken ct)
    {
        var drugs = await db.Drugs.Where(d => d.IsActive).OrderBy(d => d.BrandName)
            .Select(d => new { d.Id, d.BrandName, d.GenericName, d.Strength, d.DosageForm, d.Quantity }).ToListAsync(ct);
        var freqs = await db.FrequencyCodes.Where(f => f.IsActive).OrderBy(f => f.SortOrder).ToListAsync(ct);

        // Stable catalogue first so it caches across scans; the per-scan images and hint come after.
        var catalogue = string.Join("\n", drugs.Select(d => $"{d.Id} | {d.BrandName} | {d.GenericName} | {d.Strength} | {d.DosageForm}"));
        var codes = string.Join("\n", freqs.Select(f => $"{f.Code} = {f.Description}"));
        var system = $"""
            You read photographed doctor's prescriptions for a pharmacy in Sri Lanka. They are often handwritten and hard to read,
            and may be photos forwarded through WhatsApp (compressed, tilted, partly cropped, with a description photo alongside).
            Extract every medicine line. A wrong medicine is dangerous, so be honest about uncertainty:
            - confidence "high" only when the drug name, strength and directions are all clearly legible;
              "medium" when you resolved some handwriting from context; "low" when you are guessing.
            - Never invent a line that is not on the prescription. If a word is unreadable, keep it in raw_text and say so in note.
            - catalogue_id: the id from the store catalogue below that best matches the written drug and strength, or null if none fits.
              alternative_ids: up to 4 other plausible catalogue ids (look-alike names, other strengths) when you are not certain.
              Prefer the written strength; flag a strength mismatch in note.
            - frequency_code: one of the store dose codes below (map "1-0-1", "bd", "2x daily", "nocte" etc.), else null and put the words in frequency_text.
            - dose is the amount per intake (tablets, ml ...). days is the course length; quantity only if a total is written (e.g. "x 30", "1 card").
            - Common shorthand: OD/BD/TDS/QDS/nocte/mane/SOS/PRN, "1/7"=1 day, "1/52"=1 week (7 days), "1/12"=1 month (30 days).
            - patient_name, doctor_name, rx_date (YYYY-MM-DD if legible) and notes (allergies, "substitution not allowed" etc.) when present.

            STORE DOSE CODES:
            {codes}

            STORE CATALOGUE (id | brand | generic | strength | form):
            {catalogue}
            """;

        var ask = "Read this prescription." + (string.IsNullOrWhiteSpace(cashierHint) ? "" : $"\nNote from the cashier (WhatsApp message text): {cashierHint}");
        var json = Provider == "gemini" ? await GeminiAsync(system, images, ask, ct) : await ClaudeAsync(system, images, ask, ct);

        using var doc = JsonDocument.Parse(json);
        var r = doc.RootElement;
        var byId = drugs.ToDictionary(d => d.Id);
        var warnings = new List<string>();
        var lines = new List<OcrLine>();
        var n = 0;
        foreach (var l in r.GetProperty("lines").EnumerateArray())
        {
            n++;
            var name = S(l, "drug_name");
            var strength = S(l, "strength");
            // candidates: model pick + its alternatives + our own fuzzy search, de-duplicated and scored
            var ids = new List<int>();
            if (I(l, "catalogue_id") is int cid && byId.ContainsKey(cid)) ids.Add(cid);
            if (l.TryGetProperty("alternative_ids", out var alts))
                foreach (var a in alts.EnumerateArray()) if (a.ValueKind == JsonValueKind.Number && byId.ContainsKey(a.GetInt32())) ids.Add(a.GetInt32());
            var query = $"{name} {strength}".Trim();
            if (query.Length > 0)
                ids.AddRange(drugs.Select(d => (d.Id, s: Similarity(query, $"{d.BrandName} {d.Strength}", $"{d.GenericName} {d.Strength}")))
                    .Where(x => x.s >= 0.45).OrderByDescending(x => x.s).Take(4).Select(x => x.Id));
            var matches = ids.Distinct().Take(6).Select(id =>
            {
                var d = byId[id];
                return new Match(d.Id, d.BrandName, d.GenericName, d.Strength, d.DosageForm.ToString(), d.Quantity,
                    Math.Round(Similarity(query, $"{d.BrandName} {d.Strength}", $"{d.GenericName} {d.Strength}"), 2));
            }).ToList();

            var confidence = S(l, "confidence") ?? "low";
            var matched = I(l, "catalogue_id") is int m && byId.ContainsKey(m) ? m : (int?)null;
            var freq = S(l, "frequency_code")?.ToUpperInvariant();
            if (freq is not null && !freqs.Any(f => f.Code == freq)) freq = null;
            if (matched is null) confidence = "low";
            lines.Add(new OcrLine(n, S(l, "raw_text") ?? "", name, strength, S(l, "form"), D(l, "dose"), freq, S(l, "frequency_text"),
                I(l, "days"), I(l, "quantity"), confidence, S(l, "note"), matched, matches));
        }
        if (lines.Count == 0) warnings.Add("No medicine lines were found. Check the photo is the prescription and is not cropped.");
        if (lines.Any(x => x.MatchedDrugId is null)) warnings.Add("Some lines did not match a product in stock — choose one or remove the line.");

        return new OcrResult(S(r, "patient_name"), S(r, "doctor_name"), S(r, "rx_date"), S(r, "notes"), lines, warnings, Model);
    }

    private async Task<string> ClaudeAsync(string system, List<(byte[] Bytes, string MediaType)> images, string ask, CancellationToken ct)
    {
        var content = new List<ContentBlockParam>();
        foreach (var (bytes, media) in images)
            content.Add(new ImageBlockParam { Source = new Base64ImageSource { Data = Convert.ToBase64String(bytes), MediaType = MediaTypeFor(media) } });
        content.Add(new TextBlockParam { Text = ask });

        var client = new AnthropicClient { ApiKey = ApiKey };
        var response = await client.Messages.Create(new MessageCreateParams
        {
            Model = ClaudeModel,
            MaxTokens = 16000,
            OutputConfig = new OutputConfig { Effort = Effort.High, Format = new JsonOutputFormat { Schema = Schema } },
            System = new List<TextBlockParam> { new() { Text = system, CacheControl = new CacheControlEphemeral() } },
            Messages = [new UserMessageParam { Content = content }],
        }, ct);
        if (response.StopReason == "refusal")
            throw new InvalidOperationException("The prescription could not be read automatically. Enter the lines by hand.");
        var json = string.Concat(response.Content.Select(b => b.Value).OfType<TextBlock>().Select(t => t.Text));
        if (response.StopReason == "max_tokens" || string.IsNullOrWhiteSpace(json))
            throw new InvalidOperationException("The prescription reading was cut short. Try a clearer or cropped photo.");
        log.LogInformation("Rx OCR (Claude): {In} in / {Out} out tokens", response.Usage.InputTokens, response.Usage.OutputTokens);
        return json;
    }

    /// <summary>Google Gemini generateContent (REST) with a JSON response schema.</summary>
    private async Task<string> GeminiAsync(string system, List<(byte[] Bytes, string MediaType)> images, string ask, CancellationToken ct)
    {
        var parts = images.Select(i => (object)new { inline_data = new { mime_type = i.MediaType, data = Convert.ToBase64String(i.Bytes) } }).ToList();
        parts.Add(new { text = ask });
        var body = new
        {
            system_instruction = new { parts = new[] { new { text = system } } },
            contents = new[] { new { role = "user", parts } },
            generationConfig = new { temperature = 0, responseMimeType = "application/json", responseSchema = GeminiSchema, thinkingConfig = new { thinkingLevel = "low" } },
        };
        using var req = new HttpRequestMessage(HttpMethod.Post, $"https://generativelanguage.googleapis.com/v1beta/models/{Model}:generateContent")
        {
            Content = new StringContent(JsonSerializer.Serialize(body), System.Text.Encoding.UTF8, "application/json"),
        };
        req.Headers.Add("x-goog-api-key", GeminiKey);
        HttpResponseMessage res;
        try { res = await Http.SendAsync(req, ct); }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        { throw new OcrServiceException(504, "Google took too long to answer. Try again, or enter the lines by hand."); }
        using var _res = res;
        var raw = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            log.LogWarning("Rx OCR (Gemini) HTTP {Code}: {Body}", (int)res.StatusCode, raw.Length > 500 ? raw[..500] : raw);
            throw new OcrServiceException((int)res.StatusCode, (int)res.StatusCode switch
            {
                429 => "The free Google reading limit was reached. Wait a minute (or until tomorrow) and try again.",
                400 or 401 or 403 => "Google rejected the request (check GEMINI_API_KEY on the server).",
                _ => "The reading service could not be reached. Enter the lines by hand or try again.",
            });
        }
        using var doc = JsonDocument.Parse(raw);
        if (!doc.RootElement.TryGetProperty("candidates", out var cands) || cands.GetArrayLength() == 0)
            throw new InvalidOperationException("The prescription could not be read automatically. Enter the lines by hand.");
        var cand = cands[0];
        var finish = cand.TryGetProperty("finishReason", out var f) ? f.GetString() : null;
        if (finish is "SAFETY" or "RECITATION" or "PROHIBITED_CONTENT")
            throw new InvalidOperationException("The prescription could not be read automatically. Enter the lines by hand.");
        if (finish == "MAX_TOKENS")
            throw new InvalidOperationException("The prescription reading was cut short. Try a clearer or cropped photo.");
        var text = cand.TryGetProperty("content", out var c) && c.TryGetProperty("parts", out var ps)
            ? string.Concat(ps.EnumerateArray().Where(p => p.TryGetProperty("text", out _)).Select(p => p.GetProperty("text").GetString())) : "";
        if (string.IsNullOrWhiteSpace(text))
            throw new InvalidOperationException("No text came back from the reading. Try a clearer photo.");
        return text;
    }

    // Gemini takes an OpenAPI-style schema: nullable instead of type arrays.
    private static readonly object GeminiSchema = BuildGeminiSchema();
    private static object BuildGeminiSchema()
    {
        object N(string t) => new { type = t, nullable = true };
        var line = new
        {
            type = "object",
            required = new[] { "raw_text", "drug_name", "catalogue_id", "alternative_ids", "dose", "frequency_code", "days", "confidence" },
            properties = new Dictionary<string, object>
            {
                ["raw_text"] = new { type = "string" },
                ["drug_name"] = N("string"), ["strength"] = N("string"), ["form"] = N("string"),
                ["catalogue_id"] = N("integer"),
                ["alternative_ids"] = new { type = "array", items = new { type = "integer" } },
                ["dose"] = N("number"), ["frequency_code"] = N("string"), ["frequency_text"] = N("string"),
                ["days"] = N("integer"), ["quantity"] = N("integer"),
                ["confidence"] = new { type = "string", @enum = new[] { "high", "medium", "low" } },
                ["note"] = N("string"),
            },
            propertyOrdering = new[] { "raw_text", "drug_name", "strength", "form", "catalogue_id", "alternative_ids", "dose", "frequency_code", "frequency_text", "days", "quantity", "confidence", "note" },
        };
        return new
        {
            type = "object",
            required = new[] { "lines" },
            properties = new Dictionary<string, object>
            {
                ["patient_name"] = N("string"), ["doctor_name"] = N("string"), ["rx_date"] = N("string"), ["notes"] = N("string"),
                ["lines"] = new { type = "array", items = line },
            },
            propertyOrdering = new[] { "patient_name", "doctor_name", "rx_date", "notes", "lines" },
        };
    }

    private static MediaType MediaTypeFor(string media) => media.ToLowerInvariant() switch
    {
        "image/png" => MediaType.ImagePng,
        "image/webp" => MediaType.ImageWebP,
        "image/gif" => MediaType.ImageGif,
        _ => MediaType.ImageJpeg,
    };

    private static string? S(JsonElement e, string p) => e.TryGetProperty(p, out var v) && v.ValueKind == JsonValueKind.String && v.GetString()!.Trim() is { Length: > 0 } s ? s : null;
    private static int? I(JsonElement e, string p) => e.TryGetProperty(p, out var v) && v.ValueKind == JsonValueKind.Number ? (int)Math.Round(v.GetDouble()) : null;
    private static decimal? D(JsonElement e, string p) => e.TryGetProperty(p, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDecimal() : null;

    private static string Norm(string s) => Regex.Replace(s.ToLowerInvariant(), "[^a-z0-9]+", " ").Trim();

    /// <summary>Best of token overlap and edit-distance similarity against brand and generic names (0..1).</summary>
    public static double Similarity(string query, params string?[] names)
    {
        var q = Norm(query);
        if (q.Length == 0) return 0;
        double best = 0;
        foreach (var raw in names)
        {
            if (string.IsNullOrWhiteSpace(raw)) continue;
            var n = Norm(raw);
            var qWords = q.Split(' ');
            var first = qWords[0];
            var nFirst = n.Split(' ')[0];
            var lev = 1 - (double)Levenshtein(first, nFirst) / Math.Max(first.Length, nFirst.Length);
            var overlap = qWords.Count(w => n.Contains(w)) / (double)qWords.Length;
            best = Math.Max(best, 0.7 * lev + 0.3 * overlap);
        }
        return best;
    }

    private static int Levenshtein(string a, string b)
    {
        var d = new int[a.Length + 1, b.Length + 1];
        for (var i = 0; i <= a.Length; i++) d[i, 0] = i;
        for (var j = 0; j <= b.Length; j++) d[0, j] = j;
        for (var i = 1; i <= a.Length; i++)
            for (var j = 1; j <= b.Length; j++)
                d[i, j] = Math.Min(Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1), d[i - 1, j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1));
        return d[a.Length, b.Length];
    }
}

public class OcrServiceException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}
