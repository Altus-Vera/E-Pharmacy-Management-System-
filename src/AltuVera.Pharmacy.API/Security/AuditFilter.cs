using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using AltuVera.Pharmacy.Domain.Entities;
using AltuVera.Pharmacy.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace AltuVera.Pharmacy.API.Security;

/// <summary>
/// Writes an audit_logs row for every successful create/update/delete request
/// ("System Auditing" — Pharmacy Manager responsibility). Passwords are masked.
/// </summary>
public partial class AuditFilter(IServiceScopeFactory scopes, ILogger<AuditFilter> log) : IAsyncActionFilter
{
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };

    public async Task OnActionExecutionAsync(ActionExecutingContext ctx, ActionExecutionDelegate next)
    {
        var method = ctx.HttpContext.Request.Method;
        var path = ctx.HttpContext.Request.Path.Value ?? "";
        // Snapshot the request body arguments before the action runs
        var args = ctx.ActionArguments.Values.FirstOrDefault(a => a is not null && a is not string && !a.GetType().IsPrimitive && a is not IFormFile);

        var executed = await next();

        if (HttpMethods.IsGet(method) || path.StartsWith("/api/auth/login", StringComparison.OrdinalIgnoreCase)) return;
        var status = executed.Result switch
        {
            ObjectResult o => o.StatusCode ?? 200,
            StatusCodeResult s => s.StatusCode,
            _ => executed.Exception is null ? 200 : 500,
        };
        if (status >= 400 || executed.Exception is not null) return;

        try
        {
            var segs = path.Trim('/').Split('/');
            var entity = segs.Length > 1 ? segs[1] : path;
            int? entityId = null;
            if (ctx.RouteData.Values.TryGetValue("id", out var idObj) && int.TryParse(idObj?.ToString(), out var id)) entityId = id;
            else if (executed.Result is ObjectResult { Value: not null } r)
            {
                var prop = r.Value.GetType().GetProperty("Id");
                if (prop?.GetValue(r.Value) is int newId) entityId = newId;
            }

            string? body = null;
            if (args is not null)
            {
                body = JsonSerializer.Serialize(args, args.GetType(), Json);
                body = PasswordRx().Replace(body, "\"$1\":\"***\"");
                if (body.Length > 4000) body = body[..4000];
            }

            var userId = int.TryParse(ctx.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : (int?)null;
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.AuditLogs.Add(new AuditLog
            {
                UserId = userId,
                Action = $"{method} {path}",
                EntityType = entity,
                EntityId = entityId,
                NewValue = body,
                IpAddress = ctx.HttpContext.Connection.RemoteIpAddress?.ToString(),
                CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Audit log write failed for {Method} {Path}", method, path);
        }
    }

    [GeneratedRegex("\"([a-z_]*password[a-z_]*)\":\"[^\"]*\"", RegexOptions.IgnoreCase)]
    private static partial Regex PasswordRx();
}
