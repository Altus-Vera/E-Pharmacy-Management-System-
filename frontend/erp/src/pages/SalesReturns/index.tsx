import { useEffect, useState } from "react";
import {
  salesReturnService,
  type SalesReturn,
  type SalesReturnCreate,
  type SalesReturnItemCreate,
  type ReturnReason,
} from "../../services/sales_return.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { Table } from "../../components/ui/Table";
import styles from "./SalesReturns.module.css";

const today = new Date().toISOString().split("T")[0];

const REASON_LABELS: Record<ReturnReason, string> = {
  wrong_item: "Wrong Item",
  damaged: "Damaged",
  expired: "Expired",
  patient_refused: "Patient Refused",
  other: "Other",
};

export function SalesReturnsPage() {
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailRet, setDetailRet] = useState<SalesReturn | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<Omit<SalesReturnCreate, "items">>({
    return_date: today,
    reason: "other",
    notes: "",
  });
  const [items, setItems] = useState<SalesReturnItemCreate[]>([{ drug_id: 0, quantity_returned: 1, unit_price: 0, restock: true }]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setReturns(await salesReturnService.getAll()); }
    finally { setLoading(false); }
  }

  function openNew() {
    setForm({ return_date: today, reason: "other", notes: "" });
    setItems([{ drug_id: 0, quantity_returned: 1, unit_price: 0, restock: true }]);
    setModalOpen(true);
  }

  function addItem() { setItems(p => [...p, { drug_id: 0, quantity_returned: 1, unit_price: 0, restock: true }]); }
  function removeItem(idx: number) { setItems(p => p.filter((_, i) => i !== idx)); }
  function updateItem(idx: number, field: keyof SalesReturnItemCreate, value: string | number | boolean) {
    setItems(p => p.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  async function save() {
    setSaving(true);
    try {
      await salesReturnService.create({ ...form, items });
      setModalOpen(false);
      load();
    } finally { setSaving(false); }
  }

  const totalRefund = returns.reduce((s, r) => s + Number(r.total_refund), 0);
  const thisMonth = returns.filter(r => {
    const d = new Date(r.return_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className={styles.page}>
      <div className={styles.statsBar}>
        <div className={styles.statCard}><div className={styles.statValue}>{returns.length}</div><div className={styles.statLabel}>Total Returns</div></div>
        <div className={styles.statCard}><div className={styles.statValue}>{thisMonth}</div><div className={styles.statLabel}>This Month</div></div>
        <div className={styles.statCard}><div className={`${styles.statValue} ${styles.warn}`}>LKR {totalRefund.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</div><div className={styles.statLabel}>Total Refunded</div></div>
      </div>

      <div className={styles.toolbar}>
        <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
          Process customer drug returns — restocked items return to inventory
        </span>
        <Button variant="primary" onClick={openNew}>+ New Return</Button>
      </div>

      <Table<SalesReturn>
        columns={[
          { key: "return_number", header: "Return #", render: r => <code style={{ fontSize: "var(--font-size-sm)" }}>{r.return_number}</code> },
          { key: "invoice", header: "Invoice", render: r => r.invoice_id ? <span>#{r.invoice_id}</span> : <span style={{ color: "var(--color-text-muted)" }}>—</span> },
          { key: "customer", header: "Customer", render: r => r.customer_id ? <span>#{r.customer_id}</span> : <span style={{ color: "var(--color-text-muted)" }}>Walk-in</span> },
          { key: "date", header: "Date", render: r => <span>{r.return_date}</span> },
          { key: "reason", header: "Reason", render: r => <Badge variant="neutral">{REASON_LABELS[r.reason]}</Badge> },
          { key: "items_count", header: "Items", render: r => <span>{r.items.length}</span> },
          { key: "refund", header: "Total Refund", render: r => <span style={{ textAlign: "right", display: "block", fontWeight: "var(--font-weight-medium)" }}>LKR {Number(r.total_refund).toFixed(2)}</span> },
          { key: "actions", header: "", render: r => <Button size="sm" variant="ghost" onClick={() => setDetailRet(r)}>View</Button> },
        ]}
        data={returns}
        rowKey={r => r.id}
        emptyMessage={loading ? "Loading…" : "No returns found."}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Sales Return">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <Input label="Return Date *" type="date" value={form.return_date} onChange={e => setForm(f => ({ ...f, return_date: e.target.value }))} />
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <label style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-medium)", color: "var(--color-text)" }}>Reason *</label>
              <select
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value as ReturnReason }))}
                style={{ padding: "var(--space-2) var(--space-3)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "var(--font-size-sm)", background: "var(--color-surface)", color: "var(--color-text)" }}
              >
                {(Object.entries(REASON_LABELS) as [ReturnReason, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <Input label="Invoice ID" type="number" value={form.invoice_id ?? ""} onChange={e => setForm(f => ({ ...f, invoice_id: parseInt(e.target.value) || undefined }))} placeholder="Optional" />
            <Input label="Customer ID" type="number" value={form.customer_id ?? ""} onChange={e => setForm(f => ({ ...f, customer_id: parseInt(e.target.value) || undefined }))} placeholder="Optional" />
          </div>
          <Input label="Notes" value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes" />

          <div className={styles.itemsSection}>
            <div className={styles.itemsHeader}>
              <span>Items Being Returned</span>
              <Button size="sm" variant="ghost" onClick={addItem}>+ Add Item</Button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className={styles.itemRow}>
                <Input label="Drug ID" type="number" value={item.drug_id || ""} onChange={e => updateItem(idx, "drug_id", parseInt(e.target.value) || 0)} placeholder="ID" />
                <Input label="Qty" type="number" value={item.quantity_returned} onChange={e => updateItem(idx, "quantity_returned", parseInt(e.target.value) || 1)} />
                <Input label="Unit Price" type="number" step="0.01" value={item.unit_price} onChange={e => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)} />
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", justifyContent: "flex-end", paddingBottom: "2px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--font-size-sm)", cursor: "pointer" }}>
                    <input type="checkbox" checked={item.restock} onChange={e => updateItem(idx, "restock", e.target.checked)} />
                    Restock
                  </label>
                </div>
                {items.length > 1 && <button className={styles.removeBtn} onClick={() => removeItem(idx)}>✕</button>}
              </div>
            ))}
          </div>

          <div className={styles.totalPreview}>
            Total Refund: <strong>LKR {items.reduce((s, i) => s + i.quantity_returned * i.unit_price, 0).toFixed(2)}</strong>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={saving || items.some(i => !i.drug_id)}>{saving ? "Processing…" : "Process Return"}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detailRet} onClose={() => setDetailRet(null)} title={`Return — ${detailRet?.return_number}`}>
        {detailRet && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)", fontSize: "var(--font-size-sm)" }}>
              <div><span style={{ color: "var(--color-text-muted)" }}>Date:</span> {detailRet.return_date}</div>
              <div><span style={{ color: "var(--color-text-muted)" }}>Reason:</span> <Badge variant="neutral">{REASON_LABELS[detailRet.reason]}</Badge></div>
              {detailRet.invoice_id && <div><span style={{ color: "var(--color-text-muted)" }}>Invoice:</span> #{detailRet.invoice_id}</div>}
              {detailRet.notes && <div style={{ gridColumn: "span 2" }}><span style={{ color: "var(--color-text-muted)" }}>Notes:</span> {detailRet.notes}</div>}
            </div>
            <table className={styles.detailTable}>
              <thead><tr><th>Drug ID</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Restock</th></tr></thead>
              <tbody>
                {detailRet.items.map(it => (
                  <tr key={it.id}>
                    <td>#{it.drug_id}</td>
                    <td>{it.quantity_returned}</td>
                    <td>{Number(it.unit_price).toFixed(2)}</td>
                    <td>{Number(it.line_total).toFixed(2)}</td>
                    <td>{it.restock ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ textAlign: "right", fontWeight: "var(--font-weight-medium)", fontSize: "var(--font-size-sm)" }}>
              Total Refund: <strong>LKR {Number(detailRet.total_refund).toFixed(2)}</strong>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
