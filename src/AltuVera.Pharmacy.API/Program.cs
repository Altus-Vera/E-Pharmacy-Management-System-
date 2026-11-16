using System.Text;
using AltuVera.Pharmacy.Infrastructure;
using AltuVera.Pharmacy.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
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
    });

builder.Services.AddAuthorization();
builder.Services.AddScoped<AltuVera.Pharmacy.API.Security.AuditFilter>();
builder.Services.AddScoped<AltuVera.Pharmacy.API.Services.PrescriptionOcr>();
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

builder.Services.AddCors(options =>
    options.AddPolicy("AllowFrontend", policy =>
        policy.WithOrigins(
                builder.Configuration.GetSection("AllowedOrigins").Get<string[]>()
                ?? ["http://localhost:5120", "http://localhost:5121"])
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials()));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();

// Serve prescription scans
var uploadsPath = Path.Combine(app.Environment.ContentRootPath, "..", "uploads");
if (!Directory.Exists(uploadsPath)) Directory.CreateDirectory(uploadsPath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(Path.GetFullPath(uploadsPath)),
    RequestPath = "/uploads",
});

app.MapControllers();

app.MapGet("/api/health", () => new { status = "ok" });

await AltuVera.Pharmacy.Infrastructure.Data.DatabaseSeeder.SeedAsync(app.Services);

app.Run();
