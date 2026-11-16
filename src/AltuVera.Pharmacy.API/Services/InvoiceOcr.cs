using System.Text.Json;
using AltuVera.Pharmacy.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using static AltuVera.Pharmacy.API.Services.PrescriptionOcr;

namespace AltuVera.Pharmacy.API.Services;

/// <summary>
/// Reads a photographed supplier invoice / delivery note into suggested GRN lines (product, batch, expiry,
/// quantity, free quantity, unit cost). Uses the same vision provider as the prescription reader.
/// Nothing is saved to stock here: the storekeeper checks every line in the GRN form before creating the GRN.
/// </summary>
public class InvoiceOcr(AppDbContext db, PrescriptionOcr vision)
{
    public record InvLine(int LineNo, string RawText, string? ProductName, string? Strength, string? PackSize,
        string? BatchNumber, string? ExpiryDate, int? Quantity, int? FreeQuantity, decimal? UnitCost, decimal? LineTotal,
        string Confidence, string? Note, int? MatchedDrugId, List<Match> Matches);
    public record InvResult(string? SupplierName, int? MatchedSupplierId, string? InvoiceNumber, string? InvoiceDate,
        decimal? TotalAmount, List<InvLine> Lines, List<string> Warnings, string Model);

    public async Task<InvResult> ReadAsync(List<(byte[] Bytes, string MediaType)> images, string? hint, CancellationToken ct)
    {
        var drugs = await db.Drugs.Where(d => d.IsActive).OrderBy(d => d.BrandName)
            .Select(d => new { d.Id, d.BrandName, d.GenericName, d.Strength, d.DosageForm, d.Quantity, d.PackSize }).ToListAsync(ct);
        var suppliers = await db.Suppliers.Select(s => new { s.Id, s.Name }).ToListAsync(ct);

        var catalogue = string.Join("\n", drugs.Select(d => $"{d.Id} | {d.BrandName} | {d.GenericName} | {d.Strength} | {d.DosageForm} | pack {d.PackSize}"));
        var system = $"""
            You read photographed supplier invoices / delivery notes for a pharmacy in Sri Lanka (printed or handwritten,
            often phone photos). Extract the header and every product line so a storekeeper can record a Goods Receipt Note.
            Mistakes put wrong stock or wrong expiry on the shelf, so be honest:
            - confidence "high" only when product, batch, expiry, quantity and cost are all clearly legible; "medium" if you inferred
              something; "low" when guessing. note: plain words for the storekeeper, never mention catalogue ids.
            - Never invent lines. Skip subtotal / tax / discount rows.
            - catalogue_id: best matching id from the store catalogue below (name + strength), or null. alternative_ids: up to 4 others if unsure.
            - batch_number exactly as printed. expiry_date as YYYY-MM-DD; if only month/year (e.g. 08/27 or AUG-2027) use the LAST day of that month.
            - quantity: the number of items supplied as printed (packs/boxes if the invoice counts packs); put the pack description in pack_size
              (e.g. "10x10", "100s", "1x60ml"). free_quantity: free/bonus quantity if shown, else null.
            - unit_cost: price per the same unit as quantity, before tax. line_total: the line amount as printed.
            - supplier_name, invoice_number, invoice_date (YYYY-MM-DD) and total_amount from the header/footer.

            STORE CATALOGUE (id | brand | generic | strength | form | units per pack):
            {catalogue}
            """;
        var ask = "Read this supplier invoice." + (string.IsNullOrWhiteSpace(hint) ? "" : $"\nNote from the storekeeper: {hint}");
        var json = await vision.CallAsync(system, images, ask, Schema, GeminiSchema, "invoice", ct);

        using var doc = JsonDocument.Parse(json);
        var r = doc.RootElement;
        var byId = drugs.ToDictionary(d => d.Id);
        var lines = new List<InvLine>();
        var n = 0;
        foreach (var l in r.GetProperty("lines").EnumerateArray())
        {
            n++;
            var name = S(l, "product_name"); var strength = S(l, "strength");
            var query = $"{name} {strength}".Trim();
            var ids = new List<int>();
            if (I(l, "catalogue_id") is int cid && byId.ContainsKey(cid)) ids.Add(cid);
            if (l.TryGetProperty("alternative_ids", out var alts))
                foreach (var a in alts.EnumerateArray()) if (a.ValueKind == JsonValueKind.Number && byId.ContainsKey(a.GetInt32())) ids.Add(a.GetInt32());
            if (query.Length > 0)
                ids.AddRange(drugs.Select(d => (d.Id, s: Similarity(query, $"{d.BrandName} {d.Strength}", $"{d.GenericName} {d.Strength}")))
                    .Where(x => x.s >= 0.45).OrderByDescending(x => x.s).Take(4).Select(x => x.Id));
            var matches = ids.Distinct().Take(6).Select(id =>
            {
                var d = byId[id];
                return new Match(d.Id, d.BrandName, d.GenericName, d.Strength, d.DosageForm.ToString(), d.Quantity,
                    Math.Round(Similarity(query, $"{d.BrandName} {d.Strength}", $"{d.GenericName} {d.Strength}"), 2));
            }).ToList();
            var matched = I(l, "catalogue_id") is int m && byId.ContainsKey(m) ? m : (int?)null;
            var conf = S(l, "confidence") ?? "low";
            var exp = S(l, "expiry_date");
            if (exp is not null && !DateOnly.TryParseExact(exp, "yyyy-MM-dd", out _)) exp = null;
            if (matched is null || exp is null || S(l, "batch_number") is null) conf = conf == "high" ? "medium" : conf;
            if (matched is null) conf = "low";
            lines.Add(new InvLine(n, S(l, "raw_text") ?? "", name, strength, S(l, "pack_size"), S(l, "batch_number"), exp,
                I(l, "quantity"), I(l, "free_quantity"), D(l, "unit_cost"), D(l, "line_total"), conf, S(l, "note"), matched, matches));
        }

        var supName = S(r, "supplier_name");
        int? supId = null;
        if (supName is not null)
        {
            var best = suppliers.Select(s => (s.Id, sc: Similarity(supName, s.Name))).OrderByDescending(x => x.sc).FirstOrDefault();
            if (best.sc >= 0.6) supId = best.Id;
        }
        var warnings = new List<string>();
        if (lines.Count == 0) warnings.Add("No product lines were found. Check the photo shows the invoice items.");
        if (lines.Any(x => x.MatchedDrugId is null)) warnings.Add("Some lines did not match a product in the catalogue — choose one or remove the line.");
        if (lines.Any(x => x.BatchNumber is null || x.ExpiryDate is null)) warnings.Add("Some lines are missing batch or expiry — copy them from the pack.");
        if (supName is not null && supId is null) warnings.Add($"Supplier \"{supName}\" is not in the supplier list — select it by hand.");
        return new InvResult(supName, supId, S(r, "invoice_number"), S(r, "invoice_date"), D(r, "total_amount"), lines, warnings, vision.Model);
    }

