import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { drugService } from "../../services/drug.service";
import { purchaseOrderService } from "../../services/purchaseOrder.service";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { formatCurrency, formatDate, formatPoStatus } from "../../utils/formatters";
import type { Drug, PurchaseOrder } from "../../types";
import styles from "./Dashboard.module.css";

interface DashboardStats {
  total_drugs: number;
  low_stock_count: number;
  expiring_soon_count: number;
  today_sales: number;
  total_customers: number;
  pending_purchase_orders: number;
}

const muted = { fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" } as const;

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lowStock, setLowStock] = useState<Drug[]>([]);
  const [expiring, setExpiring] = useState<Drug[]>([]);
  const [pendingPOs, setPendingPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [st, low, exp, pos] = await Promise.all([
        api.get<DashboardStats>("/reports/dashboard").then((r) => r.data).catch(() => null),
        drugService.getLowStock().catch(() => [] as Drug[]),
        drugService.getExpiringSoon().catch(() => [] as Drug[]),
        purchaseOrderService.getPending().catch(() => [] as PurchaseOrder[]),
      ]);
      setStats(st);
      setLowStock(low);
      setExpiring([...exp].sort((a, b) => (a.expiry_date ?? "").localeCompare(b.expiry_date ?? "")));
      setPendingPOs(pos);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const daysLeft = (d: string | null) => (d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null);
  const v = (n: number | undefined) => (loading || n === undefined ? "—" : n);
  const poStatusVariant = (s: string) => (s === "submitted" ? "primary" : s === "draft" ? "neutral" : "warning");

  return (
    <div className={styles.page}>
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <Button size="sm" onClick={() => navigate("/purchase-orders")}>+ Purchase Order</Button>
        <Button size="sm" variant="secondary" onClick={() => navigate("/grn")}>Receive Goods</Button>
        <Button size="sm" variant="secondary" onClick={() => navigate("/purchase-requisitions")}>Requisition</Button>
        <Button size="sm" variant="secondary" onClick={() => navigate("/inventory")}>+ Drug</Button>
        <Button size="sm" variant="secondary" onClick={() => navigate("/reports")}>Reports</Button>
        <div style={{ flex: 1 }} />
        <Button size="sm" variant="ghost" onClick={load}>↻ Refresh</Button>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard} onClick={() => navigate("/reports")} style={{ cursor: "pointer" }}>
          <div className={styles.statLabel}>Today's Sales</div>
          <div className={styles.statValue} style={{ color: "var(--color-primary)" }}>{loading || !stats ? "—" : formatCurrency(stats.today_sales)}</div>
          <div className={styles.statSub}>Completed invoices today</div>
        </div>
        <div className={styles.statCard} onClick={() => navigate("/inventory")} style={{ cursor: "pointer" }}>
          <div className={styles.statLabel}>Total Drugs</div>
          <div className={styles.statValue}>{v(stats?.total_drugs)}</div>
          <div className={styles.statSub}>Active catalog items</div>
        </div>
        <div className={styles.statCard} onClick={() => navigate("/stock-view")} style={{ cursor: "pointer" }}>
          <div className={styles.statLabel}>Low Stock Alerts</div>
          <div className={styles.statValue} style={{ color: (stats?.low_stock_count ?? 0) > 0 ? "var(--color-danger)" : undefined }}>{v(stats?.low_stock_count ?? lowStock.length)}</div>
          <div className={styles.statSub}>At or below threshold</div>
        </div>
        <div className={styles.statCard} onClick={() => navigate("/stock-view")} style={{ cursor: "pointer" }}>
          <div className={styles.statLabel}>Expiring Soon</div>
          <div className={styles.statValue} style={{ color: (stats?.expiring_soon_count ?? 0) > 0 ? "var(--color-warning)" : undefined }}>{v(stats?.expiring_soon_count ?? expiring.length)}</div>
          <div className={styles.statSub}>Within 90 days (incl. expired)</div>
        </div>
        <div className={styles.statCard} onClick={() => navigate("/purchase-orders")} style={{ cursor: "pointer" }}>
          <div className={styles.statLabel}>Open Orders</div>
          <div className={styles.statValue}>{v(pendingPOs.length)}</div>
          <div className={styles.statSub}>Draft, submitted or partial</div>
        </div>
        <div className={styles.statCard} onClick={() => navigate("/customers")} style={{ cursor: "pointer" }}>
          <div className={styles.statLabel}>Customers</div>
          <div className={styles.statValue}>{v(stats?.total_customers)}</div>
          <div className={styles.statSub}>Registered patients</div>
        </div>
      </div>

      <div className={styles.bottomGrid}>
        <Card title="Low Stock Drugs">
          {loading && <p style={muted}>Loading…</p>}
          {!loading && lowStock.length === 0 && <p style={muted}>All stock levels healthy.</p>}
          {lowStock.slice(0, 8).map((d) => (
            <div key={d.id} className={styles.alertRow}>
              <div>
                <div className={styles.alertName}>{d.brand_name}</div>
                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{d.item_code} · reorder at {d.reorder_level}</div>
              </div>
              <span className={styles.alertQty}>{d.quantity} left</span>
            </div>
          ))}
          {lowStock.length > 0 && <Button size="sm" variant="secondary" onClick={() => navigate("/purchase-requisitions")}>Raise requisition →</Button>}
        </Card>

        <Card title="Expiring Soon">
          {loading && <p style={muted}>Loading…</p>}
          {!loading && expiring.length === 0 && <p style={muted}>Nothing expiring within 90 days.</p>}
          {expiring.slice(0, 8).map((d) => {
            const left = daysLeft(d.expiry_date);
            return (
              <div key={d.id} className={styles.alertRow}>
                <div>
                  <div className={styles.alertName}>{d.brand_name}</div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{d.batch_number ?? d.item_code} · {d.expiry_date ? formatDate(d.expiry_date) : ""} · qty {d.quantity}</div>
                </div>
                <Badge variant={left !== null && left <= 0 ? "danger" : left !== null && left <= 30 ? "warning" : "info"}>
                  {left !== null && left <= 0 ? "Expired" : `${left} d`}
                </Badge>
              </div>
            );
          })}
        </Card>

        <Card title="Open Purchase Orders">
          {loading && <p style={muted}>Loading…</p>}
          {!loading && pendingPOs.length === 0 && <p style={muted}>No open orders.</p>}
          {pendingPOs.slice(0, 8).map((po) => (
            <div key={po.id} className={styles.alertRow}>
              <div>
                <div className={styles.alertName}>{po.order_number}</div>
                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{po.supplier?.name ?? `Supplier #${po.supplier_id}`} · {po.items.length} line(s)</div>
              </div>
              <Badge variant={poStatusVariant(po.status) as "primary" | "neutral" | "warning"}>{formatPoStatus(po.status)}</Badge>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
