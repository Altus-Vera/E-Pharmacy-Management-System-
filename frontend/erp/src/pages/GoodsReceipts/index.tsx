import { useEffect, useState } from "react";
import { grnService, type GoodsReceipt, type GrnCreate, type GrnItemCreate } from "../../services/grn.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Table } from "../../components/ui/Table";
import { DrugPicker } from "../../components/ui/DrugPicker";
import { supplierService } from "../../services/supplier.service";
import { purchaseOrderService } from "../../services/purchaseOrder.service";
import { apiError } from "../../utils/errors";
import type { PurchaseOrder, Supplier } from "../../types";
import styles from "./GoodsReceipts.module.css";

const today = new Date().toISOString().split("T")[0];

export function GoodsReceiptsPage() {
  const [grns, setGrns] = useState<GoodsReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailGrn, setDetailGrn] = useState<GoodsReceipt | null>(null);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [openPOs, setOpenPOs] = useState<PurchaseOrder[]>([]);
  const [error, setError] = useState("");

  const [form, setForm] = useState<Omit<GrnCreate, "items">>({ supplier_id: 0, received_date: today, notes: "" });
  const [items, setItems] = useState<GrnItemCreate[]>([{ drug_id: 0, quantity_received: 1, unit_cost: 0 }]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [g, sup, po] = await Promise.all([
        grnService.getAll(),
        supplierService.getAll().catch(() => [] as Supplier[]),
        purchaseOrderService.getPending().catch(() => [] as PurchaseOrder[]),
      ]);
      setGrns(g); setSuppliers(sup); setOpenPOs(po);
    }
    finally { setLoading(false); }
  }

  function openNew() {
    setForm({ supplier_id: 0, received_date: today, notes: "" });
    setItems([{ drug_id: 0, quantity_received: 1, unit_cost: 0 }]);
    setError("");
    setModalOpen(true);
  }

  const supName = (id: number) => suppliers.find(x => x.id === id)?.name ?? `#${id}`;

  /** Linking a PO copies its supplier and outstanding lines. */
  function pickPo(id: number) {
    const po = openPOs.find(p => p.id === id);
    if (!po) { setForm(f => ({ ...f, purchase_order_id: undefined })); return; }
    setForm(f => ({ ...f, purchase_order_id: po.id, supplier_id: po.supplier_id }));
    const lines = po.items
      .map(i => ({ drug_id: i.drug_id, quantity_received: Math.max(i.quantity_ordered - (i.quantity_received ?? 0), 0), unit_cost: i.unit_cost, is_free_goods: false }))
      .filter(l => l.quantity_received > 0);
    if (lines.length) setItems(lines);
  }

  function addItem() { setItems(prev => [...prev, { drug_id: 0, quantity_received: 1, unit_cost: 0 }]); }
  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)); }
  function updateItem(idx: number, field: keyof GrnItemCreate, value: string | number | undefined) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  async function save() {
    if (!form.supplier_id) { setError("Select a supplier."); return; }
    if (items.some(i => !i.drug_id || i.quantity_received <= 0)) { setError("Every line needs a drug and a quantity above zero."); return; }
    setSaving(true); setError("");
    try {
      await grnService.create({ ...form, items: items.map(i => ({ drug_id: i.drug_id, quantity_received: i.quantity_received, unit_cost: i.unit_cost, is_free_goods: !!i.is_free_goods })) });
      if (form.purchase_order_id) await purchaseOrderService.updateStatus(form.purchase_order_id, "received").catch(() => undefined);
      setModalOpen(false);
      load();
    } catch (e) { setError(apiError(e)); }
    finally { setSaving(false); }
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
          { key: "supplier", header: "Supplier", render: g => <span>{supName(g.supplier_id)}</span> },
          { key: "date", header: "Received Date", render: g => <span>{g.received_date}</span> },
          { key: "items", header: "Items", render: g => <span>{g.items.length} drug(s)</span> },
          { key: "notes", header: "Notes", render: g => <span style={{ color: "var(--color-text-muted)" }}>{g.notes || "—"}</span> },
          { key: "actions", header: "", render: g => <Button size="sm" variant="ghost" onClick={() => setDetailGrn(g)}>View</Button> },
        ]}
        data={grns}
        rowKey={g => g.id}
        emptyMessage={loading ? "Loading…" : "No GRNs found."}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Goods Receipt Note" size="lg">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {error && <div className={styles.errorBox}>{error}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <label className={styles.selectLabel}>Supplier *
              <select className={styles.select} value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: Number(e.target.value) }))}>
                <option value={0}>— Select supplier —</option>
                {suppliers.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <Input label="Received Date *" type="date" value={form.received_date} onChange={e => setForm(f => ({ ...f, received_date: e.target.value }))} />
          </div>
          <label className={styles.selectLabel}>Against Purchase Order (optional — fills supplier and lines)
            <select className={styles.select} value={form.purchase_order_id ?? 0} onChange={e => pickPo(Number(e.target.value))}>
              <option value={0}>— None —</option>
              {openPOs.map(p => <option key={p.id} value={p.id}>{p.order_number} · {supName(p.supplier_id)} · {p.items.length} line(s)</option>)}
            </select>
          </label>
          <Input label="Notes" value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Delivery notes" />

          <div className={styles.itemsSection}>
            <div className={styles.itemsHeader}>
              <span>Items Received</span>
              <Button size="sm" variant="ghost" onClick={addItem}>+ Add Item</Button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className={styles.itemRow}>
                <DrugPicker label="Drug" value={item.drug_id} onChange={d => updateItem(idx, "drug_id", d?.id ?? 0)} />
                <Input label="Qty" type="number" value={item.quantity_received} onChange={e => updateItem(idx, "quantity_received", parseInt(e.target.value) || 1)} />
                <Input label="Unit Cost" type="number" step="0.01" value={item.unit_cost} onChange={e => updateItem(idx, "unit_cost", parseFloat(e.target.value) || 0)} />
                <label className={styles.freeLabel}>
                  <input type="checkbox" checked={!!item.is_free_goods} onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, is_free_goods: e.target.checked } : it))} /> Free
                </label>
                {items.length > 1 && <button className={styles.removeBtn} onClick={() => removeItem(idx)}>✕</button>}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Create GRN & Update Stock"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detailGrn} onClose={() => setDetailGrn(null)} title={`GRN Detail — ${detailGrn?.grn_number}`}>
        {detailGrn && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)", fontSize: "var(--font-size-sm)" }}>
              <div><span style={{ color: "var(--color-text-muted)" }}>Supplier:</span> {supName(detailGrn.supplier_id)}</div>
              <div><span style={{ color: "var(--color-text-muted)" }}>Date:</span> {detailGrn.received_date}</div>
              {detailGrn.purchase_order_id && <div><span style={{ color: "var(--color-text-muted)" }}>PO:</span> #{detailGrn.purchase_order_id}</div>}
              {detailGrn.notes && <div><span style={{ color: "var(--color-text-muted)" }}>Notes:</span> {detailGrn.notes}</div>}
            </div>
            <table className={styles.detailTable}>
              <thead><tr><th>Drug ID</th><th>Qty</th><th>Unit Cost</th><th>Free</th><th>Line Total</th></tr></thead>
              <tbody>
                {detailGrn.items.map(it => (
                  <tr key={it.id}>
                    <td>#{it.drug_id}</td>
                    <td>{it.quantity_received}</td>
                    <td>{Number(it.unit_cost).toFixed(2)}</td>
                    <td>{it.is_free_goods ? "Yes" : "—"}</td>
                    <td>{it.is_free_goods ? "0.00" : (it.quantity_received * Number(it.unit_cost)).toFixed(2)}</td>
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
