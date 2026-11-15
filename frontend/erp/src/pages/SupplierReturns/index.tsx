import { useEffect, useState } from "react";
import api from "../../services/api";
import { supplierService } from "../../services/supplier.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table } from "../../components/ui/Table";
import { Modal } from "../../components/ui/Modal";
import { DrugPicker } from "../../components/ui/DrugPicker";
import { formatCurrency, formatDateTime } from "../../utils/formatters";
import { apiError, exportCsv } from "../../utils/errors";
import type { Drug, Supplier } from "../../types";
import s from "../../styles/erp.module.css";

interface SupplierReturn {
  id: number; return_number: string; supplier_id: number; drug_id: number; quantity: number; unit_cost: number;
  reason: string | null; created_at: string;
  supplier?: { name: string } | null; drug?: { brand_name: string; item_code: string } | null;
}

const REASONS = ["Expired", "Near expiry", "Damaged", "Wrong item supplied", "Recalled", "Over-supplied", "Other"];

export function SupplierReturnsPage() {
  const [rows, setRows] = useState<SupplierReturn[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState(0);
  const [drug, setDrug] = useState<Drug | null>(null);
  const [qty, setQty] = useState(1);
  const [cost, setCost] = useState(0);
  const [reason, setReason] = useState(REASONS[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    try {
      const [r, sup] = await Promise.all([api.get<SupplierReturn[]>("/supplier-returns").then((x) => x.data), supplierService.getAll()]);
      setRows(r); setSuppliers(sup);
    } finally { setLoading(false); }
  }

  function openNew() {
    setSupplierId(0); setDrug(null); setQty(1); setCost(0); setReason(REASONS[0]); setNotes(""); setError(""); setOpen(true);
  }

  async function save() {
    if (!supplierId || !drug) { setError("Choose the supplier and the drug."); return; }
    if (qty <= 0 || qty > drug.quantity) { setError(`Quantity must be between 1 and ${drug.quantity} (current stock).`); return; }
    setSaving(true); setError("");
    try {
      await api.post("/supplier-returns", { supplier_id: supplierId, drug_id: drug.id, quantity: qty, unit_cost: cost, reason: notes ? `${reason} — ${notes}` : reason });
      setOpen(false); await load();
    } catch (e) { setError(apiError(e)); }
    finally { setSaving(false); }
  }

  const supName = (r: SupplierReturn) => r.supplier?.name ?? suppliers.find((x) => x.id === r.supplier_id)?.name ?? `#${r.supplier_id}`;
  const filtered = rows.filter((r) => {
    const t = q.trim().toLowerCase();
    return !t || r.return_number.toLowerCase().includes(t) || supName(r).toLowerCase().includes(t) || (r.drug?.brand_name ?? "").toLowerCase().includes(t);
  });

  return (
    <div className={s.page}>
      <div className={s.stats}>
        <div className={s.stat}><div className={s.statLabel}>Returns</div><div className={s.statValue}>{rows.length}</div></div>
        <div className={`${s.stat} ${s.statWarn}`}><div className={s.statLabel}>Units Returned</div><div className={s.statValue}>{rows.reduce((a, r) => a + r.quantity, 0)}</div></div>
        <div className={`${s.stat} ${s.statInfo}`}><div className={s.statLabel}>Value (credit due)</div><div className={s.statValue}>{formatCurrency(rows.reduce((a, r) => a + r.quantity * r.unit_cost, 0))}</div></div>
      </div>
      <div className={s.toolbar}>
        <input className={s.search} placeholder="Search return #, supplier or drug…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className={s.spacer} />
        <Button variant="secondary" onClick={() => exportCsv("supplier-returns.csv", [["Return #", "Date", "Supplier", "Drug", "Qty", "Unit Cost", "Value", "Reason"], ...filtered.map((r) => [r.return_number, r.created_at, supName(r), r.drug?.brand_name ?? r.drug_id, r.quantity, r.unit_cost, (r.quantity * r.unit_cost).toFixed(2), r.reason])])}>Export CSV</Button>
        <Button onClick={openNew}>+ Return to Supplier</Button>
      </div>
      <Table<SupplierReturn>
        columns={[
          { key: "return_number", header: "Return #", render: (r) => <span className={s.strong}>{r.return_number}</span> },
          { key: "created_at", header: "Date", render: (r) => formatDateTime(r.created_at) },
          { key: "supplier", header: "Supplier", render: supName },
          { key: "drug", header: "Drug", render: (r) => r.drug ? <>{r.drug.brand_name} <span className={s.muted}>{r.drug.item_code}</span></> : `#${r.drug_id}` },
          { key: "quantity", header: "Qty" },
          { key: "value", header: "Value", render: (r) => formatCurrency(r.quantity * r.unit_cost) },
          { key: "reason", header: "Reason", render: (r) => <span className={s.muted}>{r.reason || "—"}</span> },
        ]}
        data={filtered}
        rowKey={(r) => r.id}
        emptyMessage={loading ? "Loading…" : "No supplier returns yet."}
      />
      <Modal open={open} onClose={() => setOpen(false)} title="Return Goods to Supplier" size="lg"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>Record Return &amp; Reduce Stock</Button></>}>
        {error && <div className={s.error}>{error}</div>}
        <div className={s.formGrid}>
          <div className={s.field}>
            <span className={s.fieldLabel}>Supplier *</span>
            <select className={s.select} value={supplierId} onChange={(e) => setSupplierId(Number(e.target.value))}>
              <option value={0}>— Select supplier —</option>
              {suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
          <DrugPicker label="Drug *" value={drug?.id ?? 0} onChange={(d) => { setDrug(d); if (d) { if (d.supplier_id) setSupplierId(d.supplier_id); } }} />
          <Input label={`Quantity${drug ? ` (in stock ${drug.quantity})` : ""}`} type="number" min={1} value={qty} onChange={(e) => setQty(parseInt(e.target.value) || 0)} />
          <Input label="Unit Cost (Rs.)" type="number" min={0} step={0.01} value={cost} onChange={(e) => setCost(parseFloat(e.target.value) || 0)} />
          <div className={s.field}>
            <span className={s.fieldLabel}>Reason</span>
            <select className={s.select} value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select>
          </div>
          <Input label="Notes / batch" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className={s.full}><div className={s.total}>Credit value: {formatCurrency(qty * cost)}</div></div>
        </div>
      </Modal>
    </div>
  );
}
