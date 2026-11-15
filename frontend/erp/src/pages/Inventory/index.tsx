import { useEffect, useState } from "react";
import { drugService } from "../../services/drug.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table } from "../../components/ui/Table";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { formatCurrency, formatDate } from "../../utils/formatters";
import type { Drug, DrugCreate, DosageForm } from "../../types";
import { supplierService } from "../../services/supplier.service";
import api from "../../services/api";
import { apiError } from "../../utils/errors";
import { isManager } from "../../utils/roles";
import { useAuthStore } from "../../store/authStore";
import type { Supplier } from "../../types";
import styles from "./Inventory.module.css";

interface PriceChange { id: number; old_price: number; new_price: number; reason: string | null; created_at: string }

const emptyForm: DrugCreate = {
  item_code: "", brand_name: "", generic_name: "",
  dosage_form: "tablet", unit_price: 0, quantity: 0, discount: 0,
  low_stock_threshold: 10, reorder_level: 20, is_otc: true, is_active: true,
  is_prescription_only: false, is_high_alert: false, is_narcotic: false,
};

export function InventoryPage() {
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Drug | null>(null);
  const [form, setForm] = useState<DrugCreate>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [history, setHistory] = useState<PriceChange[]>([]);
  const user = useAuthStore((st) => st.user);
  const manager = isManager(user?.user_type);

  useEffect(() => { supplierService.getAll().then(setSuppliers).catch(() => undefined); }, []);

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

  function openNew() { setEditTarget(null); setForm(emptyForm); setError(""); setHistory([]); setModalOpen(true); }
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
      description: d.description ?? undefined, storage_requirements: d.storage_requirements ?? undefined,
      manufactured_date: d.manufactured_date ?? undefined, pack_size: d.pack_size ?? undefined,
      category_id: d.category_id ?? undefined, supplier_id: d.supplier_id ?? undefined,
      is_active: d.is_active, price_change_reason: "",
    });
    setError(""); setHistory([]);
    api.get<PriceChange[]>(`/drugs/${d.id}/price-history`).then((r) => setHistory(r.data)).catch(() => undefined);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.item_code.trim() || !form.brand_name.trim() || !form.generic_name.trim()) { setError("Item code, brand name and generic name are required."); return; }
    if (form.is_narcotic && !form.is_prescription_only) { setError("Narcotic drugs must also be flagged POM."); return; }
    setSaving(true); setError("");
    try {
      if (editTarget) {
        const updated = await drugService.update(editTarget.id, form);
        setDrugs((prev) => prev.map((d) => d.id === updated.id ? updated : d));
      } else {
        const created = await drugService.create(form);
        setDrugs((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (e) { setError(apiError(e)); }
    finally { setSaving(false); }
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
        {error && <div style={{ background: "var(--color-danger-light)", color: "var(--color-danger)", border: "1px solid var(--color-danger)", padding: "8px 12px", borderRadius: 8, fontWeight: 600, fontSize: 14, marginBottom: 12 }}>{error}</div>}
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
          <Input label={manager || !editTarget ? "Unit Price (Rs.)" : "Unit Price (Rs.) — manager only"} type="number" min={0} step={0.01} disabled={!!editTarget && !manager} value={form.unit_price} onChange={(e) => f("unit_price", parseFloat(e.target.value) || 0)} required />
          <Input label={manager || !editTarget ? "Discount %" : "Discount % — manager only"} type="number" min={0} max={100} step={0.5} disabled={!!editTarget && !manager} value={form.discount ?? 0} onChange={(e) => f("discount", parseFloat(e.target.value) || 0)} />
          {editTarget && manager && form.unit_price !== editTarget.unit_price && (
            <Input label="Reason for price change" value={form.price_change_reason ?? ""} onChange={(e) => f("price_change_reason", e.target.value)} placeholder="e.g. Supplier price increase" />
          )}
          <Input label="Pack Size" type="number" min={1} value={form.pack_size ?? ""} onChange={(e) => f("pack_size", parseInt(e.target.value) || undefined)} placeholder="Units per pack" />
          <Input label="Quantity" type="number" min={0} value={form.quantity} onChange={(e) => f("quantity", parseInt(e.target.value) || 0)} required />
          <Input label="Reorder Level" type="number" min={0} value={form.reorder_level ?? ""} onChange={(e) => f("reorder_level", parseInt(e.target.value) || 0)} />
          <Input label="Low Stock Threshold" type="number" min={0} value={form.low_stock_threshold ?? ""} onChange={(e) => f("low_stock_threshold", parseInt(e.target.value) || 0)} />
          <Input label="Batch Number" value={form.batch_number ?? ""} onChange={(e) => f("batch_number", e.target.value)} />
          <Input label="Manufactured Date" type="date" value={form.manufactured_date ?? ""} onChange={(e) => f("manufactured_date", e.target.value || undefined)} />
          <Input label="Expiry Date" type="date" value={form.expiry_date ?? ""} onChange={(e) => f("expiry_date", e.target.value || undefined)} />
          <div>
            <label style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--color-text-secondary)" }}>Supplier</label>
            <select
              style={{ width: "100%", marginTop: "var(--space-1)", padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-md)", border: "1.5px solid var(--color-border-strong)", fontSize: "var(--font-size-sm)" }}
              value={form.supplier_id ?? 0}
              onChange={(e) => f("supplier_id", Number(e.target.value) || undefined)}
            >
              <option value={0}>— None —</option>
              {suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
          <Input label="Storage Requirements" value={form.storage_requirements ?? ""} onChange={(e) => f("storage_requirements", e.target.value)} placeholder="e.g. Store below 25°C, refrigerate" />
          <div className={styles.fullWidth}>
            <Input label="Item Description" value={form.description ?? ""} onChange={(e) => f("description", e.target.value)} />
          </div>
          <div className={styles.fullWidth}>
            <div className={styles.checkboxRow}>
              {(["is_prescription_only","is_otc","is_high_alert","is_narcotic","is_active"] as const).map((flag) => (
                <label key={flag} className={styles.checkboxLabel}>
                  <input type="checkbox" checked={!!((form as unknown as Record<string, unknown>)[flag])} onChange={(e) => f(flag, e.target.checked)} />
                  {flag.replace("is_","").replace(/_/g," ")}
                </label>
              ))}
            </div>
          </div>
        </div>
        {history.length > 0 && (
          <div style={{ marginTop: "var(--space-4)" }}>
            <div style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>Price History</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ background: "var(--color-surface-raised)" }}><th style={{ textAlign: "left", padding: 6 }}>Date</th><th style={{ textAlign: "right", padding: 6 }}>Old</th><th style={{ textAlign: "right", padding: 6 }}>New</th><th style={{ textAlign: "left", padding: 6 }}>Reason</th></tr></thead>
              <tbody>{history.map((h) => (
                <tr key={h.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 6 }}>{formatDate(h.created_at)}</td>
                  <td style={{ padding: 6, textAlign: "right" }}>{formatCurrency(h.old_price)}</td>
                  <td style={{ padding: 6, textAlign: "right", fontWeight: 700 }}>{formatCurrency(h.new_price)}</td>
                  <td style={{ padding: 6 }}>{h.reason ?? "—"}</td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
