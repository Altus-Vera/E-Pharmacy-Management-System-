using AltuVera.Pharmacy.Domain.Entities;
using AltuVera.Pharmacy.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AltuVera.Pharmacy.Infrastructure.Data;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        await db.Database.MigrateAsync();

        if (await db.Users.AnyAsync()) return;

        var users = new[]
        {
            new User { Name = "System Administrator", Nic = "199012345678", UserType = UserType.SystemAdministrator,
                Username = "admin",      HashedPassword = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
                ContactNumber = "0771234567", IsActive = true },
            new User { Name = "Pharmacist One",       Nic = "199112345678", UserType = UserType.Pharmacist,
                Username = "pharmacist", HashedPassword = BCrypt.Net.BCrypt.HashPassword("Pharm@123"),
                ContactNumber = "0772345678", IsActive = true },
            new User { Name = "Stock Manager",        Nic = "199212345678", UserType = UserType.StockManager,
                Username = "stockmgr",   HashedPassword = BCrypt.Net.BCrypt.HashPassword("Stock@123"),
                ContactNumber = "0773456789", IsActive = true },
            new User { Name = "Pharmacy Manager",     Nic = "199312345678", UserType = UserType.PharmacyManager,
                Username = "manager",    HashedPassword = BCrypt.Net.BCrypt.HashPassword("Manager@123"),
                ContactNumber = "0774567890", IsActive = true },
        };

        db.Users.AddRange(users);
        await db.SaveChangesAsync();
    }
}
