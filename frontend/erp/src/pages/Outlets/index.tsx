import { useEffect, useState } from "react";
import { outletService, type Outlet, type OutletCreate } from "../../services/outlet.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { Table, type Column } from "../../components/ui/Table";
import styles from "./Outlets.module.css";

const emptyForm: OutletCreate = { name: "", code: "", address: "", contact_number: "", manager_name: "", is_head_office: false };

export function OutletsPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("active");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Outlet | null>(null);
  const [form, setForm] = useState<OutletCreate>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setOutlets(await outletService.getAll()); }
    finally { setLoading(false); }
  }

  function openNew() { setEditTarget(null); setForm(emptyForm); setModalOpen(true); }
  function openEdit(o: Outlet) {
    setEditTarget(o);
    setForm({ name: o.name, code: o.code, address: o.address ?? "", contact_number: o.contact_number ?? "", manager_name: o.manager_name ?? "", is_head_office: o.is_head_office });
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editTarget) { await outletService.update(editTarget.id, form); }
      else { await outletService.create(form); }
      setModalOpen(false);
      load();
    } finally { setSaving(false); }
  }

  async function toggleActive(o: Outlet) {
    await outletService.update(o.id, { is_active: !o.is_active });
    load();
  }

  const filtered = outlets.filter(o =>
    filter === "all" ? true : filter === "active" ? o.is_active : !o.is_active
  );
  const active = outlets.filter(o => o.is_active).length;
  const headOffice = outlets.find(o => o.is_head_office);

  const columns: Column<Outlet>[] = [
    {
      key: "name", header: "Outlet Name",
      render: o => (
        <div>
          <strong>{o.name}</strong>
          {o.is_head_office && <span className={styles.hoBadge}> ★ Head Office</span>}
        </div>
      ),
    },
    { key: "code", header: "Code", render: o => <code style={{ fontSize: "var(--font-size-sm)" }}>{o.code}</code> },
    { key: "manager", header: "Manager", render: o => o.manager_name || <span style={{ color: "var(--color-text-muted)" }}>—</span> },
    { key: "contact", header: "Contact", render: o => o.contact_number || <span style={{ color: "var(--color-text-muted)" }}>—</span> },
    { key: "status", header: "Status", render: o => <Badge variant={o.is_active ? "success" : "neutral"}>{o.is_active ? "Active" : "Inactive"}</Badge> },
    {
      key: "actions", header: "",
      render: o => (
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Button size="sm" variant="ghost" onClick={() => openEdit(o)}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => toggleActive(o)}>{o.is_active ? "Deactivate" : "Activate"}</Button>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{outlets.length}</div>
          <div className={styles.statLabel}>Total Outlets</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{active}</div>
          <div className={styles.statLabel}>Active</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{headOffice?.name ?? "—"}</div>
          <div className={styles.statLabel}>Head Office</div>
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
        <Button variant="primary" onClick={openNew}>+ Add Outlet</Button>
      </div>

      <Table<Outlet>
        columns={columns}
        data={filtered}
        rowKey={o => o.id}
        emptyMessage={loading ? "Loading…" : "No outlets found."}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? "Edit Outlet" : "New Outlet"}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Input label="Outlet Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Main Branch" />
          <Input label="Code *" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. BR01" disabled={!!editTarget} />
          <Input label="Manager Name" value={form.manager_name ?? ""} onChange={e => setForm(f => ({ ...f, manager_name: e.target.value }))} placeholder="Manager full name" />
          <Input label="Contact Number" value={form.contact_number ?? ""} onChange={e => setForm(f => ({ ...f, contact_number: e.target.value }))} placeholder="+94 77 xxx xxxx" />
          <Input label="Address" value={form.address ?? ""} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Branch address" />
          <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer", fontSize: "var(--font-size-sm)" }}>
            <input type="checkbox" checked={form.is_head_office ?? false} onChange={e => setForm(f => ({ ...f, is_head_office: e.target.checked }))} />
            Mark as Head Office
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={!form.name || !form.code || saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
