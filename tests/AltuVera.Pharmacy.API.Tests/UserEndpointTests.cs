using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AltuVera.Pharmacy.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.Pharmacy.API.Tests;

public class UserEndpointTests : IDisposable
{
    private readonly ApiFactory _app = new();
    public void Dispose() => _app.Dispose();

    private static object NewUser(string username, string userType) => new
    {
        name = $"New {username}", nic = $"NIC-{username}", user_type = userType,
        username, password = "Pass@12345", contact_number = "0771234567",
    };

    private Task<int> IdOf(string username) =>
        _app.WithDb(db => db.Users.Where(u => u.Username == username).Select(u => u.Id).SingleAsync());

    [Fact]
    public async Task List_never_includes_password_hashes()
    {
        var res = await (await _app.LoginAs("admin")).GetAsync("/api/users");
        var body = await res.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(5, JsonDocument.Parse(body).RootElement.GetArrayLength());
        Assert.DoesNotContain("hashed_password", body);
        Assert.DoesNotContain("$2a$", body);
    }

    [Theory]
    [InlineData("pharmacist")]
    [InlineData("stockmgr")]
    public async Task Non_managers_cannot_list_users(string username)
    {
        var res = await (await _app.LoginAs(username)).GetAsync("/api/users");

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task Get_returns_404_for_a_missing_user()
    {
        var res = await (await _app.LoginAs("admin")).GetAsync("/api/users/99999");

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task Manager_can_create_a_pharmacist_who_can_then_sign_in()
    {
        var res = await (await _app.LoginAs("manager")).PostAsJsonAsync("/api/users", NewUser("newpharm", "pharmacist"));
        var body = await res.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.DoesNotContain("hashed_password", body);
        Assert.Equal(HttpStatusCode.OK, (await _app.PostLogin(_app.CreateClient(), "newpharm", "Pass@12345")).StatusCode);
    }

    [Theory]
    [InlineData("system_administrator")]
    [InlineData("SystemAdministrator")]
    public async Task Manager_cannot_create_an_administrator(string userType)
    {
        var res = await (await _app.LoginAs("manager")).PostAsJsonAsync("/api/users", NewUser("sneaky", userType));

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
        Assert.False(await _app.WithDb(db => db.Users.AnyAsync(u => u.Username == "sneaky")));
    }

    [Fact]
    public async Task Admin_can_create_an_administrator()
    {
        var res = await (await _app.LoginAs("admin")).PostAsJsonAsync("/api/users", NewUser("admin2", "system_administrator"));

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(UserType.SystemAdministrator, await _app.WithDb(db => db.Users.Where(u => u.Username == "admin2").Select(u => u.UserType).SingleAsync()));
    }

    [Fact]
    public async Task Unknown_user_type_is_a_400_not_a_crash()
    {
        var res = await (await _app.LoginAs("admin")).PostAsJsonAsync("/api/users", NewUser("wizard", "wizard"));

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Duplicate_username_is_rejected()
    {
        var res = await (await _app.LoginAs("admin")).PostAsJsonAsync("/api/users", NewUser("pharmacist", "pharmacist"));

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal(1, await _app.WithDb(db => db.Users.CountAsync(u => u.Username == "pharmacist")));
    }

    [Fact]
    public async Task Pharmacist_cannot_create_users()
    {
        var res = await (await _app.LoginAs("pharmacist")).PostAsJsonAsync("/api/users", NewUser("x1", "pharmacist"));

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task Manager_cannot_reset_an_administrators_password()
    {
        var adminId = await IdOf("admin");

        var res = await (await _app.LoginAs("manager")).PatchAsJsonAsync($"/api/users/{adminId}", new { password = "Taken@123" });

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _app.PostLogin(_app.CreateClient(), "admin")).StatusCode);
    }

    [Fact]
    public async Task Manager_cannot_deactivate_an_administrator()
    {
        var adminId = await IdOf("admin");

        var res = await (await _app.LoginAs("manager")).PatchAsJsonAsync($"/api/users/{adminId}", new { is_active = false });

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
        Assert.True(await _app.WithDb(db => db.Users.Where(u => u.Id == adminId).Select(u => u.IsActive).SingleAsync()));
    }

    [Fact]
    public async Task Manager_can_update_a_pharmacist()
    {
        var id = await IdOf("pharmacist");

        var res = await (await _app.LoginAs("manager")).PatchAsJsonAsync($"/api/users/{id}", new { name = "Renamed", contact_number = "0710000000" });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var (name, phone) = await _app.WithDb(async db =>
        {
            var u = await db.Users.SingleAsync(x => x.Id == id);
            return (u.Name, u.ContactNumber);
        });
        Assert.Equal("Renamed", name);
        Assert.Equal("0710000000", phone);
    }

    [Fact]
    public async Task Deactivated_user_can_no_longer_sign_in()
    {
        var id = await IdOf("pharmacist");

        await (await _app.LoginAs("manager")).PatchAsJsonAsync($"/api/users/{id}", new { is_active = false });

        Assert.Equal(HttpStatusCode.Unauthorized, (await _app.PostLogin(_app.CreateClient(), "pharmacist")).StatusCode);
    }

    [Fact]
    public async Task Admin_password_reset_takes_effect()
    {
        var id = await IdOf("stockmgr");

        var res = await (await _app.LoginAs("admin")).PatchAsJsonAsync($"/api/users/{id}", new { password = "Reset@123" });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _app.PostLogin(_app.CreateClient(), "stockmgr")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _app.PostLogin(_app.CreateClient(), "stockmgr", "Reset@123")).StatusCode);
    }
}
