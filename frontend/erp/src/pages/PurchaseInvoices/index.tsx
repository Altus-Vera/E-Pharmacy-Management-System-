import { useEffect, useState } from "react";
import { purchaseInvoiceService, type PurchaseInvoice, type PurchaseInvoiceCreate } from "../../services/purchase_invoice.service";
import { supplierService } from "../../services/supplier.service";
import { grnService, type GoodsReceipt } from "../../services/grn.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table } from "../../components/ui/Table";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { apiError, exportCsv, todayIso } from "../../utils/errors";
import type { Supplier } from "../../types";
import s from "../../styles/erp.module.css";

const emptyForm = (): PurchaseInvoiceCreate => ({ invoice_number: "", supplier_id: 0, goods_receipt_id: null, invoice_date: todayIso(), total_amount: 0, notes: "" });

export function PurchaseInvoicesPage() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [grns, setGrns] = useState<GoodsReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<PurchaseInvoiceCreate>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [inv, sup, g] = await Promise.all([
        purchaseInvoiceService.getAll(),
        supplierService.getAll(),
        grnService.getAll().catch(() => [] as GoodsReceipt[]),
      ]);
      setInvoices(inv); setSuppliers(sup); setGrns(g);
    } finally { setLoading(false); }
  }

  const supName = (i: PurchaseInvoice) => i.supplier?.name ?? suppliers.find((x) => x.id === i.supplier_id)?.name ?? `#${i.supplier_id}`;

  /** Choosing a GRN fills the supplier and the total from the received lines. */
  function pickGrn(id: number) {
    const g = grns.find((x) => x.id === id);
    if (!g) { setForm((p) => ({ ...p, goods_receipt_id: null })); return; }
    const total = g.items.reduce((a, i) => a + (i.is_free_goods ? 0 : i.quantity_received * i.unit_cost), 0);
    setForm((p) => ({ ...p, goods_receipt_id: g.id, supplier_id: g.supplier_id, total_amount: Math.round(total * 100) / 100 }));
  }

  async function save() {
    if (!form.invoice_number.trim()) { setError("Enter the supplier's invoice number."); return; }
    if (!form.supplier_id) { setError("Select a supplier."); return; }
    if (form.total_amount <= 0) { setError("Total amount must be above zero."); return; }
    setSaving(true); setError("");
    try {
      await purchaseInvoiceService.create(form);
      setModalOpen(false);
      await load();
    } catch (e) { setError(apiError(e)); }
    finally { setSaving(false); }
  }

  async function markPaid(i: PurchaseInvoice) {
    if (!confirm(`Mark ${i.invoice_number} (${formatCurrency(i.total_amount)}) as paid?`)) return;
    setError("");
    try {
      const u = await purchaseInvoiceService.markPaid(i.id);
      setInvoices((p) => p.map((x) => (x.id === i.id ? { ...x, is_paid: u.is_paid, paid_at: u.paid_at } : x)));
    } catch (e) { setError(apiError(e)); }
  }

  const ageDays = (i: PurchaseInvoice) => Math.floor((Date.now() - new Date(i.invoice_date).getTime()) / 86400000);

  const filtered = invoices.filter((i) => {
    if (filter === "unpaid" && i.is_paid) return false;
    if (filter === "paid" && !i.is_paid) return false;
    if (filter === "overdue" && (i.is_paid || ageDays(i) <= 30)) return false;
    const t = q.trim().toLowerCase();
    return !t || i.invoice_number.toLowerCase().includes(t) || supName(i).toLowerCase().includes(t);
  });

  const unpaid = invoices.filter((i) => !i.is_paid);
  const overdue = unpaid.filter((i) => ageDays(i) > 30);

  return (
    <div className={s.page}>
      <div className={s.stats}>
        <div className={s.stat}><div className={s.statLabel}>Invoices</div><div className={s.statValue}>{invoices.length}</div></div>
        <div className={`${s.stat} ${s.statWarn}`}><div className={s.statLabel}>Payable (Unpaid)</div><div className={s.statValue}>{formatCurrency(unpaid.reduce((a, i) => a + i.total_amount, 0))}</div></div>
        <div className={`${s.stat} ${s.statDanger}`}><div className={s.statLabel}>Overdue &gt; 30 days</div><div className={s.statValue}>{overdue.length}</div></div>
        <div className={s.stat}><div className={s.statLabel}>Paid</div><div className={s.statValue}>{invoices.length - unpaid.length}</div></div>
      </div>

      <div className={s.toolbar}>
        <input className={s.search} placeholder="Search invoice # or supplier…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={s.select} style={{ width: 170 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="unpaid">Unpaid</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
        </select>
        <div className={s.spacer} />
        <Button
          variant="secondary"
          onClick={() => exportCsv("purchase-invoices.csv", [
            ["Invoice #", "Supplier", "Date", "Amount", "Paid", "Paid At"],
            ...filtered.map((i) => [i.invoice_number, supName(i), i.invoice_date, i.total_amount.toFixed(2), i.is_paid ? "Yes" : "No", i.paid_at]),
          ])}
        >Export CSV</Button>
        <Button onClick={() => { setForm(emptyForm()); setError(""); setModalOpen(true); }}>+ New Invoice</Button>
      </div>
      {error && !modalOpen && <div className={s.error}>{error}</div>}

      <Table<PurchaseInvoice>
        columns={[
          { key: "invoice_number", header: "Invoice #", render: (i) => <span className={s.strong}>{i.invoice_number}</span> },
          { key: "supplier", header: "Supplier", render: (i) => supName(i) },
          { key: "grn", header: "GRN", render: (i) => (i.goods_receipt_id ? grns.find((g) => g.id === i.goods_receipt_id)?.grn_number ?? `#${i.goods_receipt_id}` : "—") },
          { key: "invoice_date", header: "Date", render: (i) => formatDate(i.invoice_date) },
          { key: "age", header: "Age", render: (i) => (i.is_paid ? "—" : `${ageDays(i)} d`) },
          { key: "total_amount", header: "Amount", render: (i) => formatCurrency(i.total_amount) },
          { key: "status", header: "Status", render: (i) => i.is_paid ? <Badge variant="success">Paid</Badge> : ageDays(i) > 30 ? <Badge variant="danger">Overdue</Badge> : <Badge variant="warning">Unpaid</Badge> },
          { key: "actions", header: "", render: (i) => (!i.is_paid ? <Button size="sm" onClick={() => markPaid(i)}>Mark Paid</Button> : <span className={s.muted}>{i.paid_at ? formatDate(i.paid_at) : ""}</span>) },
        ]}
        data={filtered}
        rowKey={(i) => i.id}
        emptyMessage={loading ? "Loading…" : "No purchase invoices found."}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Purchase Invoice"
        size="lg"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>Save Invoice</Button></>}
      >
        {error && <div className={s.error}>{error}</div>}
        <div className={s.formGrid}>
          <div className={`${s.field} ${s.full}`}>
            <span className={s.fieldLabel}>Against GRN (optional — fills supplier and amount)</span>
            <select className={s.select} value={form.goods_receipt_id ?? 0} onChange={(e) => pickGrn(Number(e.target.value))}>
              <option value={0}>— None —</option>
              {grns.map((g) => <option key={g.id} value={g.id}>{g.grn_number} · {suppliers.find((x) => x.id === g.supplier_id)?.name ?? ""} · {formatDate(g.received_date)}</option>)}
            </select>
          </div>
          <Input label="Supplier Invoice # *" value={form.invoice_number} onChange={(e) => setForm((p) => ({ ...p, invoice_number: e.target.value }))} />
          <div className={s.field}>
            <span className={s.fieldLabel}>Supplier *</span>
            <select className={s.select} value={form.supplier_id} onChange={(e) => setForm((p) => ({ ...p, supplier_id: Number(e.target.value) }))}>
              <option value={0}>— Select supplier —</option>
              {suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
          <Input label="Invoice Date" type="date" value={form.invoice_date} onChange={(e) => setForm((p) => ({ ...p, invoice_date: e.target.value }))} />
          <Input label="Total Amount (Rs.) *" type="number" min={0} step={0.01} value={form.total_amount} onChange={(e) => setForm((p) => ({ ...p, total_amount: parseFloat(e.target.value) || 0 }))} />
          <div className={s.full}><Input label="Notes" value={form.notes ?? ""} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}
