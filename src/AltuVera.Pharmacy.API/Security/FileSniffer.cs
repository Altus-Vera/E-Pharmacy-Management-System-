namespace AltuVera.Pharmacy.API.Security;

/// <summary>Detects an upload's real type from its first bytes; the browser's Content-Type and file name are not trusted.</summary>
public static class FileSniffer
{
    public static string? Detect(ReadOnlySpan<byte> b)
    {
        if (b.StartsWith((ReadOnlySpan<byte>)[0xFF, 0xD8, 0xFF])) return "image/jpeg";
        if (b.StartsWith((ReadOnlySpan<byte>)[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return "image/png";
        if (b.StartsWith("GIF87a"u8) || b.StartsWith("GIF89a"u8)) return "image/gif";
        if (b.Length >= 12 && b.StartsWith("RIFF"u8) && b.Slice(8, 4).SequenceEqual("WEBP"u8)) return "image/webp";
        if (b.StartsWith("%PDF-"u8)) return "application/pdf";
        return null;
    }

    public static string ExtFor(string type) => type switch
    {
        "image/png" => ".png",
        "image/gif" => ".gif",
        "image/webp" => ".webp",
        "application/pdf" => ".pdf",
        _ => ".jpg",
    };

    public static async Task<byte[]> ReadAllAsync(IFormFile file, CancellationToken ct)
    {
        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        return ms.ToArray();
    }
}
