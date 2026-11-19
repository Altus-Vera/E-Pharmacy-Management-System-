using System.Net;
using System.Net.Http.Json;
using AltuVera.Pharmacy.Domain.Entities;
using AltuVera.Pharmacy.Domain.Enums;
using AltuVera.Pharmacy.Infrastructure.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

namespace AltuVera.Pharmacy.API.Tests;

/// <summary>Real API pipeline on an isolated in-memory database; never touches SQL Server.</summary>
public class ApiFactory : WebApplicationFactory<Program>
{
    public const string Password = "Test@1234";
    private readonly string _dbName = $"tests-{Guid.NewGuid():N}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.AddDbContext<AppDbContext>(o => o
                .UseInMemoryDatabase(_dbName)
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));
        });
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);
        using var scope = host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Users.AddRange(
            NewUser("admin", UserType.SystemAdministrator),
            NewUser("manager", UserType.PharmacyManager),
            NewUser("pharmacist", UserType.Pharmacist),
            NewUser("stockmgr", UserType.StockManager),
            NewUser("inactive", UserType.Pharmacist, isActive: false));
        db.SaveChanges();
        return host;
    }

    private static User NewUser(string username, UserType type, bool isActive = true) => new()
    {
        Name = $"Test {username}",
        Nic = $"NIC-{username}",
        Username = username,
        UserType = type,
        IsActive = isActive,
        HashedPassword = BCrypt.Net.BCrypt.HashPassword(Password, workFactor: 4),
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow,
    };

    public Task<HttpResponseMessage> PostLogin(HttpClient client, string username, string password = Password) =>
        client.PostAsJsonAsync("/api/auth/login", new { username, password });

    /// <summary>A client holding the session cookie for the given user.</summary>
    public async Task<HttpClient> LoginAs(string username)
    {
        var client = CreateClient();
        var res = await PostLogin(client, username);
        if (res.StatusCode != HttpStatusCode.OK)
            throw new InvalidOperationException($"Login as {username} failed: {(int)res.StatusCode}");
        return client;
    }

    public async Task<T> WithDb<T>(Func<AppDbContext, Task<T>> query)
    {
        using var scope = Services.CreateScope();
        return await query(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }
}
