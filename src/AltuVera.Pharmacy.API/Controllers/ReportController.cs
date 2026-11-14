using AltuVera.Pharmacy.Domain.Enums;
using AltuVera.Pharmacy.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.Pharmacy.API.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize]
public class ReportController(AppDbContext db) : ControllerBase
{
    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard()
    {
        var today = DateTime.UtcNow.Date;
        var todayStart = today;
        var todayEnd = today.AddDays(1);

        var totalDrugs = await db.Drugs.CountAsync(d => d.IsActive);
        var lowStockCount = await db.Drugs.CountAsync(d => d.IsActive && d.Quantity <= d.LowStockThreshold);
        var expiringThreshold = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(90));
        var expiringSoonCount = await db.Drugs.CountAsync(d => d.ExpiryDate.HasValue && d.ExpiryDate <= expiringThreshold);
        var todaySales = await db.Invoices.Where(i => i.CreatedAt >= todayStart && i.CreatedAt < todayEnd && i.Status == InvoiceStatus.Completed).SumAsync(i => (decimal?)i.TotalAmount) ?? 0;
        var totalCustomers = await db.Customers.CountAsync(c => c.IsActive);
        var pendingPurchaseOrders = await db.PurchaseOrders.CountAsync(po => po.Status == PurchaseOrderStatus.Submitted);

        return Ok(new
        {
            total_drugs = totalDrugs,
            low_stock_count = lowStockCount,
            expiring_soon_count = expiringSoonCount,
            today_sales = todaySales,
            total_customers = totalCustomers,
            pending_purchase_orders = pendingPurchaseOrders,
        });
    }

    [HttpGet("sales")]
    public async Task<IActionResult> SalesReport([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var start = from ?? DateTime.UtcNow.AddDays(-30);
        var end = to ?? DateTime.UtcNow;
        var invoices = await db.Invoices
            .Where(i => i.CreatedAt >= start && i.CreatedAt <= end && i.Status == InvoiceStatus.Completed)
            .Include(i => i.Customer).Include(i => i.Items)
            .OrderByDescending(i => i.CreatedAt).ToListAsync();
        return Ok(invoices);
    }

    [HttpGet("stock")]
    public async Task<IActionResult> StockReport()
    {
        var drugs = await db.Drugs.Include(d => d.Category).Where(d => d.IsActive).OrderBy(d => d.BrandName).ToListAsync();
        return Ok(drugs);
    }

    [HttpGet("purchase")]
    public async Task<IActionResult> PurchaseReport([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var start = from ?? DateTime.UtcNow.AddDays(-30);
        var end = to ?? DateTime.UtcNow;
        var pos = await db.PurchaseOrders.Include(po => po.Supplier).Include(po => po.Items)
            .Where(po => po.CreatedAt >= start && po.CreatedAt <= end)
            .OrderByDescending(po => po.CreatedAt).ToListAsync();
        return Ok(pos);
    }
}
