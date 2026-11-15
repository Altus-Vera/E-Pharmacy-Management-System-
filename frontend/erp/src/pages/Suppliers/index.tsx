import { useEffect, useMemo, useState } from "react";
import { supplierService } from "../../services/supplier.service";
import { purchaseOrderService } from "../../services/purchaseOrder.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table } from "../../components/ui/Table";
import { Modal } from "../../components/ui/Modal";
import { apiError, exportCsv } from "../../utils/errors";
import { formatDate } from "../../utils/formatters";
import type { PurchaseOrder, Supplier, SupplierCreate } from "../../types";
import s from "../../styles/erp.module.css";

const emptyForm: SupplierCreate = { name: "", contact_number: "", address: "", special_remarks: "" };
const OPEN = ["draft", "submitted", "partially_received"];

export function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierCreate>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [sup, po] = await Promise.all([
        supplierService.getAll(),
        purchaseOrderService.getAll().catch(() => [] as PurchaseOrder[]),
      ]);
      setSuppliers(sup);
      setOrders(po);
    } finally { setLoading(false); }
  }

  function openNew() { setEditTarget(null); setForm(emptyForm); setError(""); setModalOpen(true); }
  function openEdit(x: Supplier) {
    setEditTarget(x); setError("");
    setForm({ name: x.name, contact_number: x.contact_number ?? "", address: x.address ?? "", special_remarks: x.special_remarks ?? "" });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Supplier name is required."); return; }
    setSaving(true); setError("");
    try {
      if (editTarget) {
        const u = await supplierService.update(editTarget.id, form);
        setSuppliers((p) => p.map((x) => (x.id === u.id ? u : x)));
      } else {
        const c = await supplierService.create(form);
        setSuppliers((p) => [c, ...p]);
      }
      setModalOpen(false);
    } catch (e) { setError(apiError(e)); }
    finally { setSaving(false); }
  }

  const stats = useMemo(() => {
    const m = new Map<number, { count: number; open: number; last: string | null }>();
    for (const o of orders) {
      const r = m.get(o.supplier_id) ?? { count: 0, open: 0, last: null };
      r.count++;
      if (OPEN.includes(o.status)) r.open++;
      if (!r.last || o.created_at > r.last) r.last = o.created_at;
      m.set(o.supplier_id, r);
    }
    return m;
  }, [orders]);

  const filtered = suppliers.filter((x) => {
    const t = q.trim().toLowerCase();
    return !t || x.name.toLowerCase().includes(t) || (x.contact_number ?? "").includes(t) || (x.address ?? "").toLowerCase().includes(t);
  });

  const f = (k: keyof SupplierCreate, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className={s.page}>
      <div className={s.stats}>
        <div className={s.stat}><div className={s.statLabel}>Suppliers</div><div className={s.statValue}>{suppliers.length}</div></div>
        <div className={`${s.stat} ${s.statInfo}`}><div className={s.statLabel}>Purchase Orders</div><div className={s.statValue}>{orders.length}</div></div>
        <div className={`${s.stat} ${s.statWarn}`}><div className={s.statLabel}>Open Orders</div><div className={s.statValue}>{orders.filter((o) => OPEN.includes(o.status)).length}</div></div>
      </div>

      <div className={s.toolbar}>
        <input className={s.search} placeholder="Search name, phone or address…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className={s.spacer} />
        <Button
          variant="secondary"
          onClick={() => exportCsv("suppliers.csv", [
            ["Name", "Contact", "Address", "Remarks", "Orders"],
            ...filtered.map((x) => [x.name, x.contact_number, x.address, x.special_remarks, stats.get(x.id)?.count ?? 0]),
          ])}
        >Export CSV</Button>
        <Button onClick={openNew}>+ New Supplier</Button>
      </div>

      <Table<Supplier>
        columns={[
          { key: "name", header: "Name", render: (r) => <span className={s.strong}>{r.name}</span> },
          { key: "contact_number", header: "Contact", render: (r) => r.contact_number || "—" },
          { key: "address", header: "Address", render: (r) => r.address || "—" },
          { key: "orders", header: "Orders", render: (r) => { const x = stats.get(r.id); return x ? `${x.count} (${x.open} open)` : "0"; } },
          { key: "last", header: "Last Order", render: (r) => { const x = stats.get(r.id); return x?.last ? formatDate(x.last) : "—"; } },
          { key: "special_remarks", header: "Remarks", render: (r) => <span className={s.muted}>{r.special_remarks || "—"}</span> },
          { key: "actions", header: "", render: (r) => <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>Edit</Button> },
        ]}
        data={filtered}
        rowKey={(r) => r.id}
        emptyMessage={loading ? "Loading…" : "No suppliers found."}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? "Edit Supplier" : "New Supplier"}
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleSave}>Save</Button></>}
      >
        {error && <div className={s.error}>{error}</div>}
        <div className={s.formGrid}>
          <div className={s.full}><Input label="Supplier Name *" value={form.name} onChange={(e) => f("name", e.target.value)} /></div>
          <Input label="Contact Number" value={form.contact_number ?? ""} onChange={(e) => f("contact_number", e.target.value)} />
          <Input label="Address" value={form.address ?? ""} onChange={(e) => f("address", e.target.value)} />
          <div className={s.full}><Input label="Remarks (credit terms, rep name…)" value={form.special_remarks ?? ""} onChange={(e) => f("special_remarks", e.target.value)} /></div>
        </div>
      </Modal>
    </div>
  );
}
