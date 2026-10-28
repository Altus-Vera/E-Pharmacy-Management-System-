import { useEffect, useState } from "react";
import { drugService } from "../../services/drug.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table } from "../../components/ui/Table";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { formatCurrency, formatDate } from "../../utils/formatters";
import type { Drug, DrugCreate, DosageForm } from "../../types";
import styles from "./Inventory.module.css";

const emptyForm: DrugCreate = {
  item_code: "", brand_name: "", generic_name: "",
  dosage_form: "tablet", unit_price: 0, quantity: 0,
};

export function InventoryPage() {
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Drug | null>(null);
  const [form, setForm] = useState<DrugCreate>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try { setDrugs(await drugService.getAll()); }
    finally { setLoading(false); }
  }

  async function search(q: string) {
    setQuery(q);
    if (q.length < 2) { loadAll(); return; }
    try { setDrugs(await drugService.search(q)); }
    catch { setDrugs([]); }
  }

  function openNew() { setEditTarget(null); setForm(emptyForm); setModalOpen(true); }
  function openEdit(d: Drug) {
    setEditTarget(d);
    setForm({
      item_code: d.item_code, brand_name: d.brand_name, generic_name: d.generic_name,
      active_ingredient: d.active_ingredient ?? undefined,
      strength: d.strength ?? undefined, dosage_form: d.dosage_form,
      unit_price: d.unit_price, discount: d.discount, quantity: d.quantity,
      expiry_date: d.expiry_date ?? undefined, batch_number: d.batch_number ?? undefined,
      is_prescription_only: d.is_prescription_only, is_otc: d.is_otc,
      is_high_alert: d.is_high_alert, is_narcotic: d.is_narcotic,
      reorder_level: d.reorder_level, low_stock_threshold: d.low_stock_threshold,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await drugService.update(editTarget.id, form);
        setDrugs((prev) => prev.map((d) => d.id === updated.id ? updated : d));
      } else {
        const created = await drugService.create(form);
        setDrugs((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } finally { setSaving(false); }
  }

  const f = (field: keyof DrugCreate, value: unknown) => setForm((p) => ({ ...p, [field]: value }));

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.searchInput}>
            <Input placeholder="Search by name, code…" value={query} onChange={(e) => search(e.target.value)} label="Search" />
          </div>
        </div>
        <Button onClick={openNew}>+ New Drug</Button>
      </div>

      <Table<Drug>
        columns={[
          { key: "item_code", header: "Code" },
          { key: "brand_name", header: "Brand Name" },
          { key: "generic_name", header: "Generic Name" },
          { key: "dosage_form", header: "Form" },
          { key: "quantity", header: "Stock", render: (r) => (
            <span style={{ color: r.quantity <= r.reorder_level ? "var(--color-danger)" : undefined, fontWeight: "var(--font-weight-semibold)" }}>
              {r.quantity}
            </span>
          )},
          { key: "unit_price", header: "Price", render: (r) => formatCurrency(r.unit_price) },
          { key: "expiry_date", header: "Expiry", render: (r) => r.expiry_date ? formatDate(r.expiry_date) : "—" },
          { key: "flags", header: "Flags", render: (r) => (
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {r.is_prescription_only && <Badge variant="warning">Rx</Badge>}
              {r.is_high_alert && <Badge variant="danger">High Alert</Badge>}
              {r.is_narcotic && <Badge variant="danger">Narcotic</Badge>}
              {r.is_otc && <Badge variant="info">OTC</Badge>}
            </div>
          )},
          { key: "is_active", header: "Status", render: (r) => <Badge variant={r.is_active ? "success" : "neutral"}>{r.is_active ? "Active" : "Inactive"}</Badge> },
          { key: "actions", header: "", render: (r) => <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>Edit</Button> },
        ]}
        data={drugs}
        rowKey={(r) => r.id}
        emptyMessage={loading ? "Loading…" : "No drugs found."}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? "Edit Drug" : "New Drug"}
        size="lg"
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button loading={saving} onClick={handleSave}>Save</Button>
        </>}
      >
        <div className={styles.formGrid}>
          <Input label="Item Code" value={form.item_code} onChange={(e) => f("item_code", e.target.value)} required />
          <div>
            <label style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-medium)", color: "var(--color-text-secondary)" }}>Dosage Form</label>
            <select
              style={{ width: "100%", marginTop: "var(--space-1)", padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "var(--font-size-sm)" }}
              value={form.dosage_form}
              onChange={(e) => f("dosage_form", e.target.value as DosageForm)}
            >
              {["tablet","capsule","syrup","vial","other"].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <Input label="Brand Name" value={form.brand_name} onChange={(e) => f("brand_name", e.target.value)} required />
          <Input label="Generic Name" value={form.generic_name} onChange={(e) => f("generic_name", e.target.value)} required />
          <Input label="Active Ingredient" value={form.active_ingredient ?? ""} onChange={(e) => f("active_ingredient", e.target.value)} />
          <Input label="Strength" value={form.strength ?? ""} onChange={(e) => f("strength", e.target.value)} placeholder="e.g. 500mg" />
          <Input label="Unit Price (Rs.)" type="number" min={0} step={0.01} value={form.unit_price} onChange={(e) => f("unit_price", parseFloat(e.target.value) || 0)} required />
          <Input label="Quantity" type="number" min={0} value={form.quantity} onChange={(e) => f("quantity", parseInt(e.target.value) || 0)} required />
          <Input label="Reorder Level" type="number" min={0} value={form.reorder_level ?? ""} onChange={(e) => f("reorder_level", parseInt(e.target.value) || 0)} />
          <Input label="Low Stock Threshold" type="number" min={0} value={form.low_stock_threshold ?? ""} onChange={(e) => f("low_stock_threshold", parseInt(e.target.value) || 0)} />
          <Input label="Batch Number" value={form.batch_number ?? ""} onChange={(e) => f("batch_number", e.target.value)} />
          <Input label="Expiry Date" type="date" value={form.expiry_date ?? ""} onChange={(e) => f("expiry_date", e.target.value)} />
          <div className={styles.fullWidth}>
            <div className={styles.checkboxRow}>
              {(["is_prescription_only","is_otc","is_high_alert","is_narcotic"] as const).map((flag) => (
                <label key={flag} className={styles.checkboxLabel}>
                  <input type="checkbox" checked={!!((form as unknown as Record<string, unknown>)[flag])} onChange={(e) => f(flag, e.target.checked)} />
                  {flag.replace("is_","").replace(/_/g," ")}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
