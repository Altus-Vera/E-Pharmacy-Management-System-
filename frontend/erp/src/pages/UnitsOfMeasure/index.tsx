import { useEffect, useState } from "react";
import { uomService, type UnitOfMeasure, type UomCreate } from "../../services/uom.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { Table } from "../../components/ui/Table";
import styles from "./UnitsOfMeasure.module.css";

const empty: UomCreate = { name: "", abbreviation: "" };

export function UnitsOfMeasurePage() {
  const [uoms, setUoms] = useState<UnitOfMeasure[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UnitOfMeasure | null>(null);
  const [form, setForm] = useState<UomCreate>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setUoms(await uomService.getAll()); }
    finally { setLoading(false); }
  }

  function openNew() { setEditTarget(null); setForm(empty); setModalOpen(true); }
  function openEdit(u: UnitOfMeasure) {
    setEditTarget(u);
    setForm({ name: u.name, abbreviation: u.abbreviation });
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editTarget) { await uomService.update(editTarget.id, form); }
      else { await uomService.create(form); }
      setModalOpen(false);
      load();
    } finally { setSaving(false); }
  }

  async function toggleActive(u: UnitOfMeasure) {
    await uomService.update(u.id, { is_active: !u.is_active });
    load();
  }

  const active = uoms.filter(u => u.is_active).length;

  return (
    <div className={styles.page}>
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{uoms.length}</div>
          <div className={styles.statLabel}>Total Units</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{active}</div>
          <div className={styles.statLabel}>Active</div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
          Units of measure used across drug catalog (mg, ml, tablets, etc.)
        </span>
        <Button variant="primary" onClick={openNew}>+ Add Unit</Button>
      </div>

      <Table<UnitOfMeasure>
        columns={[
          { key: "name", header: "Name", render: u => <strong>{u.name}</strong> },
          { key: "abbr", header: "Abbreviation", render: u => <code style={{ background: "var(--color-bg)", padding: "2px 6px", borderRadius: "4px", fontSize: "var(--font-size-sm)" }}>{u.abbreviation}</code> },
          { key: "status", header: "Status", render: u => <Badge variant={u.is_active ? "success" : "neutral"}>{u.is_active ? "Active" : "Inactive"}</Badge> },
          { key: "actions", header: "", render: u => (
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => toggleActive(u)}>{u.is_active ? "Deactivate" : "Activate"}</Button>
            </div>
          )},
        ]}
        data={uoms}
        rowKey={u => u.id}
        emptyMessage={loading ? "Loading…" : "No units found."}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? "Edit Unit of Measure" : "New Unit of Measure"}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Input label="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Milligram, Milliliter, Tablet" />
          <Input label="Abbreviation *" value={form.abbreviation} onChange={e => setForm(f => ({ ...f, abbreviation: e.target.value }))} placeholder="e.g. mg, ml, tab" />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={!form.name || !form.abbreviation || saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
