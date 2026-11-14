import { useEffect, useState } from "react";
import { grnService, type GoodsReceipt, type GrnCreate, type GrnItemCreate } from "../../services/grn.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Table } from "../../components/ui/Table";
import styles from "./GoodsReceipts.module.css";

const today = new Date().toISOString().split("T")[0];

export function GoodsReceiptsPage() {
  const [grns, setGrns] = useState<GoodsReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailGrn, setDetailGrn] = useState<GoodsReceipt | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<Omit<GrnCreate, "items">>({ supplier_id: 0, received_date: today, notes: "" });
  const [items, setItems] = useState<GrnItemCreate[]>([{ drug_id: 0, quantity_received: 1, unit_cost: 0 }]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setGrns(await grnService.getAll()); }
    finally { setLoading(false); }
  }

  function openNew() {
    setForm({ supplier_id: 0, received_date: today, notes: "" });
    setItems([{ drug_id: 0, quantity_received: 1, unit_cost: 0 }]);
    setModalOpen(true);
  }

  function addItem() { setItems(prev => [...prev, { drug_id: 0, quantity_received: 1, unit_cost: 0 }]); }
  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)); }
  function updateItem(idx: number, field: keyof GrnItemCreate, value: string | number | undefined) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  async function save() {
    if (!form.supplier_id || items.some(i => !i.drug_id)) return;
    setSaving(true);
    try {
      await grnService.create({ ...form, items });
      setModalOpen(false);
      load();
    } finally { setSaving(false); }
  }

  const thisMonth = grns.filter(g => {
    const d = new Date(g.received_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className={styles.page}>
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{grns.length}</div>
          <div className={styles.statLabel}>Total GRNs</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{thisMonth}</div>
          <div className={styles.statLabel}>This Month</div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
          Record goods received from suppliers — updates stock automatically
        </span>
        <Button variant="primary" onClick={openNew}>+ New GRN</Button>
      </div>

      <Table<GoodsReceipt>
        columns={[
          { key: "grn_number", header: "GRN #", render: g => <code style={{ fontSize: "var(--font-size-sm)" }}>{g.grn_number}</code> },
          { key: "supplier", header: "Supplier ID", render: g => <span>#{g.supplier_id}</span> },
          { key: "date", header: "Received Date", render: g => <span>{g.received_date}</span> },
          { key: "items", header: "Items", render: g => <span>{g.items.length} drug(s)</span> },
          { key: "notes", header: "Notes", render: g => <span style={{ color: "var(--color-text-muted)" }}>{g.notes || "—"}</span> },
          { key: "actions", header: "", render: g => <Button size="sm" variant="ghost" onClick={() => setDetailGrn(g)}>View</Button> },
        ]}
        data={grns}
        rowKey={g => g.id}
        emptyMessage={loading ? "Loading…" : "No GRNs found."}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Goods Receipt Note">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <Input label="Supplier ID *" type="number" value={form.supplier_id || ""} onChange={e => setForm(f => ({ ...f, supplier_id: parseInt(e.target.value) || 0 }))} placeholder="Supplier ID" />
            <Input label="Received Date *" type="date" value={form.received_date} onChange={e => setForm(f => ({ ...f, received_date: e.target.value }))} />
          </div>
          <Input label="PO Number (optional)" type="number" value={form.purchase_order_id || ""} onChange={e => setForm(f => ({ ...f, purchase_order_id: parseInt(e.target.value) || undefined }))} placeholder="Link to Purchase Order ID" />
          <Input label="Notes" value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Delivery notes" />

          <div className={styles.itemsSection}>
            <div className={styles.itemsHeader}>
              <span>Items Received</span>
              <Button size="sm" variant="ghost" onClick={addItem}>+ Add Item</Button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className={styles.itemRow}>
                <Input label="Drug ID" type="number" value={item.drug_id || ""} onChange={e => updateItem(idx, "drug_id", parseInt(e.target.value) || 0)} placeholder="Drug ID" />
                <Input label="Qty" type="number" value={item.quantity_received} onChange={e => updateItem(idx, "quantity_received", parseInt(e.target.value) || 1)} />
                <Input label="Unit Cost" type="number" step="0.01" value={item.unit_cost} onChange={e => updateItem(idx, "unit_cost", parseFloat(e.target.value) || 0)} />
                <Input label="Batch #" value={item.batch_number ?? ""} onChange={e => updateItem(idx, "batch_number", e.target.value)} placeholder="Optional" />
                <Input label="Expiry" type="date" value={item.expiry_date ?? ""} onChange={e => updateItem(idx, "expiry_date", e.target.value || undefined)} />
                {items.length > 1 && <button className={styles.removeBtn} onClick={() => removeItem(idx)}>✕</button>}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={saving || !form.supplier_id || items.some(i => !i.drug_id)}>
              {saving ? "Saving…" : "Create GRN & Update Stock"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detailGrn} onClose={() => setDetailGrn(null)} title={`GRN Detail — ${detailGrn?.grn_number}`}>
        {detailGrn && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)", fontSize: "var(--font-size-sm)" }}>
              <div><span style={{ color: "var(--color-text-muted)" }}>Supplier:</span> #{detailGrn.supplier_id}</div>
              <div><span style={{ color: "var(--color-text-muted)" }}>Date:</span> {detailGrn.received_date}</div>
              {detailGrn.purchase_order_id && <div><span style={{ color: "var(--color-text-muted)" }}>PO:</span> #{detailGrn.purchase_order_id}</div>}
              {detailGrn.notes && <div><span style={{ color: "var(--color-text-muted)" }}>Notes:</span> {detailGrn.notes}</div>}
            </div>
            <table className={styles.detailTable}>
              <thead><tr><th>Drug ID</th><th>Qty</th><th>Unit Cost</th><th>Batch</th><th>Expiry</th></tr></thead>
              <tbody>
                {detailGrn.items.map(it => (
                  <tr key={it.id}>
                    <td>#{it.drug_id}</td>
                    <td>{it.quantity_received}</td>
                    <td>{Number(it.unit_cost).toFixed(2)}</td>
                    <td>{it.batch_number || "—"}</td>
                    <td>{it.expiry_date || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
