import { useEffect, useState } from "react";
import { drugService } from "../../services/drug.service";
import { purchaseOrderService } from "../../services/purchaseOrder.service";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { formatPoStatus } from "../../utils/formatters";
import type { Drug, PurchaseOrder } from "../../types";
import styles from "./Dashboard.module.css";

export function DashboardPage() {
  const [lowStock, setLowStock] = useState<Drug[]>([]);
  const [pendingPOs, setPendingPOs] = useState<PurchaseOrder[]>([]);
  const [totalDrugs, setTotalDrugs] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [drugs, low, pos] = await Promise.all([
          drugService.getAll(0, 200),
          drugService.getLowStock(),
          purchaseOrderService.getPending(),
        ]);
        setTotalDrugs(drugs.length);
        setLowStock(low);
        setPendingPOs(pos);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const poStatusVariant = (s: string) => {
    if (s === "received") return "success";
    if (s === "cancelled") return "danger";
    if (s === "submitted") return "primary";
    return "warning";
  };

  return (
    <div className={styles.page}>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Drugs</div>
          <div className={styles.statValue}>{loading ? "—" : totalDrugs}</div>
          <div className={styles.statSub}>Active inventory items</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Low Stock Alerts</div>
          <div className={styles.statValue} style={{ color: lowStock.length > 0 ? "var(--color-danger)" : undefined }}>
            {loading ? "—" : lowStock.length}
          </div>
          <div className={styles.statSub}>Below reorder level</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Pending Orders</div>
          <div className={styles.statValue}>{loading ? "—" : pendingPOs.length}</div>
          <div className={styles.statSub}>Awaiting fulfilment</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Expiring Soon</div>
          <div className={styles.statValue}>—</div>
          <div className={styles.statSub}>Within 30 days</div>
        </div>
      </div>

      <div className={styles.bottomGrid}>
        <Card title="Low Stock Drugs">
          {loading && <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>Loading…</p>}
          {!loading && lowStock.length === 0 && (
            <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>All stock levels healthy.</p>
          )}
          {lowStock.slice(0, 8).map((d) => (
            <div key={d.id} className={styles.alertRow}>
              <div>
                <div className={styles.alertName}>{d.brand_name}</div>
                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{d.item_code}</div>
              </div>
              <span className={styles.alertQty}>{d.quantity} left</span>
            </div>
          ))}
        </Card>

        <Card title="Pending Purchase Orders">
          {loading && <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>Loading…</p>}
          {!loading && pendingPOs.length === 0 && (
            <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>No pending orders.</p>
          )}
          {pendingPOs.slice(0, 8).map((po) => (
            <div key={po.id} className={styles.alertRow}>
              <div>
                <div className={styles.alertName}>{po.order_number}</div>
                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{po.items.length} item(s)</div>
              </div>
              <Badge variant={poStatusVariant(po.status) as "warning" | "success" | "danger" | "primary"}>
                {formatPoStatus(po.status)}
              </Badge>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
