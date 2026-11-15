import { useEffect, useState } from "react";
import { purchaseRequisitionService, type PurchaseRequisition, type RequisitionLine } from "../../services/purchase_requisition.service";
import { drugService } from "../../services/drug.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table } from "../../components/ui/Table";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { DrugPicker } from "../../components/ui/DrugPicker";
import { formatDate } from "../../utils/formatters";
import { apiError, exportCsv } from "../../utils/errors";
import s from "../../styles/erp.module.css";

const emptyLine = (): RequisitionLine => ({ drug_id: 0, quantity_requested: 1, notes: "" });

export function PurchaseRequisitionsPage() {
  const [reqs, setReqs] = useState<PurchaseRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [lines, setLines] = useState<RequisitionLine[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setReqs(await purchaseRequisitionService.getAll()); }
    finally { setLoading(false); }
  }

  function openNew() { setLines([emptyLine()]); setError(""); setModalOpen(true); }

  /** Pre-fill a requisition with every drug at or below its low-stock level. */
  async function fromLowStock() {
    setError("");
    try {
      const low = await drugService.getLowStock();
      if (!low.length) { setError("No drugs are below their low-stock level."); return; }
      setLines(low.map((d) => ({ drug_id: d.id, quantity_requested: Math.max((d.reorder_level || d.low_stock_threshold) * 2 - d.quantity, 1), notes: "Auto: low stock" })));
      setModalOpen(true);
    } catch (e) { setError(apiError(e)); }
  }

  const update = (idx: number, patch: Partial<RequisitionLine>) =>
    setLines((p) => p.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  async function save() {
    if (lines.some((l) => !l.drug_id || l.quantity_requested <= 0)) { setError("Every line needs a drug and a quantity above zero."); return; }
    setSaving(true); setError("");
    try {
      await purchaseRequisitionService.createMany(lines);
      setModalOpen(false);
      await load();
    } catch (e) { setError(apiError(e)); }
    finally { setSaving(false); }
  }

  async function approve(r: PurchaseRequisition) {
    setError("");
    try {
      const u = await purchaseRequisitionService.approve(r.id);
      setReqs((p) => p.map((x) => (x.id === r.id ? { ...x, status: u.status, approved_at: u.approved_at } : x)));
    } catch (e) { setError(apiError(e)); }
  }

  const filtered = reqs.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    const t = q.trim().toLowerCase();
    return !t || r.requisition_number.toLowerCase().includes(t) || (r.drug?.brand_name ?? "").toLowerCase().includes(t);
  });

  const pending = reqs.filter((r) => r.status !== "approved").length;

  return (
    <div className={s.page}>
      <div className={s.stats}>
        <div className={s.stat}><div className={s.statLabel}>Requisitions</div><div className={s.statValue}>{reqs.length}</div></div>
        <div className={`${s.stat} ${s.statWarn}`}><div className={s.statLabel}>Awaiting Approval</div><div className={s.statValue}>{pending}</div></div>
        <div className={s.stat}><div className={s.statLabel}>Approved</div><div className={s.statValue}>{reqs.length - pending}</div></div>
      </div>

      <div className={s.toolbar}>
        <input className={s.search} placeholder="Search number or drug…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={s.select} style={{ width: 170 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
        </select>
        <div className={s.spacer} />
        <Button
          variant="secondary"
          onClick={() => exportCsv("requisitions.csv", [
            ["Number", "Drug", "Qty", "Status", "Created", "Notes"],
            ...filtered.map((r) => [r.requisition_number, r.drug?.brand_name ?? r.drug_id, r.quantity_requested, r.status, r.created_at, r.notes]),
          ])}
        >Export CSV</Button>
        <Button variant="secondary" onClick={fromLowStock}>Auto from Low Stock</Button>
        <Button onClick={openNew}>+ New Requisition</Button>
      </div>
      {error && !modalOpen && <div className={s.error}>{error}</div>}

      <Table<PurchaseRequisition>
        columns={[
          { key: "requisition_number", header: "Number", render: (r) => <span className={s.strong}>{r.requisition_number}</span> },
          { key: "drug", header: "Drug", render: (r) => r.drug ? <>{r.drug.brand_name} <span className={s.muted}>{r.drug.item_code}</span></> : `#${r.drug_id}` },
          { key: "stock", header: "Current Stock", render: (r) => r.drug?.quantity ?? "—" },
          { key: "quantity_requested", header: "Qty Requested" },
          { key: "status", header: "Status", render: (r) => <Badge variant={r.status === "approved" ? "success" : "warning"}>{r.status === "approved" ? "Approved" : "Pending"}</Badge> },
          { key: "created_at", header: "Requested", render: (r) => formatDate(r.created_at) },
          { key: "notes", header: "Notes", render: (r) => <span className={s.muted}>{r.notes || "—"}</span> },
          { key: "actions", header: "", render: (r) => r.status !== "approved" ? <Button size="sm" onClick={() => approve(r)}>Approve</Button> : null },
        ]}
        data={filtered}
        rowKey={(r) => r.id}
        emptyMessage={loading ? "Loading…" : "No requisitions found."}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Purchase Requisition"
        size="lg"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>Submit {lines.length} line(s)</Button></>}
      >
        {error && <div className={s.error}>{error}</div>}
        <div className={s.lines} style={{ marginTop: 0 }}>
          {lines.map((l, idx) => (
            <div key={idx} className={s.line}>
              <DrugPicker label={idx === 0 ? "Drug" : undefined} value={l.drug_id} onChange={(d) => update(idx, { drug_id: d?.id ?? 0 })} />
              <Input label={idx === 0 ? "Qty" : ""} type="number" min={1} value={l.quantity_requested} onChange={(e) => update(idx, { quantity_requested: parseInt(e.target.value) || 0 })} />
              <Input label={idx === 0 ? "Note" : ""} value={l.notes ?? ""} onChange={(e) => update(idx, { notes: e.target.value })} />
              <button className={s.removeBtn} onClick={() => setLines((p) => p.filter((_, i) => i !== idx))} disabled={lines.length === 1}>✕</button>
            </div>
          ))}
          <div><Button variant="secondary" size="sm" onClick={() => setLines((p) => [...p, emptyLine()])}>+ Add Line</Button></div>
        </div>
      </Modal>
    </div>
  );
}
