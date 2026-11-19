using AltuVera.Pharmacy.API.Security;
using AltuVera.Pharmacy.Domain.Entities;
using AltuVera.Pharmacy.Domain.Enums;
using AltuVera.Pharmacy.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.Pharmacy.API.Controllers;

/// <summary>
/// Reports from the System Requirements "Reporting Requirements" section:
/// small/medium pharmacy reports plus the pharmacy-chain listings.
/// </summary>
[ApiController]
[Route("api/reports")]
[Authorize(Roles = R.Stock)]
public class ReportsExtraController(AppDbContext db) : ControllerBase
{
    private static object DrugRow(Drug d) => new
    {
        d.Id, drug_id = d.Id, d.ItemCode, d.BrandName, d.GenericName, d.Strength, d.DosageForm, d.BatchNumber,
        d.ExpiryDate, d.UnitPrice, d.Quantity, current_stock = d.Quantity, d.LowStockThreshold, d.ReorderLevel,
        d.IsPrescriptionOnly, d.IsHighAlert, d.IsNarcotic, stock_value = d.Quantity * d.UnitPrice,
    };

    // ── Small & medium pharmacy reports ──────────────────────────────────────

    [HttpGet("near-expiry")]
    public async Task<IActionResult> NearExpiry([FromQuery] int days = 90)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var limit = today.AddDays(days);
        var drugs = await db.Drugs.AsNoTracking().Where(d => d.IsActive && d.ExpiryDate != null && d.ExpiryDate <= limit)
            .OrderBy(d => d.ExpiryDate).ToListAsync();
        return Ok(drugs.Select(d => new
        {
            d.Id, drug_id = d.Id, d.ItemCode, d.BrandName, d.GenericName, d.Strength, d.BatchNumber, d.ExpiryDate,
            d.Quantity, d.UnitPrice, stock_value = d.Quantity * d.UnitPrice,
            days_left = d.ExpiryDate!.Value.DayNumber - today.DayNumber,
        }));
    }

    [HttpGet("low-stock")]
    public async Task<IActionResult> LowStock()
    {
        var drugs = await db.Drugs.AsNoTracking()
            .Where(d => d.IsActive && (d.Quantity <= d.LowStockThreshold || d.Quantity <= d.ReorderLevel))
            .OrderBy(d => d.Quantity).ToListAsync();
        return Ok(drugs.Select(DrugRow));
    }

    private async Task<List<MovingRow>> Moving(int days)
    {
        var since = DateTime.UtcNow.AddDays(-days);
        var agg = await db.Invoices.AsNoTracking()
            .Where(i => i.Status == InvoiceStatus.Completed && i.CreatedAt >= since)
            .SelectMany(i => i.Items.Select(it => new { it.DrugId, it.Quantity, it.LineTotal, InvoiceId = i.Id }))
            .GroupBy(s => s.DrugId)
            .Select(g => new { DrugId = g.Key, Qty = g.Sum(x => x.Quantity), Rev = g.Sum(x => x.LineTotal), Tx = g.Select(x => x.InvoiceId).Distinct().Count() })
            .ToDictionaryAsync(x => x.DrugId);
        var drugs = await db.Drugs.AsNoTracking().Where(d => d.IsActive).ToListAsync();
        return drugs.Select(d => agg.TryGetValue(d.Id, out var a)
            ? new MovingRow(d.Id, d.ItemCode, d.BrandName, d.GenericName, d.Strength, a.Qty, a.Tx, a.Rev, d.Quantity)
            : new MovingRow(d.Id, d.ItemCode, d.BrandName, d.GenericName, d.Strength, 0, 0, 0, d.Quantity)).ToList();
    }

    [HttpGet("fast-moving")]
    public async Task<IActionResult> FastMoving([FromQuery] int days = 30, [FromQuery] int top = 50) =>
        Ok((await Moving(days)).Where(r => r.TotalSold > 0).OrderByDescending(r => r.TotalSold).Take(top));

    [HttpGet("slow-moving")]
    public async Task<IActionResult> SlowMoving([FromQuery] int days = 30) =>
        Ok((await Moving(days)).Where(r => r.TotalSold <= 5 && r.CurrentStock > 0).OrderBy(r => r.TotalSold).ThenByDescending(r => r.CurrentStock));

    [HttpGet("stock-valuation")]
    public async Task<IActionResult> StockValuation()
    {
        var drugs = await db.Drugs.AsNoTracking().Where(d => d.IsActive).OrderBy(d => d.BrandName).ToListAsync();
        return Ok(new
        {
            generated_at = DateTime.UtcNow,
            total_items = drugs.Count,
            total_units = drugs.Sum(d => d.Quantity),
            total_stock_value = drugs.Sum(d => d.Quantity * d.UnitPrice),
            items = drugs.Select(DrugRow),
        });
    }

    [HttpGet("stock-taking")]
    public async Task<IActionResult> StockTaking()
    {
        var drugs = await db.Drugs.AsNoTracking().Where(d => d.IsActive).OrderBy(d => d.BrandName).ThenBy(d => d.ItemCode).ToListAsync();
        return Ok(drugs.Select(DrugRow));
    }

    [HttpGet("sales-summary")]
    public async Task<IActionResult> SalesSummary([FromQuery(Name = "date_from")] DateTime? from, [FromQuery(Name = "date_to")] DateTime? to)
    {
        var start = from ?? DateTime.UtcNow.Date.AddDays(-30);
        var end = (to ?? DateTime.UtcNow).Date.AddDays(1);
        var inv = await db.Invoices.AsNoTracking().Where(i => i.CreatedAt >= start && i.CreatedAt < end)
            .OrderByDescending(i => i.CreatedAt).ToListAsync();
        var done = inv.Where(i => i.Status == InvoiceStatus.Completed).ToList();
        return Ok(new
        {
            date_from = start, date_to = end.AddDays(-1),
            completed_invoices = done.Count,
            cancelled_invoices = inv.Count - done.Count,
            total_revenue = done.Sum(i => i.TotalAmount),
            total_discount = done.Sum(i => i.DiscountAmount),
            total_tax = done.Sum(i => i.TaxAmount),
            by_payment_mode = done.GroupBy(i => i.PaymentMode.ToString().ToLower()).ToDictionary(g => g.Key, g => g.Sum(i => i.TotalAmount)),
            invoices = inv.Select(i => new { i.Id, i.InvoiceNumber, i.CreatedAt, i.PaymentMode, i.Status, i.DiscountAmount, i.TotalAmount }),
        });
    }

    /// <summary>Daily / weekly / monthly stock movement report.</summary>
    [HttpGet("stock-movement")]
    public async Task<IActionResult> StockMovementReport([FromQuery] string period = "daily", [FromQuery] DateTime? date = null)
    {
        var anchor = (date ?? DateTime.UtcNow).Date;
        DateTime start = period switch
        {
            "weekly" => anchor.AddDays(-(((int)anchor.DayOfWeek + 6) % 7)),
            "monthly" => new DateTime(anchor.Year, anchor.Month, 1),
            _ => anchor,
        };
        DateTime end = period switch { "weekly" => start.AddDays(7), "monthly" => start.AddMonths(1), _ => start.AddDays(1) };
        var mv = await db.StockMovements.AsNoTracking().Where(m => m.CreatedAt >= start && m.CreatedAt < end).ToListAsync();
        var drugs = await db.Drugs.AsNoTracking().ToDictionaryAsync(d => d.Id);
        var rows = mv.GroupBy(m => m.DrugId).Select(g =>
        {
            drugs.TryGetValue(g.Key, out var d);
            int Sum(MovementType t) => g.Where(m => m.MovementType == t).Sum(m => m.Quantity);
            var net = g.Sum(m => m.Quantity);
            var closing = d?.Quantity ?? 0;
            return new
            {
                drug_id = g.Key, item_code = d?.ItemCode, brand_name = d?.BrandName,
                received = Sum(MovementType.Purchase) + Sum(MovementType.TransferIn),
                sold = -Sum(MovementType.Sale),
                adjusted = Sum(MovementType.Adjustment),
                returned_to_supplier = -Sum(MovementType.ReturnToSupplier),
                transferred_out = -Sum(MovementType.TransferOut),
                net_change = net, current_stock = closing,
            };
        }).OrderBy(r => r.brand_name).ToList();
        return Ok(new { period, start, end = end.AddDays(-1), rows });
    }

    // ── Pharmacy chain listings ──────────────────────────────────────────────

    public record Col(string key, string label, string type = "text");
    private IActionResult Listing(string title, IEnumerable<Col> cols, IEnumerable<object> rows) =>
        Ok(new { title, columns = cols, rows });

    [HttpGet("listings")]
    public IActionResult ListingCatalog() => Ok(new[]
    {
        new { key = "purchase-requisitions", label = "Purchase Requisition Listing" },
        new { key = "purchase-orders", label = "Purchase Order Listing" },
        new { key = "pending-purchase-orders", label = "Pending Purchase Orders" },
        new { key = "cancelled-purchase-orders", label = "Purchase Order (Cancelled) Listing" },
        new { key = "purchase-summary", label = "Purchase Summary" },
        new { key = "goods-receipts", label = "Goods Receipt Listing" },
        new { key = "goods-receipts-category", label = "Goods Receipt (Category Wise) Listing" },
        new { key = "goods-receipts-free", label = "Goods Receipt (Free) Quantity Listing" },
        new { key = "supplier-grn", label = "Supplier Wise GRN Listing" },
        new { key = "supplier-items", label = "Supplier Wise Item Listing" },
        new { key = "supplier-returns", label = "Supplier Returns Listing" },
        new { key = "goods-transfers", label = "Goods Transfer Listing" },
        new { key = "stock-balance", label = "Stock Balance Report" },
        new { key = "stock-taking", label = "Stock Taking Report A to Z" },
        new { key = "stock-valuation-asat", label = "Stock Valuation As At Date" },
        new { key = "bin-card", label = "BIN Card Report" },
        new { key = "stock-age-qty", label = "Stock Age Analysis Report (Quantity)" },
        new { key = "stock-age-value", label = "Stock Age Analysis Value Report" },
        new { key = "expiry-dates", label = "Stocks Expiry Dates Listing" },
        new { key = "reorder-items", label = "Re Order Level Items" },
        new { key = "cancelled-invoices", label = "Cancelled Invoice Listing" },
        new { key = "cashier-invoices", label = "Cashier wise Invoice Listing" },
        new { key = "category-sales", label = "Category wise Sales Listing" },
        new { key = "supplier-sales", label = "Supplier wise Sales Listing" },
    });

    [HttpGet("listings/{key}")]
    public async Task<IActionResult> Listing(string key, [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] DateTime? asAt, [FromQuery] int? drugId)
    {
        var start = from ?? DateTime.UtcNow.Date.AddDays(-30);
        var end = (to ?? DateTime.UtcNow).Date.AddDays(1);
        var dStart = DateOnly.FromDateTime(start); var dEnd = DateOnly.FromDateTime(end);
        var drugs = await db.Drugs.AsNoTracking().Include(d => d.Category).ToDictionaryAsync(d => d.Id);
        var suppliers = await db.Suppliers.AsNoTracking().ToDictionaryAsync(s => s.Id, s => s.Name);
        var users = await db.Users.AsNoTracking().ToDictionaryAsync(u => u.Id, u => u.Name);
        string Drug(int id) => drugs.TryGetValue(id, out var d) ? $"{d.BrandName} ({d.ItemCode})" : $"#{id}";
        string Sup(int? id) => id is int i && suppliers.TryGetValue(i, out var n) ? n : "—";
        string Usr(int? id) => id is int i && users.TryGetValue(i, out var n) ? n : "—";
        string Cat(int id) => drugs.TryGetValue(id, out var d) ? d.Category?.Name ?? "Uncategorised" : "—";
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        switch (key)
        {
            case "purchase-requisitions":
            {
                var r = await db.PurchaseRequisitions.AsNoTracking().Where(x => x.CreatedAt >= start && x.CreatedAt < end).OrderByDescending(x => x.CreatedAt).ToListAsync();
                return Listing("Purchase Requisition Listing",
                    [new("number", "Req #"), new("date", "Date", "date"), new("drug", "Drug"), new("qty", "Qty", "num"), new("status", "Status"), new("by", "Requested By")],
                    r.Select(x => new { number = x.RequisitionNumber, date = x.CreatedAt, drug = Drug(x.DrugId), qty = x.QuantityRequested, status = x.Status, by = Usr(x.RequestedByUserId) }));
            }
            case "purchase-orders":
            case "pending-purchase-orders":
            case "cancelled-purchase-orders":
            {
                var q = db.PurchaseOrders.AsNoTracking().Include(p => p.Items).AsQueryable();
                if (key == "pending-purchase-orders") q = q.Where(p => p.Status == PurchaseOrderStatus.Draft || p.Status == PurchaseOrderStatus.Submitted || p.Status == PurchaseOrderStatus.PartiallyReceived);
                else q = q.Where(p => p.OrderDate >= dStart && p.OrderDate < dEnd);
                if (key == "cancelled-purchase-orders") q = q.Where(p => p.Status == PurchaseOrderStatus.Cancelled);
                var r = await q.OrderByDescending(p => p.OrderDate).ToListAsync();
                var title = key == "pending-purchase-orders" ? "Pending Purchase Orders" : key == "cancelled-purchase-orders" ? "Purchase Order (Cancelled) Listing" : "Purchase Order Listing";
                return Listing(title,
                    [new("number", "PO #"), new("date", "Order Date", "date"), new("expected", "Expected", "date"), new("supplier", "Supplier"), new("lines", "Lines", "num"), new("value", "Value", "money"), new("status", "Status")],
                    r.Select(p => new { number = p.OrderNumber, date = p.OrderDate, expected = p.ExpectedDeliveryDate, supplier = Sup(p.SupplierId), lines = p.Items.Count, value = p.Items.Sum(i => i.QuantityOrdered * i.UnitCost), status = p.Status.ToString() }));
            }
            case "purchase-summary":
            {
                var g = await db.GoodsReceipts.AsNoTracking().Include(x => x.Items).Where(x => x.ReceivedDate >= dStart && x.ReceivedDate < dEnd).ToListAsync();
                var inv = await db.PurchaseInvoices.AsNoTracking().Where(x => x.InvoiceDate >= dStart && x.InvoiceDate < dEnd).ToListAsync();
                var rows = suppliers.Keys.Select(sid => new
                {
                    supplier = Sup(sid),
                    grns = g.Count(x => x.SupplierId == sid),
                    received_value = g.Where(x => x.SupplierId == sid).SelectMany(x => x.Items).Where(i => !i.IsFreeGoods).Sum(i => i.QuantityReceived * i.UnitCost),
                    invoiced = inv.Where(x => x.SupplierId == sid).Sum(x => x.TotalAmount),
                    unpaid = inv.Where(x => x.SupplierId == sid && !x.IsPaid).Sum(x => x.TotalAmount),
                }).Where(r => r.grns > 0 || r.invoiced > 0).OrderByDescending(r => r.received_value);
                return Listing("Purchase Summary",
                    [new("supplier", "Supplier"), new("grns", "GRNs", "num"), new("received_value", "Received Value", "money"), new("invoiced", "Invoiced", "money"), new("unpaid", "Unpaid", "money")], rows);
            }
            case "goods-receipts":
            case "supplier-grn":
            case "goods-receipts-category":
            case "goods-receipts-free":
            {
                var g = await db.GoodsReceipts.AsNoTracking().Include(x => x.Items).Where(x => x.ReceivedDate >= dStart && x.ReceivedDate < dEnd).OrderByDescending(x => x.ReceivedDate).ToListAsync();
                if (key == "goods-receipts")
                    return Listing("Goods Receipt Listing",
                        [new("number", "GRN #"), new("date", "Received", "date"), new("supplier", "Supplier"), new("lines", "Lines", "num"), new("value", "Value", "money"), new("by", "Received By")],
                        g.Select(x => new { number = x.GrnNumber, date = x.ReceivedDate, supplier = Sup(x.SupplierId), lines = x.Items.Count, value = x.Items.Where(i => !i.IsFreeGoods).Sum(i => i.QuantityReceived * i.UnitCost), by = Usr(x.ReceivedByUserId) }));
                if (key == "supplier-grn")
                    return Listing("Supplier Wise GRN Listing",
                        [new("supplier", "Supplier"), new("grns", "GRNs", "num"), new("units", "Units", "num"), new("value", "Value", "money"), new("last", "Last Receipt", "date")],
                        g.GroupBy(x => x.SupplierId).Select(s => new { supplier = Sup(s.Key), grns = s.Count(), units = s.SelectMany(x => x.Items).Sum(i => i.QuantityReceived), value = s.SelectMany(x => x.Items).Where(i => !i.IsFreeGoods).Sum(i => i.QuantityReceived * i.UnitCost), last = s.Max(x => x.ReceivedDate) }).OrderBy(r => r.supplier));
                var lines = g.SelectMany(x => x.Items.Select(i => new { grn = x, i }));
                if (key == "goods-receipts-free")
                    return Listing("Goods Receipt (Free) Quantity Listing",
                        [new("number", "GRN #"), new("date", "Received", "date"), new("supplier", "Supplier"), new("drug", "Drug"), new("free_qty", "Free Qty", "num"), new("value", "Est. Value", "money")],
                        lines.Where(l => l.i.IsFreeGoods).Select(l => new { number = l.grn.GrnNumber, date = l.grn.ReceivedDate, supplier = Sup(l.grn.SupplierId), drug = Drug(l.i.DrugId), free_qty = l.i.QuantityReceived, value = l.i.QuantityReceived * l.i.UnitCost }));
                return Listing("Goods Receipt (Category Wise) Listing",
                    [new("category", "Category"), new("lines", "Lines", "num"), new("units", "Units", "num"), new("value", "Value", "money")],
                    lines.GroupBy(l => Cat(l.i.DrugId)).Select(c => new { category = c.Key, lines = c.Count(), units = c.Sum(l => l.i.QuantityReceived), value = c.Where(l => !l.i.IsFreeGoods).Sum(l => l.i.QuantityReceived * l.i.UnitCost) }).OrderBy(r => r.category));
            }
            case "supplier-items":
                return Listing("Supplier Wise Item Listing",
                    [new("supplier", "Supplier"), new("item_code", "Code"), new("drug", "Drug"), new("stock", "Stock", "num"), new("price", "Unit Price", "money")],
                    drugs.Values.Where(d => d.IsActive).OrderBy(d => Sup(d.SupplierId)).ThenBy(d => d.BrandName)
                        .Select(d => new { supplier = Sup(d.SupplierId), item_code = d.ItemCode, drug = d.BrandName, stock = d.Quantity, price = d.UnitPrice }));
            case "supplier-returns":
            {
                var r = await db.SupplierReturns.AsNoTracking().Where(x => x.CreatedAt >= start && x.CreatedAt < end).OrderByDescending(x => x.CreatedAt).ToListAsync();
                return Listing("Supplier Returns Listing",
                    [new("number", "Return #"), new("date", "Date", "date"), new("supplier", "Supplier"), new("drug", "Drug"), new("qty", "Qty", "num"), new("value", "Value", "money"), new("reason", "Reason")],
                    r.Select(x => new { number = x.ReturnNumber, date = x.CreatedAt, supplier = Sup(x.SupplierId), drug = Drug(x.DrugId), qty = x.Quantity, value = x.Quantity * x.UnitCost, reason = x.Reason }));
            }
            case "goods-transfers":
            {
                var outlets = await db.Outlets.AsNoTracking().ToDictionaryAsync(o => o.Id, o => o.Name);
                var r = await db.StockTransfers.AsNoTracking().Where(x => x.CreatedAt >= start && x.CreatedAt < end).OrderByDescending(x => x.CreatedAt).ToListAsync();
                return Listing("Goods Transfer Listing",
                    [new("number", "Transfer #"), new("date", "Date", "date"), new("from", "From"), new("to", "To"), new("drug", "Drug"), new("qty", "Qty", "num"), new("status", "Status")],
                    r.Select(x => new { number = x.TransferNumber, date = x.CreatedAt, from = outlets.GetValueOrDefault(x.FromOutletId, "—"), to = outlets.GetValueOrDefault(x.ToOutletId, "—"), drug = Drug(x.DrugId), qty = x.Quantity, status = x.Status.ToString() }));
            }
            case "stock-balance":
            case "stock-taking":
                return Listing(key == "stock-balance" ? "Stock Balance Report" : "Stock Taking Report A to Z",
                    [new("item_code", "Code"), new("drug", "Drug"), new("generic", "Generic"), new("batch", "Batch"), new("expiry", "Expiry", "date"), new("stock", "System Qty", "num"), new("counted", "Counted"), new("value", "Value", "money")],
                    drugs.Values.Where(d => d.IsActive).OrderBy(d => d.BrandName)
                        .Select(d => new { item_code = d.ItemCode, drug = d.BrandName, generic = d.GenericName, batch = d.BatchNumber, expiry = d.ExpiryDate, stock = d.Quantity, counted = "", value = d.Quantity * d.UnitPrice }));
            case "stock-valuation-asat":
            {
                var at = (asAt ?? DateTime.UtcNow).Date.AddDays(1);
                var later = await db.StockMovements.AsNoTracking().Where(m => m.CreatedAt >= at).GroupBy(m => m.DrugId).Select(g => new { g.Key, q = g.Sum(m => m.Quantity) }).ToDictionaryAsync(x => x.Key, x => x.q);
                var rows = drugs.Values.Where(d => d.IsActive).Select(d =>
                {
                    var qty = d.Quantity - later.GetValueOrDefault(d.Id);
                    return new { item_code = d.ItemCode, drug = d.BrandName, qty, price = d.UnitPrice, value = qty * d.UnitPrice };
                }).OrderBy(r => r.drug).ToList();
                return Listing($"Stock Valuation As At {at.AddDays(-1):yyyy-MM-dd} (total Rs. {rows.Sum(r => r.value):N2})",
                    [new("item_code", "Code"), new("drug", "Drug"), new("qty", "Qty", "num"), new("price", "Unit Price", "money"), new("value", "Value", "money")], rows);
            }
            case "bin-card":
            {
                if (drugId is null) return BadRequest(new { detail = "Choose a drug for the BIN card." });
                var mv = await db.StockMovements.AsNoTracking().Where(m => m.DrugId == drugId).OrderBy(m => m.CreatedAt).ToListAsync();
                var current = drugs.TryGetValue(drugId.Value, out var dd) ? dd.Quantity : 0;
                var balance = current - mv.Sum(m => m.Quantity); // opening balance before first movement
                var rows = mv.Select(m => { balance += m.Quantity; return new { date = m.CreatedAt, type = m.MovementType.ToString(), reference = $"{m.ReferenceType} {m.ReferenceId}".Trim(), received = m.Quantity > 0 ? m.Quantity : 0, issued = m.Quantity < 0 ? -m.Quantity : 0, balance, by = Usr(m.PerformedByUserId), notes = m.Notes }; }).ToList();
                return Listing($"BIN Card — {Drug(drugId.Value)}",
                    [new("date", "Date", "date"), new("type", "Type"), new("reference", "Reference"), new("received", "In", "num"), new("issued", "Out", "num"), new("balance", "Balance", "num"), new("by", "By"), new("notes", "Notes")], rows);
            }
            case "stock-age-qty":
            case "stock-age-value":
            {
                var lastIn = await db.StockMovements.AsNoTracking().Where(m => m.Quantity > 0 && (m.MovementType == MovementType.Purchase || m.MovementType == MovementType.TransferIn))
                    .GroupBy(m => m.DrugId).Select(g => new { g.Key, at = g.Max(m => m.CreatedAt) }).ToDictionaryAsync(x => x.Key, x => x.at);
                var rows = drugs.Values.Where(d => d.IsActive && d.Quantity > 0).Select(d =>
                {
                    var since = lastIn.TryGetValue(d.Id, out var t) ? t : d.CreatedAt;
                    var age = (DateTime.UtcNow - since).Days;
                    decimal v = key == "stock-age-value" ? d.Quantity * d.UnitPrice : d.Quantity;
                    return new
                    {
                        item_code = d.ItemCode, drug = d.BrandName, last_received = since, age_days = age,
                        b0_30 = age <= 30 ? v : 0, b31_60 = age is > 30 and <= 60 ? v : 0,
                        b61_90 = age is > 60 and <= 90 ? v : 0, b91_180 = age is > 90 and <= 180 ? v : 0, b180 = age > 180 ? v : 0,
                    };
                }).OrderByDescending(r => r.age_days).ToList();
                var t2 = key == "stock-age-value" ? "money" : "num";
                return Listing(key == "stock-age-value" ? "Stock Age Analysis Value Report (Age by Transaction Date)" : "Stock Age Analysis Report (Quantity)",
                    [new("item_code", "Code"), new("drug", "Drug"), new("last_received", "Last Received", "date"), new("age_days", "Age (days)", "num"),
                     new("b0_30", "0–30", t2), new("b31_60", "31–60", t2), new("b61_90", "61–90", t2), new("b91_180", "91–180", t2), new("b180", "180+", t2)], rows);
            }
            case "expiry-dates":
                return Listing("Stocks Expiry Dates Listing",
                    [new("expiry", "Expiry", "date"), new("days_left", "Days Left", "num"), new("item_code", "Code"), new("drug", "Drug"), new("batch", "Batch"), new("stock", "Qty", "num"), new("value", "Value", "money")],
                    drugs.Values.Where(d => d.IsActive && d.ExpiryDate != null).OrderBy(d => d.ExpiryDate)
                        .Select(d => new { expiry = d.ExpiryDate, days_left = d.ExpiryDate!.Value.DayNumber - today.DayNumber, item_code = d.ItemCode, drug = d.BrandName, batch = d.BatchNumber, stock = d.Quantity, value = d.Quantity * d.UnitPrice }));
            case "reorder-items":
                return Listing("Re Order Level Items",
                    [new("item_code", "Code"), new("drug", "Drug"), new("supplier", "Supplier"), new("stock", "Stock", "num"), new("reorder", "Reorder Level", "num"), new("suggested", "Suggested Order", "num")],
                    drugs.Values.Where(d => d.IsActive && d.Quantity <= d.ReorderLevel).OrderBy(d => d.Quantity)
                        .Select(d => new { item_code = d.ItemCode, drug = d.BrandName, supplier = Sup(d.SupplierId), stock = d.Quantity, reorder = d.ReorderLevel, suggested = Math.Max(d.ReorderLevel * 2 - d.Quantity, 1) }));
            case "cancelled-invoices":
            {
                var r = await db.Invoices.AsNoTracking().Where(i => i.Status == InvoiceStatus.Cancelled && i.CreatedAt >= start && i.CreatedAt < end).OrderByDescending(i => i.CancelledAt).ToListAsync();
                return Listing("Cancelled Invoice Listing",
                    [new("number", "Invoice #"), new("date", "Invoice Date", "date"), new("cancelled", "Cancelled", "date"), new("amount", "Amount", "money"), new("cashier", "Cashier"), new("reason", "Reason")],
                    r.Select(i => new { number = i.InvoiceNumber, date = i.CreatedAt, cancelled = i.CancelledAt, amount = i.TotalAmount, cashier = Usr(i.ServedByUserId), reason = i.CancellationReason }));
            }
            case "cashier-invoices":
            {
                var r = await db.Invoices.AsNoTracking().Where(i => i.CreatedAt >= start && i.CreatedAt < end).ToListAsync();
                return Listing("Cashier wise Invoice Listing",
                    [new("cashier", "Cashier"), new("invoices", "Invoices", "num"), new("cancelled", "Cancelled", "num"), new("cash", "Cash", "money"), new("card", "Card", "money"), new("other", "Other", "money"), new("total", "Net Sales", "money")],
                    r.GroupBy(i => i.ServedByUserId).Select(g =>
                    {
                        var ok = g.Where(i => i.Status == InvoiceStatus.Completed).ToList();
                        return new
                        {
                            cashier = Usr(g.Key), invoices = ok.Count, cancelled = g.Count() - ok.Count,
                            cash = ok.Where(i => i.PaymentMode == PaymentMode.Cash).Sum(i => i.TotalAmount),
                            card = ok.Where(i => i.PaymentMode == PaymentMode.Card).Sum(i => i.TotalAmount),
                            other = ok.Where(i => i.PaymentMode == PaymentMode.Other).Sum(i => i.TotalAmount),
                            total = ok.Sum(i => i.TotalAmount),
                        };
                    }).OrderByDescending(x => x.total));
            }
            case "category-sales":
            case "supplier-sales":
            {
                var lines = await db.Invoices.AsNoTracking().Where(i => i.Status == InvoiceStatus.Completed && i.CreatedAt >= start && i.CreatedAt < end)
                    .SelectMany(i => i.Items).ToListAsync();
                Func<int, string> by = key == "category-sales" ? Cat : id => drugs.TryGetValue(id, out var d) ? Sup(d.SupplierId) : "—";
                return Listing(key == "category-sales" ? "Category wise Sales Listing" : "Supplier wise Sales Listing",
                    [new("group", key == "category-sales" ? "Category" : "Supplier"), new("items", "Distinct Items", "num"), new("units", "Units Sold", "num"), new("discount", "Discount", "money"), new("revenue", "Revenue", "money")],
                    lines.GroupBy(l => by(l.DrugId)).Select(g => new { group = g.Key, items = g.Select(l => l.DrugId).Distinct().Count(), units = g.Sum(l => l.Quantity), discount = g.Sum(l => l.DiscountAmount), revenue = g.Sum(l => l.LineTotal) }).OrderByDescending(r => r.revenue));
            }
            default:
                return NotFound(new { detail = $"Unknown report '{key}'" });
        }
    }

    public record MovingRow(int DrugId, string ItemCode, string BrandName, string GenericName, string? Strength,
        int TotalSold, int TransactionCount, decimal Revenue, int CurrentStock);
}
