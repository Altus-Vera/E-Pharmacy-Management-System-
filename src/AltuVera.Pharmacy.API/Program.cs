using System.Text;
using System.Threading.RateLimiting;
using AltuVera.Pharmacy.Infrastructure;
using AltuVera.Pharmacy.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var jwtConfig = builder.Configuration.GetSection("Jwt");
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtConfig["Issuer"],
            ValidAudience = jwtConfig["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtConfig["SecretKey"]!)),
        };
        // Read JWT from httpOnly cookie when Authorization header is absent
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                if (string.IsNullOrEmpty(ctx.Token))
                    ctx.Token = ctx.Request.Cookies["access_token"];
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddScoped<AltuVera.Pharmacy.API.Security.AuditFilter>();
builder.Services.AddScoped<AltuVera.Pharmacy.API.Services.PrescriptionOcr>();
builder.Services.AddScoped<AltuVera.Pharmacy.API.Services.InvoiceOcr>();
builder.Services.AddControllers(o => o.Filters.AddService<AltuVera.Pharmacy.API.Security.AuditFilter>())
    .AddJsonOptions(o => {
        o.JsonSerializerOptions.ReferenceHandler =
            System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        o.JsonSerializerOptions.PropertyNamingPolicy =
            System.Text.Json.JsonNamingPolicy.SnakeCaseLower;
        o.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter(
                System.Text.Json.JsonNamingPolicy.SnakeCaseLower));
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("login", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = (ctx, ct) => new ValueTask(ctx.HttpContext.Response.WriteAsJsonAsync(
        new { detail = "Too many login attempts. Wait a minute and try again." }, ct));
});

builder.Services.AddCors(options =>
    options.AddPolicy("AllowFrontend", policy =>
        policy.WithOrigins(
                builder.Configuration.GetSection("AllowedOrigins").Get<string[]>()
                ?? ["http://localhost:5120", "http://localhost:5121"])
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials()));

var app = builder.Build();

// set at send time so they survive the exception handler clearing the response
app.Use(async (ctx, next) =>
{
    ctx.Response.OnStarting(() =>
    {
        var h = ctx.Response.Headers;
        h["X-Content-Type-Options"] = "nosniff";
        h["X-Frame-Options"] = "DENY";
        h["Referrer-Policy"] = "strict-origin-when-cross-origin";
        h["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
        if (ctx.Request.IsHttps)
            h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
        return Task.CompletedTask;
    });
    await next();
});

// logs the full exception; the client only gets a generic message
app.UseExceptionHandler(e => e.Run(ctx =>
{
    ctx.Response.StatusCode = StatusCodes.Status500InternalServerError;
    return ctx.Response.WriteAsJsonAsync(new { detail = "Something went wrong on the server. Please try again." });
}));

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRateLimiter();

app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();

// Serve prescription scans — requires authentication
var uploadsPath = Path.Combine(app.Environment.ContentRootPath, "..", "uploads");
if (!Directory.Exists(uploadsPath)) Directory.CreateDirectory(uploadsPath);
var uploadsRoot = Path.GetFullPath(uploadsPath) + Path.DirectorySeparatorChar;
app.MapGet("/uploads/{**path}", (string path) =>
{
    var fullPath = Path.GetFullPath(Path.Combine(uploadsPath, path));
    if (!fullPath.StartsWith(uploadsRoot, StringComparison.OrdinalIgnoreCase))
        return Results.BadRequest();
    if (!File.Exists(fullPath))
        return Results.NotFound();
    var contentType = Path.GetExtension(fullPath).ToLower() switch
    {
        ".pdf" => "application/pdf",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        _ => "application/octet-stream"
    };
    return Results.File(fullPath, contentType);
}).RequireAuthorization();

app.MapControllers();

app.MapGet("/api/health", () => new { status = "ok" });

// integration tests swap in their own database and data
if (!app.Environment.IsEnvironment("Testing"))
    await AltuVera.Pharmacy.Infrastructure.Data.DatabaseSeeder.SeedAsync(app.Services);

app.Run();

public partial class Program;
