import { useEffect, useState } from "react";
import {
  purchaseInvoiceService,
  type PurchaseInvoice,
  type PurchaseInvoiceCreate,
  type PurchaseInvoiceStatus,
} from "../../services/purchase_invoice.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { Table } from "../../components/ui/Table";
import styles from "./PurchaseInvoices.module.css";

const today = new Date().toISOString().split("T")[0];

type BadgeVariant = "neutral" | "warning" | "success" | "danger";
const STATUS_BADGE: Record<PurchaseInvoiceStatus, BadgeVariant> = {
  unpaid: "warning",
  partially_paid: "warning",
  paid: "success",
  overdue: "danger",
};

const emptyForm: PurchaseInvoiceCreate = {
  supplier_id: 0,
  invoice_date: today,
  subtotal: 0,
  total_amount: 0,
};

export function PurchaseInvoicesPage() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<PurchaseInvoiceStatus | "all">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [payTarget, setPayTarget] = useState<PurchaseInvoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [form, setForm] = useState<PurchaseInvoiceCreate>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setInvoices(await purchaseInvoiceService.getAll()); }
    finally { setLoading(false); }
  }

  function openNew() { setForm(emptyForm); setModalOpen(true); }

  async function save() {
    if (!form.supplier_id || !form.total_amount) return;
    setSaving(true);
    try {
      await purchaseInvoiceService.create(form);
      setModalOpen(false);
      load();
    } finally { setSaving(false); }
  }

  async function recordPayment() {
    if (!payTarget || !payAmount) return;
    setSaving(true);
    try {
      const newPaid = Number(payTarget.paid_amount) + parseFloat(payAmount);
      await purchaseInvoiceService.recordPayment(payTarget.id, newPaid);
      setPayModal(false);
      load();
    } finally { setSaving(false); }
  }

  const filtered = invoices.filter(inv => statusFilter === "all" || inv.status === statusFilter);
  const totalUnpaid = invoices.filter(i => i.status !== "paid").reduce((s, i) => s + Number(i.total_amount) - Number(i.paid_amount), 0);

  return (
    <div className={styles.page}>
      <div className={styles.statsBar}>
        <div className={styles.statCard}><div className={styles.statValue}>{invoices.length}</div><div className={styles.statLabel}>Total Invoices</div></div>
        <div className={styles.statCard}><div className={`${styles.statValue} ${styles.warn}`}>{invoices.filter(i => i.status === "unpaid").length}</div><div className={styles.statLabel}>Unpaid</div></div>
        <div className={styles.statCard}><div className={`${styles.statValue} ${styles.danger}`}>{invoices.filter(i => i.status === "overdue").length}</div><div className={styles.statLabel}>Overdue</div></div>
        <div className={styles.statCard}><div className={`${styles.statValue} ${styles.warn}`}>LKR {totalUnpaid.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</div><div className={styles.statLabel}>Outstanding Amount</div></div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filterTabs}>
          {(["all", "unpaid", "partially_paid", "paid", "overdue"] as const).map(s => (
            <button key={s} className={`${styles.filterTab} ${statusFilter === s ? styles.filterTabActive : ""}`} onClick={() => setStatusFilter(s)}>
              {s.replace("_", " ").replace(/^\w/, c => c.toUpperCase())}
            </button>
          ))}
        </div>
        <Button variant="primary" onClick={openNew}>+ New Invoice</Button>
      </div>

      <Table<PurchaseInvoice>
        columns={[
          { key: "invoice_number", header: "Invoice #", render: inv => <code style={{ fontSize: "var(--font-size-sm)" }}>{inv.invoice_number}</code> },
          { key: "supplier", header: "Supplier", render: inv => <span>#{inv.supplier_id}</span> },
          { key: "date", header: "Date", render: inv => <span>{inv.invoice_date}</span> },
          { key: "due_date", header: "Due Date", render: inv => inv.due_date ? <span>{inv.due_date}</span> : <span style={{ color: "var(--color-text-muted)" }}>—</span> },
          { key: "total", header: "Total", render: inv => <span style={{ textAlign: "right", display: "block" }}>{Number(inv.total_amount).toFixed(2)}</span> },
          { key: "paid", header: "Paid", render: inv => <span style={{ textAlign: "right", display: "block", color: Number(inv.paid_amount) > 0 ? "var(--color-success)" : "var(--color-text-muted)" }}>{Number(inv.paid_amount).toFixed(2)}</span> },
          { key: "status", header: "Status", render: inv => <Badge variant={STATUS_BADGE[inv.status]}>{inv.status.replace("_", " ")}</Badge> },
          { key: "actions", header: "", render: inv => inv.status !== "paid" ? (
            <Button size="sm" variant="ghost" onClick={() => { setPayTarget(inv); setPayAmount(""); setPayModal(true); }}>
              Record Payment
            </Button>
          ) : null },
        ]}
        data={filtered}
        rowKey={inv => inv.id}
        emptyMessage={loading ? "Loading…" : "No invoices found."}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Purchase Invoice">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <Input label="Supplier ID *" type="number" value={form.supplier_id || ""} onChange={e => setForm(f => ({ ...f, supplier_id: parseInt(e.target.value) || 0 }))} />
            <Input label="Invoice Date *" type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
            <Input label="Due Date" type="date" value={form.due_date ?? ""} onChange={e => setForm(f => ({ ...f, due_date: e.target.value || undefined }))} />
            <Input label="Link to PO ID" type="number" value={form.purchase_order_id ?? ""} onChange={e => setForm(f => ({ ...f, purchase_order_id: parseInt(e.target.value) || undefined }))} placeholder="Optional" />
            <Input label="Link to GRN ID" type="number" value={form.grn_id ?? ""} onChange={e => setForm(f => ({ ...f, grn_id: parseInt(e.target.value) || undefined }))} placeholder="Optional" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)" }}>
            <Input label="Subtotal *" type="number" step="0.01" value={form.subtotal || ""} onChange={e => setForm(f => ({ ...f, subtotal: parseFloat(e.target.value) || 0 }))} />
            <Input label="Tax Amount" type="number" step="0.01" value={form.tax_amount ?? 0} onChange={e => setForm(f => ({ ...f, tax_amount: parseFloat(e.target.value) || 0 }))} />
            <Input label="Discount" type="number" step="0.01" value={form.discount_amount ?? 0} onChange={e => setForm(f => ({ ...f, discount_amount: parseFloat(e.target.value) || 0 }))} />
          </div>
          <Input label="Total Amount *" type="number" step="0.01" value={form.total_amount || ""} onChange={e => setForm(f => ({ ...f, total_amount: parseFloat(e.target.value) || 0 }))} />
          <Input label="Notes" value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={saving || !form.supplier_id || !form.total_amount}>{saving ? "Saving…" : "Save Invoice"}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={payModal} onClose={() => setPayModal(false)} title={`Record Payment — ${payTarget?.invoice_number}`}>
        {payTarget && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)", fontSize: "var(--font-size-sm)" }}>
              <div>Total: <strong>LKR {Number(payTarget.total_amount).toFixed(2)}</strong></div>
              <div>Already Paid: <strong>LKR {Number(payTarget.paid_amount).toFixed(2)}</strong></div>
              <div>Outstanding: <strong style={{ color: "var(--color-danger)" }}>LKR {(Number(payTarget.total_amount) - Number(payTarget.paid_amount)).toFixed(2)}</strong></div>
            </div>
            <Input label="Payment Amount *" type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="Amount being paid now" />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
              <Button variant="ghost" onClick={() => setPayModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={recordPayment} disabled={saving || !payAmount}>{saving ? "Saving…" : "Record Payment"}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
