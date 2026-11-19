import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import api from "../../services/api";
import { InvoiceScanModal, type InvoiceApply } from "./InvoiceScan";

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
  const [scanOpen, setScanOpen] = useState(false);
  const [fromScan, setFromScan] = useState(false);

  const [form, setForm] = useState<Omit<GrnCreate, "items">>({ supplier_id: 0, received_date: today, notes: "" });
  const [items, setItems] = useState<GrnItemCreate[]>([{ drug_id: 0, quantity_received: 1, unit_cost: 0 }]);

  const [params, setParams] = useSearchParams();
  useEffect(() => { load(); }, []);
  // "Receive" on a purchase order lands here with ?po=<id>: open the form with that order's lines
  useEffect(() => {
    const po = Number(params.get("po"));
    if (!po || !openPOs.some(p => p.id === po)) return;
    openNew();
    pickPo(po);
    setParams({}, { replace: true });
  }, [openPOs]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setFromScan(false);
    setModalOpen(true);
  }

  const supName = (id: number) => suppliers.find(x => x.id === id)?.name ?? `#${id}`;

  /** Linking a PO copies its supplier and outstanding lines. */
  function pickPo(id: number) {
    const po = openPOs.find(p => p.id === id);
    if (!po) { setForm(f => ({ ...f, purchase_order_id: undefined })); return; }
    setForm(f => ({ ...f, purchase_order_id: po.id, supplier_id: po.supplier_id }));
    const lines = po.items
      .map(i => ({ drug_id: i.drug_id, quantity_received: Math.max(i.quantity_ordered - (i.quantity_received ?? 0), 0), unit_cost: i.unit_cost, is_free_goods: false,
        selling_price: (i.drug as { unit_price?: number } | undefined)?.unit_price, current_price: (i.drug as { unit_price?: number } | undefined)?.unit_price }))
      .filter(l => l.quantity_received > 0);
    if (lines.length) setItems(lines);
  }

  /** Lines checked in the invoice scan → this form (prices looked up so the normal checks still apply). */
  async function applyScan(a: InvoiceApply) {
    const ids = [...new Set(a.items.map(i => i.drug_id))];
    const prices: Record<number, number | undefined> = {};
    await Promise.all(ids.map(id => api.get<{ unit_price: number }>(`/drugs/${id}`).then(r => { prices[id] = Number(r.data.unit_price); }).catch(() => undefined)));
    if (!modalOpen) openNew();
    setForm(f => ({ ...f, supplier_id: a.supplier_id ?? f.supplier_id, received_date: a.received_date ?? f.received_date, notes: [f.notes, a.notes].filter(Boolean).join(" · ") }));
    setItems(prev => [...prev.filter(i => i.drug_id), ...a.items.map(i => ({ ...i, current_price: prices[i.drug_id], selling_price: prices[i.drug_id] }))]);
    setFromScan(true);
    setScanOpen(false);
  }

  function addItem() { setItems(prev => [...prev, { drug_id: 0, quantity_received: 1, unit_cost: 0 }]); }
  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)); }
  function updateItem(idx: number, field: keyof GrnItemCreate, value: string | number | undefined) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  async function save() {
    if (!form.supplier_id) { setError("Select a supplier."); return; }
    if (items.some(i => !i.drug_id || i.quantity_received <= 0)) { setError("Every line needs a drug and a quantity above zero."); return; }
    if (items.some(i => !i.batch_number?.trim() || !i.expiry_date)) { setError("Every line needs the batch number and expiry date printed on the pack."); return; }
    if (items.some(i => i.expiry_date && i.expiry_date < today)) { setError("A batch is already expired — do not receive it."); return; }
    if (items.some(i => i.selling_price === undefined || i.selling_price < 0)) { setError("Every line needs a selling price."); return; }
    setSaving(true); setError("");
    try {
      await grnService.create({ ...form, items: items.map(i => ({
        drug_id: i.drug_id, quantity_received: i.quantity_received, unit_cost: i.unit_cost, is_free_goods: !!i.is_free_goods,
        batch_number: i.batch_number?.trim(), expiry_date: i.expiry_date, selling_price: i.selling_price, pack_selling_price: i.pack_selling_price,
      })) });
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
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Button variant="secondary" onClick={() => setScanOpen(true)} title="AI reads the supplier invoice (photo or PDF) and fills the GRN">📷 Auto GRN (Scan Invoice)</Button>
          <Button variant="primary" onClick={openNew} title="Type the received goods by hand">+ Manual GRN</Button>
        </div>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={fromScan ? "Auto GRN — check and create" : "Manual GRN — Goods Receipt Note"} size="lg">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {error && <div className={styles.errorBox}>{error}</div>}
          {fromScan
            ? <div style={{ background: "#fef3c7", color: "#92400e", padding: "6px 10px", borderRadius: 6, fontSize: "var(--font-size-sm)" }}>Lines filled from a scanned invoice. Check selling prices, then create the GRN.</div>
            : <div style={{ fontSize: "var(--font-size-sm)" }}>Have the supplier's invoice? Use Auto GRN: <button type="button" onClick={() => setScanOpen(true)} style={{ border: "none", background: "none", color: "var(--color-primary)", fontWeight: 700, cursor: "pointer", padding: 0 }}>📷 scan it to fill the lines</button></div>}
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
              <div key={idx} className={styles.batchLine}>
                <div className={styles.itemRow}>
                  <DrugPicker label="Drug" value={item.drug_id} onChange={d => setItems(prev => prev.map((it, i) => i === idx
                    ? { ...it, drug_id: d?.id ?? 0, current_price: d?.unit_price, selling_price: it.selling_price ?? d?.unit_price }
                    : it))} />
                  <Input label="Qty" type="number" value={item.quantity_received} onChange={e => updateItem(idx, "quantity_received", parseInt(e.target.value) || 1)} />
                  <Input label="Unit Cost" type="number" step="0.01" value={item.unit_cost} onChange={e => updateItem(idx, "unit_cost", parseFloat(e.target.value) || 0)} />
                  <label className={styles.freeLabel}>
                    <input type="checkbox" checked={!!item.is_free_goods} onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, is_free_goods: e.target.checked } : it))} /> Free
                  </label>
                  {items.length > 1 && <button className={styles.removeBtn} onClick={() => removeItem(idx)}>✕</button>}
                </div>
                <div className={styles.batchRow}>
                  <Input label="Batch No *" value={item.batch_number ?? ""} onChange={e => updateItem(idx, "batch_number", e.target.value)} placeholder="As on pack" />
                  <Input label="Expiry *" type="date" min={today} value={item.expiry_date ?? ""} onChange={e => updateItem(idx, "expiry_date", e.target.value)} />
                  <Input label="Unit Selling Price (Rs.) *" type="number" step="0.01" min={0} value={item.selling_price ?? ""}
                    onChange={e => updateItem(idx, "selling_price", e.target.value === "" ? undefined : parseFloat(e.target.value))} />
                  <Input label="Pack Price (optional)" type="number" step="0.01" min={0} value={item.pack_selling_price ?? ""} placeholder="units × unit price"
                    onChange={e => updateItem(idx, "pack_selling_price", e.target.value === "" ? undefined : parseFloat(e.target.value))} />
                  <div className={styles.priceHint}>
                    {item.current_price !== undefined && item.selling_price !== undefined && Math.abs(item.selling_price - item.current_price) > 0.004
                      ? <span className={styles.priceChanged}>Current stock sells at Rs. {item.current_price.toFixed(2)} — this batch will sell at Rs. {item.selling_price.toFixed(2)} once older stock is sold (FIFO)</span>
                      : item.current_price !== undefined ? <span>Same as current price Rs. {item.current_price.toFixed(2)}</span> : null}
                    {item.selling_price !== undefined && item.unit_cost > 0 && !item.is_free_goods &&
                      <span> · Margin {(((item.selling_price - item.unit_cost) / item.selling_price) * 100 || 0).toFixed(1)}%</span>}
                  </div>
                </div>
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

      <InvoiceScanModal open={scanOpen} onClose={() => setScanOpen(false)} onApply={a => void applyScan(a)} />

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
              <thead><tr><th>Drug ID</th><th>Batch</th><th>Expiry</th><th>Qty</th><th>Unit Cost</th><th>Selling</th><th>Free</th><th>Line Total</th></tr></thead>
              <tbody>
                {detailGrn.items.map(it => (
                  <tr key={it.id}>
                    <td>#{it.drug_id}</td>
                    <td>{it.batch_number ?? "—"}</td>
                    <td>{it.expiry_date ?? "—"}</td>
                    <td>{it.quantity_received}</td>
                    <td>{Number(it.unit_cost).toFixed(2)}</td>
                    <td>{it.selling_price != null ? Number(it.selling_price).toFixed(2) : "—"}</td>
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
