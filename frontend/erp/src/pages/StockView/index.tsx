import { useEffect, useState } from "react";
import { stockService, type StockViewItem } from "../../services/stock.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { Table } from "../../components/ui/Table";
import styles from "./StockView.module.css";

export function StockViewPage() {
  const [items, setItems] = useState<StockViewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "critical" | "expiring">("all");

  const [adjModal, setAdjModal] = useState(false);
  const [adjDrug, setAdjDrug] = useState<StockViewItem | null>(null);
  const [adjChange, setAdjChange] = useState("");
  const [adjNotes, setAdjNotes] = useState("");
  const [adjSaving, setAdjSaving] = useState(false);

  const [movModal, setMovModal] = useState(false);
  const [movements, setMovements] = useState<any[]>([]);
  const [movLoading, setMovLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setItems(await stockService.getStockView()); }
    finally { setLoading(false); }
  }

  async function openAdjust(item: StockViewItem) {
    setAdjDrug(item);
    setAdjChange("");
    setAdjNotes("");
    setAdjModal(true);
  }

  async function saveAdjust() {
    if (!adjDrug || !adjChange) return;
    setAdjSaving(true);
    try {
      await stockService.adjust(adjDrug.id, parseInt(adjChange), adjNotes);
      setAdjModal(false);
      load();
    } finally { setAdjSaving(false); }
  }

  async function openMovements(item: StockViewItem) {
    setAdjDrug(item);
    setMovModal(true);
    setMovLoading(true);
    try { setMovements(await stockService.getMovements(item.id)); }
    finally { setMovLoading(false); }
  }

  const today = new Date();
  const in90Days = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

  const filtered = items.filter(item => {
    const q = query.toLowerCase();
    const matchQ = !q || item.brand_name.toLowerCase().includes(q) || item.generic_name.toLowerCase().includes(q) || item.item_code.toLowerCase().includes(q);
    if (!matchQ) return false;
    if (filter === "low") return item.quantity <= item.reorder_level;
    if (filter === "critical") return item.quantity === 0;
    if (filter === "expiring") return item.expiry_date ? new Date(item.expiry_date) <= in90Days : false;
    return true;
  });

  const lowStock = items.filter(i => i.quantity <= i.reorder_level && i.quantity > 0).length;
  const outOfStock = items.filter(i => i.quantity === 0).length;
  const expiringSoon = items.filter(i => i.expiry_date && new Date(i.expiry_date) <= in90Days).length;

  function stockBadge(item: StockViewItem) {
    if (item.quantity === 0) return <Badge variant="danger">Out of Stock</Badge>;
    if (item.quantity <= item.low_stock_threshold) return <Badge variant="warning">Critical</Badge>;
    if (item.quantity <= item.reorder_level) return <Badge variant="warning">Low Stock</Badge>;
    return <Badge variant="success">OK</Badge>;
  }

  function expiryDisplay(dateStr: string | null) {
    if (!dateStr) return <span style={{ color: "var(--color-text-muted)" }}>—</span>;
    const d = new Date(dateStr);
    const days = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return <Badge variant="danger">Expired</Badge>;
    if (days <= 30) return <Badge variant="danger">{dateStr} ({days}d)</Badge>;
    if (days <= 90) return <Badge variant="warning">{dateStr} ({days}d)</Badge>;
    return <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-sm)" }}>{dateStr}</span>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{items.length}</div>
          <div className={styles.statLabel}>Total Drug Items</div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statValue} ${styles.warn}`}>{lowStock}</div>
          <div className={styles.statLabel}>Low Stock</div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statValue} ${styles.danger}`}>{outOfStock}</div>
          <div className={styles.statLabel}>Out of Stock</div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statValue} ${styles.warn}`}>{expiringSoon}</div>
          <div className={styles.statLabel}>Expiring ≤90 Days</div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <Input placeholder="Search by name or code…" value={query} onChange={e => setQuery(e.target.value)} style={{ width: 260 }} />
          <div className={styles.filterTabs}>
            {(["all", "low", "critical", "expiring"] as const).map(f => (
              <button key={f} className={`${styles.filterTab} ${filter === f ? styles.filterTabActive : ""}`} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "low" ? "Low Stock" : f === "critical" ? "Out of Stock" : "Expiring Soon"}
              </button>
            ))}
          </div>
        </div>
        <Button variant="ghost" onClick={load}>↻ Refresh</Button>
      </div>

      <Table<StockViewItem>
        columns={[
          { key: "code", header: "Item Code", render: i => <code style={{ fontSize: "var(--font-size-xs)" }}>{i.item_code}</code> },
          { key: "brand", header: "Brand Name", render: i => <strong>{i.brand_name}</strong> },
          { key: "generic", header: "Generic", render: i => <span style={{ color: "var(--color-text-secondary)" }}>{i.generic_name}</span> },
          { key: "form", header: "Form", render: i => <span style={{ textTransform: "capitalize" }}>{i.dosage_form}</span> },
          { key: "qty", header: "Qty", render: i => <span style={{ fontWeight: "var(--font-weight-medium)", textAlign: "right", display: "block" }}>{i.quantity}</span> },
          { key: "reorder", header: "Reorder Lvl", render: i => <span style={{ textAlign: "right", display: "block", color: "var(--color-text-muted)" }}>{i.reorder_level}</span> },
          { key: "status", header: "Stock Status", render: i => stockBadge(i) },
          { key: "expiry", header: "Expiry", render: i => expiryDisplay(i.expiry_date) },
          { key: "actions", header: "", render: i => (
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button size="sm" variant="ghost" onClick={() => openAdjust(i)}>Adjust</Button>
              <Button size="sm" variant="ghost" onClick={() => openMovements(i)}>History</Button>
            </div>
          )},
        ]}
        data={filtered}
        rowKey={i => i.id}
        emptyMessage={loading ? "Loading…" : "No items found."}
      />

      <Modal open={adjModal} onClose={() => setAdjModal(false)} title={`Adjust Stock — ${adjDrug?.brand_name}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {adjDrug && (
            <div className={styles.currentStock}>
              <span>Current Qty:</span>
              <strong>{adjDrug.quantity}</strong>
            </div>
          )}
          <Input
            label="Quantity Change *"
            type="number"
            value={adjChange}
            onChange={e => setAdjChange(e.target.value)}
            placeholder="Use negative to reduce (e.g. -5 or +10)"
          />
          <Input
            label="Notes"
            value={adjNotes}
            onChange={e => setAdjNotes(e.target.value)}
            placeholder="Reason for adjustment"
          />
          {adjDrug && adjChange && (
            <div className={styles.preview}>
              New Qty: <strong>{adjDrug.quantity + parseInt(adjChange || "0")}</strong>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
            <Button variant="ghost" onClick={() => setAdjModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveAdjust} disabled={!adjChange || adjSaving}>
              {adjSaving ? "Saving…" : "Apply Adjustment"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={movModal} onClose={() => setMovModal(false)} title={`Stock History — ${adjDrug?.brand_name}`}>
        {movLoading ? (
          <p style={{ color: "var(--color-text-muted)", textAlign: "center" }}>Loading…</p>
        ) : movements.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)", textAlign: "center" }}>No movements recorded.</p>
        ) : (
          <table className={styles.movTable}>
            <thead>
              <tr><th>Date</th><th>Type</th><th>Qty</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {movements.map(m => (
                <tr key={m.id}>
                  <td>{new Date(m.created_at).toLocaleDateString()}</td>
                  <td style={{ textTransform: "capitalize" }}>{m.movement_type.replace("_", " ")}</td>
                  <td style={{ fontWeight: "var(--font-weight-medium)", color: m.quantity < 0 ? "var(--color-danger)" : "var(--color-success)" }}>
                    {m.quantity > 0 ? "+" : ""}{m.quantity}
                  </td>
                  <td style={{ color: "var(--color-text-muted)" }}>{m.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>
    </div>
  );
}
