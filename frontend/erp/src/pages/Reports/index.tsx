import { useEffect, useState } from "react";
import api from "../../services/api";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { formatCurrency, formatDate } from "../../utils/formatters";
import styles from "./Reports.module.css";
import { ListingsReport, StockMovementReport } from "./Listings";

type ReportTab =
  | "near_expiry"
  | "low_stock"
  | "fast_moving"
  | "slow_moving"
  | "stock_valuation"
  | "stock_taking"
  | "sales"
  | "movement"
  | "listings";

// ── helpers ───────────────────────────────────────────────────────────────────

function DrugCell({ brand, generic, strength }: { brand: string; generic: string; strength?: string | null }) {
  return (
    <div>
      <div className={styles.drugName}>{brand}</div>
      <div className={styles.genericName}>{generic}{strength ? ` · ${strength}` : ""}</div>
    </div>
  );
}

function ReportHeader({ title, subtitle, badge }: { title: string; subtitle: string; badge: string }) {
  return (
    <div className={styles.reportHeader}>
      <div>
        <div className={styles.reportTitle}>{title}</div>
        <div className={styles.reportSubtitle}>{subtitle}</div>
      </div>
      <div className={styles.summaryBadge}>{badge}</div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>("near_expiry");
  const [loading, setLoading] = useState(false);

  // per-tab data
  const [nearExpiry, setNearExpiry] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [fastMoving, setFastMoving] = useState<any[]>([]);
  const [slowMoving, setSlowMoving] = useState<any[]>([]);
  const [valuation, setValuation] = useState<any>(null);
  const [stockTaking, setStockTaking] = useState<any[]>([]);
  const [sales, setSales] = useState<any>(null);

  // filters
  const [expiryDays, setExpiryDays] = useState("90");
  const [movingDays, setMovingDays] = useState("30");
  const [salesFrom, setSalesFrom] = useState("");
  const [salesTo, setSalesTo] = useState("");

  useEffect(() => { loadTab(activeTab); }, [activeTab]);

  async function loadTab(tab: ReportTab) {
    if (tab === "movement" || tab === "listings") return;
    setLoading(true);
    try {
      switch (tab) {
        case "near_expiry": {
          const r = await api.get("/reports/near-expiry", { params: { days: expiryDays } });
          setNearExpiry(r.data);
          break;
        }
        case "low_stock": {
          const r = await api.get("/reports/low-stock");
          setLowStock(r.data);
          break;
        }
        case "fast_moving": {
          const r = await api.get("/reports/fast-moving", { params: { days: movingDays } });
          setFastMoving(r.data);
          break;
        }
        case "slow_moving": {
          const r = await api.get("/reports/slow-moving", { params: { days: movingDays } });
          setSlowMoving(r.data);
          break;
        }
        case "stock_valuation": {
          const r = await api.get("/reports/stock-valuation");
          setValuation(r.data);
          break;
        }
        case "stock_taking": {
          const r = await api.get("/reports/stock-taking");
          setStockTaking(r.data);
          break;
        }
        case "sales": {
          const params: Record<string, string> = {};
          if (salesFrom) params.date_from = salesFrom;
          if (salesTo) params.date_to = salesTo;
          const r = await api.get("/reports/sales-summary", { params });
          setSales(r.data);
          break;
        }
      }
    } finally { setLoading(false); }
  }

  const tabs: { key: ReportTab; label: string; alert?: boolean }[] = [
    { key: "near_expiry", label: "Near Expiry", alert: nearExpiry.length > 0 },
    { key: "low_stock", label: "Low Stock", alert: lowStock.length > 0 },
    { key: "fast_moving", label: "Fast Moving" },
    { key: "slow_moving", label: "Slow Moving" },
    { key: "stock_valuation", label: "Stock Valuation" },
    { key: "stock_taking", label: "Stock Taking A–Z" },
    { key: "sales", label: "Sales Summary" },
    { key: "movement", label: "Daily / Weekly / Monthly" },
    { key: "listings", label: "Chain Listings (24)" },
  ];

  return (
    <div className={styles.page}>
      {/* ── Tab bar ── */}
      <div className={styles.tabs}>
        {tabs.map(t => (
          <button
            key={t.key}
            className={`${styles.tab} ${activeTab === t.key ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
            {t.alert && <span className={`${styles.tabBadge} ${styles.tabBadgeAlert}`}>!</span>}
          </button>
        ))}
      </div>

      {loading && <div className={styles.loading}>Loading report…</div>}

      {/* ══ NEAR EXPIRY ═══════════════════════════════════════════════════════════ */}
      {activeTab === "movement" && <StockMovementReport />}
      {activeTab === "listings" && <ListingsReport />}

      {activeTab === "near_expiry" && !loading && (
        <>
          <div className={styles.reportToolbar}>
            <ReportHeader
              title="Near-Expiry Drug Alert"
              subtitle={`Drugs expiring within ${expiryDays} days or already expired`}
              badge={`${nearExpiry.length} items`}
            />
            <div className={styles.filterRow}>
              <span className={styles.filterLabel}>Window:</span>
              <select className={styles.filterSelect} value={expiryDays} onChange={e => { setExpiryDays(e.target.value); }}>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
                <option value="180">180 days</option>
              </select>
              <Button size="sm" variant="ghost" onClick={() => loadTab("near_expiry")}>↻ Refresh</Button>
            </div>
          </div>
          {nearExpiry.length === 0
            ? <div className={styles.empty}>No near-expiry items found.</div>
            : (
              <table className={styles.table}>
                <thead><tr><th>Item Code</th><th>Drug</th><th>Batch</th><th>Expiry Date</th><th>Days Left</th><th>Stock</th><th>Stock Value</th></tr></thead>
                <tbody>
                  {nearExpiry.map((d: any) => (
                    <tr key={d.id}>
                      <td className={styles.itemCode}>{d.item_code}</td>
                      <td><DrugCell brand={d.brand_name} generic={d.generic_name} strength={d.strength} /></td>
                      <td className={styles.mono}>{d.batch_number || "—"}</td>
                      <td>{d.expiry_date || "—"}</td>
                      <td><Badge variant={d.days_left <= 0 ? "danger" : d.days_left <= 30 ? "danger" : "warning"}>{d.days_left <= 0 ? "EXPIRED" : `${d.days_left}d`}</Badge></td>
                      <td className={styles.qty}>{d.quantity}</td>
                      <td className={styles.valueCell}>{formatCurrency(d.stock_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </>
      )}

      {/* ══ LOW STOCK ══════════════════════════════════════════════════════════════ */}
      {activeTab === "low_stock" && !loading && (
        <>
          <ReportHeader
            title="Low Stock & Reorder Alert"
            subtitle="Items at or below reorder level"
            badge={`${lowStock.length} items`}
          />
          {lowStock.length === 0
            ? <div className={styles.empty}>All items are adequately stocked.</div>
            : (
              <table className={styles.table}>
                <thead><tr><th>Item Code</th><th>Drug</th><th>Current Stock</th><th>Reorder Level</th><th>Threshold</th><th>Status</th></tr></thead>
                <tbody>
                  {lowStock.map((d: any) => (
                    <tr key={d.id}>
                      <td className={styles.itemCode}>{d.item_code}</td>
                      <td><DrugCell brand={d.brand_name} generic={d.generic_name} strength={d.strength} /></td>
                      <td><span className={styles.stockNum}>{d.quantity}</span></td>
                      <td className={styles.mono}>{d.reorder_level}</td>
                      <td className={styles.mono}>{d.low_stock_threshold}</td>
                      <td><Badge variant={d.quantity === 0 ? "danger" : "warning"}>{d.quantity === 0 ? "Out of Stock" : "Reorder Now"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </>
      )}

      {/* ══ FAST MOVING ════════════════════════════════════════════════════════════ */}
      {activeTab === "fast_moving" && !loading && (
        <>
          <div className={styles.reportToolbar}>
            <ReportHeader
              title="Fast Moving Items"
              subtitle={`Top drugs by units sold in the last ${movingDays} days`}
              badge={`${fastMoving.length} items`}
            />
            <div className={styles.filterRow}>
              <span className={styles.filterLabel}>Period:</span>
              <select className={styles.filterSelect} value={movingDays} onChange={e => setMovingDays(e.target.value)}>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
              </select>
              <Button size="sm" variant="ghost" onClick={() => loadTab("fast_moving")}>↻ Refresh</Button>
            </div>
          </div>
          {fastMoving.length === 0
            ? <div className={styles.empty}>No sales data found for this period.</div>
            : (
              <table className={styles.table}>
                <thead><tr><th>#</th><th>Item Code</th><th>Drug</th><th>Units Sold</th><th>Transactions</th><th>Current Stock</th><th>Revenue</th></tr></thead>
                <tbody>
                  {fastMoving.map((d: any, i: number) => (
                    <tr key={d.drug_id}>
                      <td className={styles.rankCell}>{i + 1}</td>
                      <td className={styles.itemCode}>{d.item_code}</td>
                      <td><DrugCell brand={d.brand_name} generic={d.generic_name} strength={d.strength} /></td>
                      <td><strong>{d.total_sold}</strong></td>
                      <td className={styles.muted}>{d.transaction_count}</td>
                      <td className={styles.qty}>{d.current_stock}</td>
                      <td className={styles.valueCell}>{formatCurrency(d.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </>
      )}

      {/* ══ SLOW MOVING ════════════════════════════════════════════════════════════ */}
      {activeTab === "slow_moving" && !loading && (
        <>
          <div className={styles.reportToolbar}>
            <ReportHeader
              title="Slow Moving Items"
              subtitle={`Items with ≤5 units sold in the last ${movingDays} days but still in stock`}
              badge={`${slowMoving.length} items`}
            />
            <div className={styles.filterRow}>
              <span className={styles.filterLabel}>Period:</span>
              <select className={styles.filterSelect} value={movingDays} onChange={e => setMovingDays(e.target.value)}>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
              </select>
              <Button size="sm" variant="ghost" onClick={() => loadTab("slow_moving")}>↻ Refresh</Button>
            </div>
          </div>
          {slowMoving.length === 0
            ? <div className={styles.empty}>No slow-moving items found.</div>
            : (
              <table className={styles.table}>
                <thead><tr><th>Item Code</th><th>Drug</th><th>In Stock</th><th>Unit Price</th><th>Stock Value</th><th>Expiry Date</th></tr></thead>
                <tbody>
                  {slowMoving.map((d: any) => (
                    <tr key={d.id}>
                      <td className={styles.itemCode}>{d.item_code}</td>
                      <td><DrugCell brand={d.brand_name} generic={d.generic_name} strength={d.strength} /></td>
                      <td className={styles.qty}>{d.quantity}</td>
                      <td>{formatCurrency(d.unit_price)}</td>
                      <td className={styles.valueCell}>{formatCurrency(d.stock_value)}</td>
                      <td>{d.expiry_date ? <Badge variant="warning">{d.expiry_date}</Badge> : <span className={styles.muted}>—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </>
      )}

      {/* ══ STOCK VALUATION ════════════════════════════════════════════════════════ */}
      {activeTab === "stock_valuation" && !loading && valuation && (
        <>
          <div className={styles.reportToolbar}>
            <ReportHeader
              title="Stock Valuation"
              subtitle={`As at ${new Date(valuation.generated_at).toLocaleString()}`}
              badge={formatCurrency(valuation.total_stock_value)}
            />
            <Button size="sm" variant="ghost" onClick={() => loadTab("stock_valuation")}>↻ Refresh</Button>
          </div>
          <div className={styles.valuationHeader}>
            <div className={styles.valuationCard}>
              <div className={styles.valuationValue}>{formatCurrency(valuation.total_stock_value)}</div>
              <div className={styles.valuationLabel}>Total Stock Value</div>
            </div>
            <div className={styles.valuationCard}>
              <div className={styles.valuationValue}>{valuation.total_items}</div>
              <div className={styles.valuationLabel}>Drug Items</div>
            </div>
            <div className={styles.valuationCard}>
              <div className={styles.valuationValue}>{valuation.total_units.toLocaleString()}</div>
              <div className={styles.valuationLabel}>Total Units</div>
            </div>
          </div>
          <table className={styles.table}>
            <thead><tr><th>Item Code</th><th>Drug</th><th>Form</th><th>Qty</th><th>Unit Price</th><th>Stock Value</th><th>Expiry</th></tr></thead>
            <tbody>
              {valuation.items.map((d: any) => (
                <tr key={d.id}>
                  <td className={styles.itemCode}>{d.item_code}</td>
                  <td><DrugCell brand={d.brand_name} generic={d.generic_name} strength={d.strength} /></td>
                  <td style={{ textTransform: "capitalize" }}>{d.dosage_form}</td>
                  <td className={styles.qty}>{d.quantity}</td>
                  <td>{formatCurrency(d.unit_price)}</td>
                  <td className={styles.valueCell}>{formatCurrency(d.stock_value)}</td>
                  <td className={styles.muted}>{d.expiry_date || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ══ STOCK TAKING A–Z ═══════════════════════════════════════════════════════ */}
      {activeTab === "stock_taking" && !loading && (
        <>
          <div className={styles.reportToolbar}>
            <ReportHeader
              title="Stock Taking Report A–Z"
              subtitle="Complete drug inventory listing sorted alphabetically"
              badge={`${stockTaking.length} items`}
            />
            <Button size="sm" variant="ghost" onClick={() => loadTab("stock_taking")}>↻ Refresh</Button>
          </div>
          {stockTaking.length === 0
            ? <div className={styles.empty}>No items found.</div>
            : (
              <table className={styles.table}>
                <thead><tr><th>Item Code</th><th>Drug</th><th>Form</th><th>Batch</th><th>Expiry</th><th>Qty</th><th>Reorder</th><th>Flags</th></tr></thead>
                <tbody>
                  {stockTaking.map((d: any) => (
                    <tr key={d.id}>
                      <td className={styles.itemCode}>{d.item_code}</td>
                      <td><DrugCell brand={d.brand_name} generic={d.generic_name} strength={d.strength} /></td>
                      <td style={{ textTransform: "capitalize" }}>{d.dosage_form}</td>
                      <td className={styles.mono}>{d.batch_number || "—"}</td>
                      <td className={styles.muted}>{d.expiry_date || "—"}</td>
                      <td className={styles.qty}>{d.quantity}</td>
                      <td className={styles.muted}>{d.reorder_level}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {d.is_prescription_only && <Badge variant="warning">Rx</Badge>}
                          {d.is_high_alert && <Badge variant="danger">HA</Badge>}
                          {d.is_narcotic && <Badge variant="danger">Narc</Badge>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </>
      )}

      {/* ══ SALES SUMMARY ══════════════════════════════════════════════════════════ */}
      {activeTab === "sales" && !loading && (
        <>
          <div className={styles.reportToolbar}>
            <ReportHeader
              title="Sales Summary"
              subtitle="Completed invoice revenue breakdown"
              badge={sales ? formatCurrency(sales.total_revenue) : "—"}
            />
            <div className={styles.filterRow}>
              <span className={styles.filterLabel}>From:</span>
              <input type="date" className={styles.filterSelect} value={salesFrom} onChange={e => setSalesFrom(e.target.value)} />
              <span className={styles.filterLabel}>To:</span>
              <input type="date" className={styles.filterSelect} value={salesTo} onChange={e => setSalesTo(e.target.value)} />
              <Button size="sm" variant="ghost" onClick={() => loadTab("sales")}>↻ Apply</Button>
            </div>
          </div>
          {sales && (
            <>
              <div className={styles.salesStats}>
                <div className={styles.salesStatCard}>
                  <div className={styles.salesStatValue}>{sales.completed_invoices}</div>
                  <div className={styles.salesStatLabel}>Completed Invoices</div>
                </div>
                <div className={styles.salesStatCard}>
                  <div className={styles.salesStatValue}>{formatCurrency(sales.total_revenue)}</div>
                  <div className={styles.salesStatLabel}>Total Revenue</div>
                </div>
                <div className={styles.salesStatCard}>
                  <div className={styles.salesStatValue}>{sales.completed_invoices > 0 ? formatCurrency(sales.total_revenue / sales.completed_invoices) : "—"}</div>
                  <div className={styles.salesStatLabel}>Average Invoice</div>
                </div>
                <div className={styles.salesStatCard}>
                  <div className={styles.salesStatValue}>
                    {Object.entries(sales.by_payment_mode as Record<string, number>).map(([k, v]) => (
                      <div key={k} style={{ fontSize: "var(--font-size-sm)", fontWeight: "normal" }}>
                        <span style={{ textTransform: "capitalize" }}>{k}:</span> {formatCurrency(v)}
                      </div>
                    ))}
                  </div>
                  <div className={styles.salesStatLabel}>By Payment Mode</div>
                </div>
              </div>
              {sales.invoices.length === 0
                ? <div className={styles.empty}>No invoices found.</div>
                : (
                  <table className={styles.table}>
                    <thead><tr><th>Invoice #</th><th>Date</th><th>Payment</th><th>Amount</th><th>Discount</th><th>Status</th></tr></thead>
                    <tbody>
                      {sales.invoices.slice(0, 200).map((inv: any) => (
                        <tr key={inv.id}>
                          <td className={styles.mono}>{inv.invoice_number}</td>
                          <td>{formatDate(inv.created_at)}</td>
                          <td style={{ textTransform: "capitalize" }}>{inv.payment_mode}</td>
                          <td className={styles.amount}>{formatCurrency(inv.total_amount)}</td>
                          <td className={styles.muted}>{inv.discount_amount > 0 ? formatCurrency(inv.discount_amount) : "—"}</td>
                          <td><Badge variant={inv.status === "completed" ? "success" : "danger"}>{inv.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </>
          )}
        </>
      )}
    </div>
  );
}
