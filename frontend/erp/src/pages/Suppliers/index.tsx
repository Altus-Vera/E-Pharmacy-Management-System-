import { useEffect, useState } from "react";
import { supplierService } from "../../services/supplier.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table } from "../../components/ui/Table";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import type { Supplier, SupplierCreate } from "../../types";
import styles from "./Suppliers.module.css";

const emptyForm: SupplierCreate = { name: "", contact_person: "", phone: "", email: "", address: "" };

export function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierCreate>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setSuppliers(await supplierService.getAll()); }
    finally { setLoading(false); }
  }

  function openNew() { setEditTarget(null); setForm(emptyForm); setModalOpen(true); }
  function openEdit(s: Supplier) {
    setEditTarget(s);
    setForm({ name: s.name, contact_person: s.contact_person ?? "", phone: s.phone ?? "", email: s.email ?? "", address: s.address ?? "" });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await supplierService.update(editTarget.id, form);
        setSuppliers((prev) => prev.map((s) => s.id === updated.id ? updated : s));
      } else {
        const created = await supplierService.create(form);
        setSuppliers((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } finally { setSaving(false); }
  }

  const f = (field: keyof SupplierCreate, v: string) => setForm((p) => ({ ...p, [field]: v }));

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <Button onClick={openNew}>+ New Supplier</Button>
      </div>

      <Table<Supplier>
        columns={[
          { key: "name", header: "Name" },
          { key: "contact_person", header: "Contact Person", render: (r) => r.contact_person ?? "—" },
          { key: "phone", header: "Phone", render: (r) => r.phone ?? "—" },
          { key: "email", header: "Email", render: (r) => r.email ?? "—" },
          { key: "is_active", header: "Status", render: (r) => <Badge variant={r.is_active ? "success" : "neutral"}>{r.is_active ? "Active" : "Inactive"}</Badge> },
          { key: "actions", header: "", render: (r) => <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>Edit</Button> },
        ]}
        data={suppliers}
        rowKey={(r) => r.id}
        emptyMessage={loading ? "Loading…" : "No suppliers found."}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? "Edit Supplier" : "New Supplier"}
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button loading={saving} onClick={handleSave}>Save</Button>
        </>}
      >
        <div className={styles.formGrid}>
          <div className={styles.fullWidth}>
            <Input label="Supplier Name" value={form.name} onChange={(e) => f("name", e.target.value)} required />
          </div>
          <Input label="Contact Person" value={form.contact_person ?? ""} onChange={(e) => f("contact_person", e.target.value)} />
          <Input label="Phone" value={form.phone ?? ""} onChange={(e) => f("phone", e.target.value)} />
          <Input label="Email" type="email" value={form.email ?? ""} onChange={(e) => f("email", e.target.value)} />
          <Input label="Address" value={form.address ?? ""} onChange={(e) => f("address", e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