    private static readonly Dictionary<string, JsonElement> Schema = BuildSchema();
    private static Dictionary<string, JsonElement> BuildSchema()
    {
        object str = new { type = new[] { "string", "null" } };
        object num = new { type = new[] { "number", "null" } };
        object integer = new { type = new[] { "integer", "null" } };
        var props = LineFields(str, num, integer);
        var line = new { type = "object", additionalProperties = false, required = props.Keys.ToArray(), properties = props };
        var root = new
        {
            type = "object", additionalProperties = false,
            required = new[] { "supplier_name", "invoice_number", "invoice_date", "total_amount", "lines" },
            properties = new Dictionary<string, object>
            {
                ["supplier_name"] = str, ["invoice_number"] = str, ["invoice_date"] = str, ["total_amount"] = num,
                ["lines"] = new { type = "array", items = line },
            },
        };
        return JsonSerializer.SerializeToElement(root).EnumerateObject().ToDictionary(p => p.Name, p => p.Value.Clone());
    }

    private static readonly string[] Order = ["raw_text", "product_name", "strength", "pack_size", "catalogue_id", "alternative_ids",
        "batch_number", "expiry_date", "quantity", "free_quantity", "unit_cost", "line_total", "confidence", "note"];

    private static Dictionary<string, object> LineFields(object str, object num, object integer) => new()
    {
        ["raw_text"] = new { type = "string" },
        ["product_name"] = str, ["strength"] = str, ["pack_size"] = str,
        ["catalogue_id"] = integer, ["alternative_ids"] = new { type = "array", items = new { type = "integer" } },
        ["batch_number"] = str, ["expiry_date"] = str,
        ["quantity"] = integer, ["free_quantity"] = integer, ["unit_cost"] = num, ["line_total"] = num,
        ["confidence"] = new { type = "string", @enum = new[] { "high", "medium", "low" } },
        ["note"] = str,
    };

    private static readonly object GeminiSchema = BuildGeminiSchema();
    private static object BuildGeminiSchema()
    {
        object N(string t) => new { type = t, nullable = true };
        var props = LineFields(N("string"), N("number"), N("integer"));
        var line = new { type = "object", required = new[] { "raw_text", "product_name", "catalogue_id", "alternative_ids", "batch_number", "expiry_date", "quantity", "unit_cost", "confidence" }, properties = props, propertyOrdering = Order };
        return new
        {
            type = "object", required = new[] { "lines" },
            properties = new Dictionary<string, object>
            {
                ["supplier_name"] = N("string"), ["invoice_number"] = N("string"), ["invoice_date"] = N("string"), ["total_amount"] = N("number"),
                ["lines"] = new { type = "array", items = line },
            },
            propertyOrdering = new[] { "supplier_name", "invoice_number", "invoice_date", "total_amount", "lines" },
        };
    }
}
