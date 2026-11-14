import { useEffect, useState } from "react";
import { stockLocationService, type StockLocation, type StockLocationCreate } from "../../services/stock_location.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { Table } from "../../components/ui/Table";
import styles from "./StockLocations.module.css";

const empty: StockLocationCreate = { name: "", description: "" };

export function StockLocationsPage() {
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("active");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StockLocation | null>(null);
  const [form, setForm] = useState<StockLocationCreate>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setLocations(await stockLocationService.getAll()); }
    finally { setLoading(false); }
  }

  function openNew() { setEditTarget(null); setForm(empty); setModalOpen(true); }
  function openEdit(loc: StockLocation) {
    setEditTarget(loc);
    setForm({ name: loc.name, description: loc.description ?? "" });
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editTarget) { await stockLocationService.update(editTarget.id, form); }
      else { await stockLocationService.create(form); }
      setModalOpen(false);
      load();
    } finally { setSaving(false); }
  }

  async function toggleActive(loc: StockLocation) {
    await stockLocationService.update(loc.id, { is_active: !loc.is_active });
    load();
  }

  const filtered = locations.filter(l =>
    filter === "all" ? true : filter === "active" ? l.is_active : !l.is_active
  );
  const active = locations.filter(l => l.is_active).length;

  return (
    <div className={styles.page}>
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{locations.length}</div>
          <div className={styles.statLabel}>Total Locations</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{active}</div>
          <div className={styles.statLabel}>Active</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{locations.length - active}</div>
          <div className={styles.statLabel}>Inactive</div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filterTabs}>
          {(["all", "active", "inactive"] as const).map(f => (
            <button key={f} className={`${styles.filterTab} ${filter === f ? styles.filterTabActive : ""}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <Button variant="primary" onClick={openNew}>+ Add Location</Button>
      </div>

      <Table<StockLocation>
        columns={[
          { key: "name", header: "Name", render: l => <strong>{l.name}</strong> },
          { key: "description", header: "Description", render: l => l.description || <span style={{ color: "var(--color-text-muted)" }}>—</span> },
          { key: "status", header: "Status", render: l => <Badge variant={l.is_active ? "success" : "neutral"}>{l.is_active ? "Active" : "Inactive"}</Badge> },
          { key: "actions", header: "", render: l => (
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button size="sm" variant="ghost" onClick={() => openEdit(l)}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => toggleActive(l)}>{l.is_active ? "Deactivate" : "Activate"}</Button>
            </div>
          )},
        ]}
        data={filtered}
        rowKey={l => l.id}
        emptyMessage={loading ? "Loading…" : "No locations found."}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? "Edit Location" : "New Stock Location"}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Input label="Location Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Cold Storage, Store Room" />
          <Input label="Description" value={form.description ?? ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={!form.name || saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
