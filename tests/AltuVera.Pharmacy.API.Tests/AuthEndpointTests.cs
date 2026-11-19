using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.Pharmacy.API.Tests;

// a fresh app per test keeps the per-client login rate limit from leaking between tests
public class AuthEndpointTests : IDisposable
{
    private readonly ApiFactory _app = new();
    public void Dispose() => _app.Dispose();

    private static async Task<JsonElement> Json(HttpResponseMessage res) =>
        JsonDocument.Parse(await res.Content.ReadAsStringAsync()).RootElement;

    [Fact]
    public async Task Login_sets_httponly_strict_cookie_and_keeps_token_out_of_body()
    {
        var client = _app.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

        var res = await _app.PostLogin(client, "admin");

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var cookie = Assert.Single(res.Headers.GetValues("Set-Cookie"), c => c.StartsWith("access_token="));
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=strict", cookie, StringComparison.OrdinalIgnoreCase);

        var body = await Json(res);
        Assert.False(body.TryGetProperty("access_token", out _));
        Assert.Equal("admin", body.GetProperty("user").GetProperty("username").GetString());
        Assert.Equal("systemadministrator", body.GetProperty("user").GetProperty("user_type").GetString());
    }

    [Theory]
    [InlineData("admin", "wrong-password")]
    [InlineData("nobody", ApiFactory.Password)]
    [InlineData("inactive", ApiFactory.Password)]
    public async Task Login_rejects_bad_credentials_with_same_message(string username, string password)
    {
        var res = await _app.PostLogin(_app.CreateClient(), username, password);

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        Assert.Equal("Invalid credentials", (await Json(res)).GetProperty("detail").GetString());
    }

    [Fact]
    public async Task Five_failed_logins_lock_the_account_even_for_the_right_password()
    {
        var client = _app.CreateClient();
        for (var i = 0; i < 5; i++)
            await _app.PostLogin(client, "pharmacist", "wrong-password");

        var res = await _app.PostLogin(client, "pharmacist");

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        Assert.Contains("locked", (await Json(res)).GetProperty("detail").GetString(), StringComparison.OrdinalIgnoreCase);
        var lockedUntil = await _app.WithDb(db => db.Users.Where(u => u.Username == "pharmacist").Select(u => u.LockedUntil).SingleAsync());
        Assert.True(lockedUntil > DateTime.UtcNow);
    }

    [Fact]
    public async Task Successful_login_resets_the_failed_attempt_count()
    {
        var client = _app.CreateClient();
        await _app.PostLogin(client, "pharmacist", "wrong-password");
        await _app.PostLogin(client, "pharmacist", "wrong-password");

        await _app.PostLogin(client, "pharmacist");

        var attempts = await _app.WithDb(db => db.Users.Where(u => u.Username == "pharmacist").Select(u => u.FailedLoginAttempts).SingleAsync());
        Assert.Equal(0, attempts);
    }

    [Fact]
    public async Task Eleventh_login_in_a_minute_is_rate_limited()
    {
        var client = _app.CreateClient();
        for (var i = 0; i < 10; i++)
            Assert.NotEqual(HttpStatusCode.TooManyRequests, (await _app.PostLogin(client, "nobody", "x")).StatusCode);

        var res = await _app.PostLogin(client, "admin");

        Assert.Equal(HttpStatusCode.TooManyRequests, res.StatusCode);
        Assert.Contains("Too many", (await Json(res)).GetProperty("detail").GetString());
    }

    [Fact]
    public async Task Protected_endpoint_requires_the_session_cookie()
    {
        var anonymous = await _app.CreateClient().GetAsync("/api/users");
        var signedIn = await (await _app.LoginAs("admin")).GetAsync("/api/users");

        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
        Assert.Equal(HttpStatusCode.OK, signedIn.StatusCode);
    }

    [Fact]
    public async Task Tampered_cookie_is_rejected()
    {
        var client = _app.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        client.DefaultRequestHeaders.Add("Cookie", "access_token=not.a.real.jwt");

        var res = await client.GetAsync("/api/users");

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Bearer_header_is_still_accepted()
    {
        var login = await _app.PostLogin(_app.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false }), "admin");
        var token = login.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token=")).Split(';')[0]["access_token=".Length..];
        var client = _app.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var res = await client.GetAsync("/api/users");

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task Logout_clears_the_cookie()
    {
        var client = await _app.LoginAs("admin");

        var logout = await client.PostAsync("/api/auth/logout", null);
        var after = await client.GetAsync("/api/users");

        Assert.Equal(HttpStatusCode.OK, logout.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, after.StatusCode);
    }

    [Fact]
    public async Task Change_password_requires_the_current_password()
    {
        var client = await _app.LoginAs("stockmgr");

        var wrong = await client.PostAsJsonAsync("/api/auth/change-password", new { current_password = "nope", new_password = "New@12345" });
        var ok = await client.PostAsJsonAsync("/api/auth/change-password", new { current_password = ApiFactory.Password, new_password = "New@12345" });

        Assert.Equal(HttpStatusCode.BadRequest, wrong.StatusCode);
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _app.PostLogin(_app.CreateClient(), "stockmgr")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _app.PostLogin(_app.CreateClient(), "stockmgr", "New@12345")).StatusCode);
    }

    [Fact]
    public async Task Change_password_requires_sign_in()
    {
        var res = await _app.CreateClient().PostAsJsonAsync("/api/auth/change-password", new { current_password = "a", new_password = "b" });

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Responses_carry_security_headers()
    {
        var res = await _app.CreateClient().GetAsync("/api/users");

        Assert.Equal("nosniff", res.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", res.Headers.GetValues("X-Frame-Options").Single());
    }
}
