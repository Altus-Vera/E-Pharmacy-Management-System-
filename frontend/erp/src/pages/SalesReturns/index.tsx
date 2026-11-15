import { useEffect, useState } from "react";
import api from "../../services/api";
import { salesReturnService, type ReturnReason, type SalesReturn } from "../../services/sales_return.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table } from "../../components/ui/Table";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { formatCurrency, formatDateTime } from "../../utils/formatters";
import { apiError, exportCsv } from "../../utils/errors";
import s from "../../styles/erp.module.css";

interface InvoiceLine { id: number; drug_id: number; quantity: number; unit_price: number; line_total: number; discount_amount: number; drug?: { brand_name: string; item_code: string } | null }
interface InvoiceFull { id: number; invoice_number: string; total_amount: number; status: string; created_at: string; customer?: { name: string } | null; items: InvoiceLine[] }

const REASONS: { value: ReturnReason; label: string }[] = [
  { value: "damaged", label: "Damaged" },
  { value: "expired", label: "Expired" },
  { value: "wrong_item", label: "Wrong item" },
  { value: "patient_refusal", label: "Patient refusal" },
  { value: "other", label: "Other" },
];

const statusVariant = (st: string) => (st === "approved" ? "success" : st === "rejected" ? "danger" : "warning");

export function SalesReturnsPage() {
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [invNo, setInvNo] = useState("");
  const [invoice, setInvoice] = useState<InvoiceFull | null>(null);
  const [lineId, setLineId] = useState(0);
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState<ReturnReason>("damaged");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setReturns(await salesReturnService.getAll()); }
    finally { setLoading(false); }
  }

  function openNew() {
    setInvNo(""); setInvoice(null); setLineId(0); setQty(1); setReason("damaged"); setNotes(""); setError("");
    setModalOpen(true);
  }

  async function findInvoice() {
    setError(""); setInvoice(null); setLineId(0);
    const t = invNo.trim().toLowerCase();
    if (!t) return;
    try {
      const list = (await api.get<InvoiceFull[]>("/invoices")).data;
      const hit = list.find((i) => i.invoice_number.toLowerCase() === t) ?? list.find((i) => i.invoice_number.toLowerCase().includes(t));
      if (!hit) { setError("No invoice found with that number."); return; }
      const full = (await api.get<InvoiceFull>(`/invoices/${hit.id}`)).data;
      if (full.status === "cancelled") { setError("That invoice is cancelled — nothing to return."); return; }
      setInvoice(full);
      if (full.items.length === 1) { setLineId(full.items[0].id); setQty(1); }
    } catch (e) { setError(apiError(e)); }
  }

  const line = invoice?.items.find((i) => i.id === lineId);
  const alreadyReturned = line ? returns.filter((r) => r.invoice_id === invoice!.id && r.drug_id === line.drug_id && r.status !== "rejected").reduce((a, r) => a + r.quantity, 0) : 0;
  const maxQty = line ? line.quantity - alreadyReturned : 0;
  const unitNet = line ? line.line_total / line.quantity : 0;
  const refund = Math.round(unitNet * qty * 100) / 100;

  async function save() {
    if (!invoice || !line) { setError("Find the invoice and choose the item being returned."); return; }
    if (qty <= 0 || qty > maxQty) { setError(`Quantity must be between 1 and ${maxQty}.`); return; }
    setSaving(true); setError("");
    try {
      await salesReturnService.create({ invoice_id: invoice.id, drug_id: line.drug_id, quantity: qty, refund_amount: refund, reason, notes });
      setModalOpen(false);
      await load();
    } catch (e) { setError(apiError(e)); }
    finally { setSaving(false); }
  }

  async function approve(r: SalesReturn) {
    if (!confirm(`Approve ${r.return_number}? ${r.quantity} unit(s) go back into stock.`)) return;
    setError("");
    try {
      const u = await salesReturnService.approve(r.id);
      setReturns((p) => p.map((x) => (x.id === r.id ? { ...x, status: u.status } : x)));
    } catch (e) { setError(apiError(e)); }
  }

  const filtered = returns.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    const t = q.trim().toLowerCase();
    return !t || r.return_number.toLowerCase().includes(t) || (r.invoice?.invoice_number ?? "").toLowerCase().includes(t) || (r.drug?.brand_name ?? "").toLowerCase().includes(t);
  });

  const pending = returns.filter((r) => r.status === "pending");

  return (
    <div className={s.page}>
      <div className={s.stats}>
        <div className={s.stat}><div className={s.statLabel}>Returns</div><div className={s.statValue}>{returns.length}</div></div>
        <div className={`${s.stat} ${s.statWarn}`}><div className={s.statLabel}>Pending Approval</div><div className={s.statValue}>{pending.length}</div></div>
        <div className={`${s.stat} ${s.statDanger}`}><div className={s.statLabel}>Total Refunded</div><div className={s.statValue}>{formatCurrency(returns.filter((r) => r.status === "approved").reduce((a, r) => a + r.refund_amount, 0))}</div></div>
      </div>

      <div className={s.toolbar}>
        <input className={s.search} placeholder="Search return #, invoice # or drug…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={s.select} style={{ width: 170 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <div className={s.spacer} />
        <Button
          variant="secondary"
          onClick={() => exportCsv("sales-returns.csv", [
            ["Return #", "Invoice #", "Drug", "Qty", "Refund", "Reason", "Status", "Date"],
            ...filtered.map((r) => [r.return_number, r.invoice?.invoice_number ?? r.invoice_id, r.drug?.brand_name ?? r.drug_id, r.quantity, r.refund_amount.toFixed(2), r.reason, r.status, r.created_at]),
          ])}
        >Export CSV</Button>
        <Button onClick={openNew}>+ New Return</Button>
      </div>
      {error && !modalOpen && <div className={s.error}>{error}</div>}

      <Table<SalesReturn>
        columns={[
          { key: "return_number", header: "Return #", render: (r) => <span className={s.strong}>{r.return_number}</span> },
          { key: "invoice", header: "Invoice #", render: (r) => r.invoice?.invoice_number ?? `#${r.invoice_id}` },
          { key: "drug", header: "Drug", render: (r) => r.drug ? <>{r.drug.brand_name} <span className={s.muted}>{r.drug.item_code}</span></> : `#${r.drug_id}` },
          { key: "quantity", header: "Qty" },
          { key: "refund_amount", header: "Refund", render: (r) => formatCurrency(r.refund_amount) },
          { key: "reason", header: "Reason", render: (r) => REASONS.find((x) => x.value === r.reason)?.label ?? r.reason },
          { key: "status", header: "Status", render: (r) => <Badge variant={statusVariant(r.status)}>{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</Badge> },
          { key: "created_at", header: "Date", render: (r) => formatDateTime(r.created_at) },
          { key: "actions", header: "", render: (r) => (r.status === "pending" ? <Button size="sm" onClick={() => approve(r)}>Approve &amp; Restock</Button> : null) },
        ]}
        data={filtered}
        rowKey={(r) => r.id}
        emptyMessage={loading ? "Loading…" : "No sales returns found."}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Sales Return"
        size="lg"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button loading={saving} disabled={!line} onClick={save}>Record Return ({formatCurrency(refund)})</Button></>}
      >
        {error && <div className={s.error}>{error}</div>}
        <div className={s.toolbar} style={{ alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <Input label="Invoice Number" value={invNo} placeholder="e.g. INV-1794665994963" onChange={(e) => setInvNo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && findInvoice()} />
          </div>
          <Button variant="secondary" onClick={findInvoice}>Find</Button>
        </div>

        {invoice && <>
          <div className={s.detailGrid} style={{ marginTop: "var(--space-3)" }}>
            <div><span className={s.muted}>Invoice</span><div className={s.strong}>{invoice.invoice_number}</div></div>
            <div><span className={s.muted}>Date</span><div>{formatDateTime(invoice.created_at)}</div></div>
            <div><span className={s.muted}>Customer</span><div>{invoice.customer?.name ?? "Walk-in"}</div></div>
            <div><span className={s.muted}>Total</span><div>{formatCurrency(invoice.total_amount)}</div></div>
          </div>
          <table className={s.dtable}>
            <thead><tr><th></th><th>Item</th><th className={s.num}>Sold</th><th className={s.num}>Net / unit</th></tr></thead>
            <tbody>
              {invoice.items.map((i) => (
                <tr key={i.id} onClick={() => { setLineId(i.id); setQty(1); }} style={{ cursor: "pointer", background: i.id === lineId ? "var(--color-primary-light)" : undefined }}>
                  <td><input type="radio" checked={i.id === lineId} readOnly /></td>
                  <td>{i.drug ? `${i.drug.brand_name} (${i.drug.item_code})` : `Drug #${i.drug_id}`}</td>
                  <td className={s.num}>{i.quantity}</td>
                  <td className={s.num}>{formatCurrency(i.line_total / i.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {line && (
            <div className={s.formGrid} style={{ marginTop: "var(--space-3)" }}>
              <Input label={`Quantity (max ${maxQty})`} type="number" min={1} max={maxQty} value={qty} onChange={(e) => setQty(parseInt(e.target.value) || 0)} />
              <div className={s.field}>
                <span className={s.fieldLabel}>Reason</span>
                <select className={s.select} value={reason} onChange={(e) => setReason(e.target.value as ReturnReason)}>
                  {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className={s.full}><Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              {alreadyReturned > 0 && <div className={`${s.full} ${s.muted}`}>{alreadyReturned} unit(s) of this item were already returned on this invoice.</div>}
            </div>
          )}
        </>}
      </Modal>
    </div>
  );
}
