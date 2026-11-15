import { useEffect, useState } from "react";
import { purchaseOrderService } from "../../services/purchaseOrder.service";
import { supplierService } from "../../services/supplier.service";
import { grnService } from "../../services/grn.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table } from "../../components/ui/Table";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { DrugPicker } from "../../components/ui/DrugPicker";
import { formatCurrency, formatDate, formatPoStatus } from "../../utils/formatters";
import { apiError, exportCsv, todayIso } from "../../utils/errors";
import type { PurchaseOrder, PurchaseOrderItemCreate, PurchaseOrderStatus, Supplier } from "../../types";
import s from "../../styles/erp.module.css";

const emptyItem = (): PurchaseOrderItemCreate => ({ drug_id: 0, quantity_ordered: 1, unit_cost: 0 });
const OPEN = ["draft", "submitted", "partially_received"];

const statusVariant = (st: string): "warning" | "success" | "danger" | "primary" | "neutral" =>
  st === "received" ? "success" : st === "cancelled" ? "danger" : st === "submitted" ? "primary" : st === "draft" ? "neutral" : "warning";

const poTotal = (p: PurchaseOrder) => p.items.reduce((a, i) => a + i.quantity_ordered * i.unit_cost, 0);

export function PurchaseOrdersPage() {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [supplierId, setSupplierId] = useState(0);
  const [orderDate, setOrderDate] = useState(todayIso());
  const [expected, setExpected] = useState("");
  const [remarks, setRemarks] = useState("");
  const [items, setItems] = useState<PurchaseOrderItemCreate[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<PurchaseOrder | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([purchaseOrderService.getAll(), supplierService.getAll()]);
      setPos(a);
      setSuppliers(b);
    } finally { setLoading(false); }
  }

  const supName = (id: number) => suppliers.find((x) => x.id === id)?.name ?? `#${id}`;

  function openNew() {
    setSupplierId(suppliers[0]?.id ?? 0);
    setOrderDate(todayIso()); setExpected(""); setRemarks("");
    setItems([emptyItem()]); setError(""); setModalOpen(true);
  }

  const updateItem = (idx: number, patch: Partial<PurchaseOrderItemCreate>) =>
    setItems((p) => p.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  async function handleSave() {
    if (!supplierId) { setError("Select a supplier."); return; }
    if (items.some((i) => !i.drug_id || i.quantity_ordered <= 0)) { setError("Every line needs a drug and a quantity above zero."); return; }
    setSaving(true); setError("");
    try {
      const c = await purchaseOrderService.create({
        supplier_id: supplierId, order_date: orderDate, expected_delivery_date: expected || null, remarks, items,
      });
      setPos((p) => [c, ...p]);
      setModalOpen(false);
    } catch (e) { setError(apiError(e)); }
    finally { setSaving(false); }
  }

  async function openDetail(p: PurchaseOrder) {
    setDetail(p); setError("");
    try { setDetail(await purchaseOrderService.getById(p.id)); } catch { /* keep the list version */ }
  }

  async function setStatus(p: PurchaseOrder, st: PurchaseOrderStatus) {
    if (st === "cancelled" && !confirm(`Cancel ${p.order_number}?`)) return;
    setBusy(true); setError("");
    try {
      const u = await purchaseOrderService.updateStatus(p.id, st);
      setPos((list) => list.map((x) => (x.id === p.id ? { ...x, status: u.status } : x)));
      setDetail((d) => (d && d.id === p.id ? { ...d, status: u.status } : d));
    } catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  }

  /** Receive every outstanding quantity: creates a GRN (which adds stock) and marks the order received. */
  async function receiveAll(p: PurchaseOrder) {
    const lines = p.items
      .map((i) => ({ drug_id: i.drug_id, quantity_received: i.quantity_ordered - (i.quantity_received ?? 0), unit_cost: i.unit_cost, is_free_goods: false }))
      .filter((l) => l.quantity_received > 0);
    if (!lines.length) { setError("Nothing outstanding to receive."); return; }
    if (!confirm(`Receive ${lines.length} line(s) into stock for ${p.order_number}?`)) return;
    setBusy(true); setError("");
    try {
      await grnService.create({
        purchase_order_id: p.id, supplier_id: p.supplier_id, received_date: todayIso(),
        notes: `Received against ${p.order_number}`, items: lines,
      });
      await purchaseOrderService.updateStatus(p.id, "received");
      setDetail(null);
      await load();
    } catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  }

  const filtered = pos.filter((p) => {
    if (statusFilter === "open" && !OPEN.includes(p.status)) return false;
    if (statusFilter !== "all" && statusFilter !== "open" && p.status !== statusFilter) return false;
    const t = q.trim().toLowerCase();
    return !t || p.order_number.toLowerCase().includes(t) || supName(p.supplier_id).toLowerCase().includes(t);
  });

  const openOrders = pos.filter((p) => OPEN.includes(p.status));
  const draftTotal = items.reduce((a, i) => a + i.quantity_ordered * i.unit_cost, 0);

  return (
    <div className={s.page}>
      <div className={s.stats}>
        <div className={s.stat}><div className={s.statLabel}>Total Orders</div><div className={s.statValue}>{pos.length}</div></div>
        <div className={`${s.stat} ${s.statWarn}`}><div className={s.statLabel}>Open</div><div className={s.statValue}>{openOrders.length}</div></div>
        <div className={`${s.stat} ${s.statInfo}`}><div className={s.statLabel}>Open Value</div><div className={s.statValue}>{formatCurrency(openOrders.reduce((a, p) => a + poTotal(p), 0))}</div></div>
        <div className={s.stat}><div className={s.statLabel}>Received</div><div className={s.statValue}>{pos.filter((p) => p.status === "received").length}</div></div>
      </div>

      <div className={s.toolbar}>
        <input className={s.search} placeholder="Search order # or supplier…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={s.select} style={{ width: 190 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="open">Open only</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="partially_received">Partially received</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <div className={s.spacer} />
        <Button
          variant="secondary"
          onClick={() => exportCsv("purchase-orders.csv", [
            ["Order #", "Supplier", "Date", "Status", "Lines", "Value"],
            ...filtered.map((p) => [p.order_number, supName(p.supplier_id), p.order_date, p.status, p.items.length, poTotal(p).toFixed(2)]),
          ])}
        >Export CSV</Button>
        <Button onClick={openNew}>+ New Order</Button>
      </div>
      {error && !modalOpen && !detail && <div className={s.error}>{error}</div>}

      <Table<PurchaseOrder>
        columns={[
          { key: "order_number", header: "Order #", render: (r) => <span className={s.strong}>{r.order_number}</span> },
          { key: "supplier_id", header: "Supplier", render: (r) => supName(r.supplier_id) },
          { key: "order_date", header: "Order Date", render: (r) => (r.order_date ? formatDate(r.order_date) : "—") },
          { key: "expected", header: "Expected", render: (r) => (r.expected_delivery_date ? formatDate(r.expected_delivery_date) : "—") },
          { key: "items", header: "Lines", render: (r) => r.items.length },
          { key: "value", header: "Value", render: (r) => formatCurrency(poTotal(r)) },
          { key: "status", header: "Status", render: (r) => <Badge variant={statusVariant(r.status)}>{formatPoStatus(r.status)}</Badge> },
          {
            key: "actions", header: "", render: (r) => (
              <div className={s.actions}>
                <Button variant="ghost" size="sm" onClick={() => openDetail(r)}>View</Button>
                {r.status === "draft" && <Button variant="secondary" size="sm" disabled={busy} onClick={() => setStatus(r, "submitted")}>Submit</Button>}
                {(r.status === "submitted" || r.status === "partially_received") && <Button size="sm" disabled={busy} onClick={() => receiveAll(r)}>Receive</Button>}
              </div>
            ),
          },
        ]}
        data={filtered}
        rowKey={(r) => r.id}
        emptyMessage={loading ? "Loading…" : "No purchase orders found."}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Purchase Order"
        size="lg"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleSave}>Create Order</Button></>}
      >
        {error && <div className={s.error}>{error}</div>}
        <div className={s.formGrid}>
          <div className={s.field}>
            <span className={s.fieldLabel}>Supplier *</span>
            <select className={s.select} value={supplierId} onChange={(e) => setSupplierId(Number(e.target.value))}>
              <option value={0}>— Select supplier —</option>
              {suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
          <Input label="Order Date" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          <Input label="Expected Delivery" type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
          <Input label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />
        </div>
        <div className={s.lines}>
          <div className={s.linesTitle}>Order Lines</div>
          {items.map((it, idx) => (
            <div key={idx} className={s.line}>
              <DrugPicker label={idx === 0 ? "Drug" : undefined} value={it.drug_id} onChange={(d) => updateItem(idx, { drug_id: d?.id ?? 0 })} />
              <Input label={idx === 0 ? "Qty" : ""} type="number" min={1} value={it.quantity_ordered} onChange={(e) => updateItem(idx, { quantity_ordered: parseInt(e.target.value) || 0 })} />
              <Input label={idx === 0 ? "Unit Cost" : ""} type="number" min={0} step={0.01} value={it.unit_cost} onChange={(e) => updateItem(idx, { unit_cost: parseFloat(e.target.value) || 0 })} />
              <button className={s.removeBtn} onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} disabled={items.length === 1}>✕</button>
            </div>
          ))}
          <div><Button variant="secondary" size="sm" onClick={() => setItems((p) => [...p, emptyItem()])}>+ Add Line</Button></div>
          <div className={s.total}>Order Total: {formatCurrency(draftTotal)}</div>
        </div>
      </Modal>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Purchase Order ${detail.order_number}` : ""}
        size="lg"
        footer={detail && <>
          {OPEN.includes(detail.status) && <Button variant="danger" disabled={busy} onClick={() => setStatus(detail, "cancelled")}>Cancel Order</Button>}
          {detail.status === "draft" && <Button variant="secondary" disabled={busy} onClick={() => setStatus(detail, "submitted")}>Submit</Button>}
          {(detail.status === "submitted" || detail.status === "partially_received") && <Button disabled={busy} onClick={() => receiveAll(detail)}>Receive All into Stock</Button>}
          <Button variant="secondary" onClick={() => window.print()}>Print</Button>
        </>}
      >
        {detail && <>
          {error && <div className={s.error}>{error}</div>}
          <div className={s.detailGrid}>
            <div><span className={s.muted}>Supplier</span><div className={s.strong}>{supName(detail.supplier_id)}</div></div>
            <div><span className={s.muted}>Status</span><div><Badge variant={statusVariant(detail.status)}>{formatPoStatus(detail.status)}</Badge></div></div>
            <div><span className={s.muted}>Order Date</span><div>{detail.order_date ? formatDate(detail.order_date) : "—"}</div></div>
            <div><span className={s.muted}>Expected</span><div>{detail.expected_delivery_date ? formatDate(detail.expected_delivery_date) : "—"}</div></div>
            <div className={s.full}><span className={s.muted}>Remarks</span><div>{detail.remarks || "—"}</div></div>
          </div>
          <table className={s.dtable}>
            <thead>
              <tr><th>Drug</th><th className={s.num}>Ordered</th><th className={s.num}>Received</th><th className={s.num}>Unit Cost</th><th className={s.num}>Total</th></tr>
            </thead>
            <tbody>
              {detail.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.drug ? `${i.drug.brand_name} (${i.drug.item_code})` : `Drug #${i.drug_id}`}</td>
                  <td className={s.num}>{i.quantity_ordered}</td>
                  <td className={s.num}>{i.quantity_received ?? 0}</td>
                  <td className={s.num}>{formatCurrency(i.unit_cost)}</td>
                  <td className={s.num}>{formatCurrency(i.unit_cost * i.quantity_ordered)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={s.total}>Total: {formatCurrency(poTotal(detail))}</div>
        </>}
      </Modal>
    </div>
  );
}
