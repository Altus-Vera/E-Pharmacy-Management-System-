import { useEffect, useState } from "react";
import { transferService, outletService, type StockTransfer, type TransferCreate, type TransferStatus, type Outlet } from "../../services/outlet.service";
import { drugService } from "../../services/drug.service";
import type { Drug } from "../../types";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { Table, type Column } from "../../components/ui/Table";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "primary";
import styles from "./StockTransfers.module.css";

type FilterStatus = "all" | TransferStatus;

const STATUS_BADGE: Record<TransferStatus, BadgeVariant> = {
  pending: "neutral",
  approved: "info",
  in_transit: "warning",
  received: "success",
  cancelled: "danger",
};

const STATUS_LABEL: Record<TransferStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  in_transit: "In Transit",
  received: "Received",
  cancelled: "Cancelled",
};

const NEXT_STATUS: Record<TransferStatus, TransferStatus | null> = {
  pending: "approved",
  approved: "in_transit",
  in_transit: "received",
  received: null,
  cancelled: null,
};

const emptyForm: TransferCreate = { from_outlet_id: 0, to_outlet_id: 0, drug_id: 0, quantity: 1, notes: "" };

export function StockTransfersPage() {
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<TransferCreate>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [t, o, d] = await Promise.all([
        transferService.getAll(),
        outletService.getAll(),
        drugService.getAll(),
      ]);
      setTransfers(t);
      setOutlets(o.filter(x => x.is_active));
      setDrugs(d);
    } finally { setLoading(false); }
  }

  async function advance(t: StockTransfer) {
    const next = NEXT_STATUS[t.status];
    if (!next) return;
    await transferService.updateStatus(t.id, next);
    load();
  }

  async function cancel(t: StockTransfer) {
    await transferService.updateStatus(t.id, "cancelled");
    load();
  }

  async function create() {
    setSaving(true);
    try {
      await transferService.create(form);
      setModalOpen(false);
      setForm(emptyForm);
      load();
    } finally { setSaving(false); }
  }

  const filtered = filter === "all" ? transfers : transfers.filter(t => t.status === filter);
  const counts = transfers.reduce((acc, t) => { acc[t.status] = (acc[t.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  const columns: Column<StockTransfer>[] = [
    { key: "ref", header: "Ref #", render: t => <code style={{ fontSize: "var(--font-size-sm)" }}>{t.transfer_number}</code> },
    { key: "from", header: "From", render: t => t.from_outlet_name ?? `Outlet #${t.from_outlet_id}` },
    { key: "to", header: "To", render: t => t.to_outlet_name ?? `Outlet #${t.to_outlet_id}` },
    { key: "drug", header: "Drug", render: t => t.drug_name ?? `Drug #${t.drug_id}` },
    { key: "qty", header: "Qty", render: t => <strong>{t.quantity}</strong> },
    { key: "status", header: "Status", render: t => <Badge variant={STATUS_BADGE[t.status]}>{STATUS_LABEL[t.status]}</Badge> },
    { key: "date", header: "Date", render: t => new Date(t.created_at).toLocaleDateString() },
    {
      key: "actions", header: "",
      render: t => (
        <div className={styles.statusActions}>
          {NEXT_STATUS[t.status] && (
            <Button size="sm" variant="primary" onClick={() => advance(t)}>
              → {STATUS_LABEL[NEXT_STATUS[t.status]!]}
            </Button>
          )}
          {t.status === "pending" || t.status === "approved" ? (
            <Button size="sm" variant="ghost" onClick={() => cancel(t)}>Cancel</Button>
          ) : null}
        </div>
      ),
    },
  ];

  const filterTabs: { key: FilterStatus; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "in_transit", label: "In Transit" },
    { key: "received", label: "Received" },
    { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{transfers.length}</div>
          <div className={styles.statLabel}>Total Transfers</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{counts["pending"] ?? 0}</div>
          <div className={styles.statLabel}>Pending</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{counts["in_transit"] ?? 0}</div>
          <div className={styles.statLabel}>In Transit</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{counts["received"] ?? 0}</div>
          <div className={styles.statLabel}>Received</div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filterTabs}>
          {filterTabs.map(f => (
            <button key={f.key} className={`${styles.filterTab} ${filter === f.key ? styles.filterTabActive : ""}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <Button variant="primary" onClick={() => { setForm(emptyForm); setModalOpen(true); }}>+ New Transfer</Button>
      </div>

      <Table<StockTransfer>
        columns={columns}
        data={filtered}
        rowKey={t => t.id}
        emptyMessage={loading ? "Loading…" : "No transfers found."}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Stock Transfer">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label className={styles.formLabel}>From Outlet *</label>
              <select className={styles.formSelect} value={form.from_outlet_id || ""} onChange={e => setForm(f => ({ ...f, from_outlet_id: Number(e.target.value) }))}>
                <option value="">Select outlet…</option>
                {outlets.map(o => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
              </select>
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>To Outlet *</label>
              <select className={styles.formSelect} value={form.to_outlet_id || ""} onChange={e => setForm(f => ({ ...f, to_outlet_id: Number(e.target.value) }))}>
                <option value="">Select outlet…</option>
                {outlets.filter(o => o.id !== form.from_outlet_id).map(o => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
              </select>
            </div>
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Drug *</label>
            <select className={styles.formSelect} value={form.drug_id || ""} onChange={e => setForm(f => ({ ...f, drug_id: Number(e.target.value) }))}>
              <option value="">Select drug…</option>
              {drugs.map(d => <option key={d.id} value={d.id}>{d.brand_name} (Stock: {d.quantity})</option>)}
            </select>
          </div>
          <Input
            label="Quantity *"
            type="number"
            value={String(form.quantity)}
            onChange={e => setForm(f => ({ ...f, quantity: Math.max(1, Number(e.target.value)) }))}
            placeholder="1"
          />
          <Input
            label="Notes"
            value={form.notes ?? ""}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Optional notes for this transfer"
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={create}
              disabled={!form.from_outlet_id || !form.to_outlet_id || !form.drug_id || form.quantity < 1 || saving}
            >
              {saving ? "Creating…" : "Create Transfer"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
