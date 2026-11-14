import { useEffect, useState } from "react";
import {
  purchaseRequisitionService,
  type PurchaseRequisition,
  type RequisitionCreate,
  type RequisitionItemCreate,
  type RequisitionStatus,
} from "../../services/purchase_requisition.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { Table } from "../../components/ui/Table";
import styles from "./PurchaseRequisitions.module.css";

const today = new Date().toISOString().split("T")[0];

type BadgeVariant = "neutral" | "warning" | "success" | "danger";
const STATUS_BADGE: Record<RequisitionStatus, BadgeVariant> = {
  draft: "neutral",
  submitted: "warning",
  approved: "success",
  rejected: "danger",
  ordered: "success",
};

export function PurchaseRequisitionsPage() {
  const [reqs, setReqs] = useState<PurchaseRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RequisitionStatus | "all">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [detailReq, setDetailReq] = useState<PurchaseRequisition | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<Omit<RequisitionCreate, "items">>({ request_date: today, notes: "" });
  const [items, setItems] = useState<RequisitionItemCreate[]>([{ drug_id: 0, quantity_needed: 1 }]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setReqs(await purchaseRequisitionService.getAll()); }
    finally { setLoading(false); }
  }

  function openNew() {
    setForm({ request_date: today, notes: "" });
    setItems([{ drug_id: 0, quantity_needed: 1 }]);
    setModalOpen(true);
  }

  function addItem() { setItems(prev => [...prev, { drug_id: 0, quantity_needed: 1 }]); }
  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)); }
  function updateItem(idx: number, field: keyof RequisitionItemCreate, value: string | number) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  async function save() {
    setSaving(true);
    try {
      await purchaseRequisitionService.create({ ...form, items });
      setModalOpen(false);
      load();
    } finally { setSaving(false); }
  }

  async function changeStatus(req: PurchaseRequisition, status: RequisitionStatus) {
    await purchaseRequisitionService.updateStatus(req.id, status);
    load();
  }

  const filtered = reqs.filter(r => statusFilter === "all" || r.status === statusFilter);
  const counts: Record<string, number> = { all: reqs.length };
  for (const r of reqs) counts[r.status] = (counts[r.status] || 0) + 1;

  return (
    <div className={styles.page}>
      <div className={styles.statsBar}>
        <div className={styles.statCard}><div className={styles.statValue}>{reqs.length}</div><div className={styles.statLabel}>Total Requisitions</div></div>
        <div className={styles.statCard}><div className={styles.statValue}>{counts.submitted || 0}</div><div className={styles.statLabel}>Pending Approval</div></div>
        <div className={styles.statCard}><div className={styles.statValue}>{counts.approved || 0}</div><div className={styles.statLabel}>Approved</div></div>
        <div className={styles.statCard}><div className={styles.statValue}>{counts.ordered || 0}</div><div className={styles.statLabel}>Ordered</div></div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filterTabs}>
          {(["all", "draft", "submitted", "approved", "rejected", "ordered"] as const).map(s => (
            <button key={s} className={`${styles.filterTab} ${statusFilter === s ? styles.filterTabActive : ""}`} onClick={() => setStatusFilter(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)} {s !== "all" && counts[s] ? `(${counts[s]})` : ""}
            </button>
          ))}
        </div>
        <Button variant="primary" onClick={openNew}>+ New Requisition</Button>
      </div>

      <Table<PurchaseRequisition>
        columns={[
          { key: "req_number", header: "REQ #", render: r => <code style={{ fontSize: "var(--font-size-sm)" }}>{r.req_number}</code> },
          { key: "date", header: "Date", render: r => <span>{r.request_date}</span> },
          { key: "required_by", header: "Required By", render: r => r.required_by_date ? <span>{r.required_by_date}</span> : <span style={{ color: "var(--color-text-muted)" }}>—</span> },
          { key: "status", header: "Status", render: r => <Badge variant={STATUS_BADGE[r.status]}>{r.status}</Badge> },
          { key: "items_count", header: "Items", render: r => <span>{r.items.length}</span> },
          { key: "actions", header: "", render: r => (
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button size="sm" variant="ghost" onClick={() => setDetailReq(r)}>View</Button>
              {r.status === "draft" && <Button size="sm" variant="ghost" onClick={() => changeStatus(r, "submitted")}>Submit</Button>}
              {r.status === "submitted" && <>
                <Button size="sm" variant="ghost" onClick={() => changeStatus(r, "approved")}>Approve</Button>
                <Button size="sm" variant="ghost" onClick={() => changeStatus(r, "rejected")}>Reject</Button>
              </>}
            </div>
          )},
        ]}
        data={filtered}
        rowKey={r => r.id}
        emptyMessage={loading ? "Loading…" : "No requisitions found."}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Purchase Requisition">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <Input label="Request Date *" type="date" value={form.request_date} onChange={e => setForm(f => ({ ...f, request_date: e.target.value }))} />
            <Input label="Required By" type="date" value={form.required_by_date ?? ""} onChange={e => setForm(f => ({ ...f, required_by_date: e.target.value || undefined }))} />
          </div>
          <Input label="Notes" value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Reason for requisition" />

          <div className={styles.itemsSection}>
            <div className={styles.itemsHeader}>
              <span>Drugs Needed</span>
              <Button size="sm" variant="ghost" onClick={addItem}>+ Add Drug</Button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className={styles.itemRow}>
                <Input label="Drug ID" type="number" value={item.drug_id || ""} onChange={e => updateItem(idx, "drug_id", parseInt(e.target.value) || 0)} placeholder="Drug ID" />
                <Input label="Qty Needed" type="number" value={item.quantity_needed} onChange={e => updateItem(idx, "quantity_needed", parseInt(e.target.value) || 1)} />
                <Input label="Notes" value={item.notes ?? ""} onChange={e => updateItem(idx, "notes", e.target.value)} placeholder="Optional" />
                {items.length > 1 && <button className={styles.removeBtn} onClick={() => removeItem(idx)}>✕</button>}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={saving || items.some(i => !i.drug_id)}>{saving ? "Saving…" : "Create Requisition"}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detailReq} onClose={() => setDetailReq(null)} title={`Requisition — ${detailReq?.req_number}`}>
        {detailReq && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)", fontSize: "var(--font-size-sm)" }}>
              <div><span style={{ color: "var(--color-text-muted)" }}>Status:</span> <Badge variant={STATUS_BADGE[detailReq.status]}>{detailReq.status}</Badge></div>
              <div><span style={{ color: "var(--color-text-muted)" }}>Date:</span> {detailReq.request_date}</div>
              {detailReq.required_by_date && <div><span style={{ color: "var(--color-text-muted)" }}>Required by:</span> {detailReq.required_by_date}</div>}
              {detailReq.notes && <div style={{ gridColumn: "span 2" }}><span style={{ color: "var(--color-text-muted)" }}>Notes:</span> {detailReq.notes}</div>}
            </div>
            <table className={styles.detailTable}>
              <thead><tr><th>Drug ID</th><th>Qty Needed</th><th>Notes</th></tr></thead>
              <tbody>
                {detailReq.items.map(it => (
                  <tr key={it.id}><td>#{it.drug_id}</td><td>{it.quantity_needed}</td><td style={{ color: "var(--color-text-muted)" }}>{it.notes || "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
