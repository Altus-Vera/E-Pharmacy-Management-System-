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

interface Batch {
  id: number; batch_number: string | null; expiry_date: string | null; quantity_received: number; quantity_remaining: number;
  unit_cost: number | null; selling_price: number; pack_selling_price: number | null; received_at: string; source: string; is_expired: boolean;
}
interface FreqCode { id: number; code: string; description: string; times_per_day: number | null; is_active: boolean }
const SELL_MODES = [
  { v: "loose", label: "Loose — any number of units" },
  { v: "strip", label: "Strip only — whole strips/cards" },
  { v: "pack", label: "Pack only — whole packs/bottles/tubes" },
] as const;
const REASONS = ["Sealed bottle", "Tube / inhaler / drops", "Cold chain — keep refrigerated", "Full course must be supplied", "Regulatory control", "Moisture / light sensitive blister"];
const DEFAULT_UNIT: Record<string, string> = { tablet: "tablet", capsule: "capsule", syrup: "bottle", vial: "vial", other: "unit" };

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
  const [batches, setBatches] = useState<Batch[]>([]);
  const [freqs, setFreqs] = useState<FreqCode[]>([]);
  const [packPrice, setPackPrice] = useState<Record<number, string>>({});
  const [batchPrice, setBatchPrice] = useState<Record<number, string>>({});
  const [batchMsg, setBatchMsg] = useState("");
  const user = useAuthStore((st) => st.user);
  const manager = isManager(user?.user_type);

  useEffect(() => { supplierService.getAll().then(setSuppliers).catch(() => undefined); }, []);
  useEffect(() => { api.get<FreqCode[]>("/frequency-codes").then((r) => setFreqs(r.data)).catch(() => undefined); }, []);

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
      base_unit: d.base_unit ?? DEFAULT_UNIT[d.dosage_form] ?? "unit", sell_mode: d.sell_mode ?? "loose",
      units_per_strip: d.units_per_strip ?? null, non_loose_reason: d.non_loose_reason ?? "", min_loose_qty: d.min_loose_qty ?? null,
      dose_unit: d.dose_unit ?? "", content_per_unit: d.content_per_unit ?? null, default_dose: d.default_dose ?? null,
      default_frequency: d.default_frequency ?? "", max_days: d.max_days ?? null, min_days: d.min_days ?? null,
    });
    setError(""); setHistory([]); setBatches([]); setBatchPrice({}); setBatchMsg("");
    loadBatches(d.id);
    api.get<PriceChange[]>(`/drugs/${d.id}/price-history`).then((r) => setHistory(r.data)).catch(() => undefined);
    setModalOpen(true);
  }

  function loadBatches(id: number) {
    api.get<Batch[]>(`/drugs/${id}/batches`).then((r) => setBatches(r.data)).catch(() => undefined);
  }

  /** Manager: change the selling price of one batch (older and newer stock can be priced differently). */
  async function saveBatchPrice(b: Batch) {
    const v = parseFloat(batchPrice[b.id]);
    if (!Number.isFinite(v) || v < 0) { setBatchMsg("Enter a valid price."); return; }
    try {
      await api.patch(`/drug-batches/${b.id}`, { selling_price: v, reason: "Batch price revision" });
      setBatchMsg(`Batch ${b.batch_number ?? b.id} now sells at ${formatCurrency(v)}.`);
      setBatchPrice((p) => { const n = { ...p }; delete n[b.id]; return n; });
      if (editTarget) {
        loadBatches(editTarget.id);
        api.get<PriceChange[]>(`/drugs/${editTarget.id}/price-history`).then((r) => setHistory(r.data)).catch(() => undefined);
        const fresh = await drugService.getById(editTarget.id).catch(() => null);
        if (fresh) { setDrugs((prev) => prev.map((d) => d.id === fresh.id ? fresh : d)); setForm((f) => ({ ...f, unit_price: fresh.unit_price })); }
      }
    } catch (e) { setBatchMsg(apiError(e)); }
  }

  async function saveBatchPackPrice(b: Batch) {
    const v = parseFloat(packPrice[b.id]);
    if (!Number.isFinite(v) || v < 0) { setBatchMsg("Enter a valid pack price (0 = units × unit price)."); return; }
    try {
      await api.patch(`/drug-batches/${b.id}`, { pack_selling_price: v });
      setBatchMsg(v > 0 ? `Pack price for batch ${b.batch_number ?? b.id} set to ${formatCurrency(v)}.` : "Pack price cleared — packs sell at units × unit price.");
      setPackPrice((p) => { const n = { ...p }; delete n[b.id]; return n; });
      if (editTarget) loadBatches(editTarget.id);
    } catch (e) { setBatchMsg(apiError(e)); }
  }

  async function handleSave() {
    if (!form.item_code.trim() || !form.brand_name.trim() || !form.generic_name.trim()) { setError("Item code, brand name and generic name are required."); return; }
    if (form.is_narcotic && !form.is_prescription_only) { setError("Narcotic drugs must also be flagged POM."); return; }
    if (form.sell_mode === "strip" && !form.units_per_strip) { setError("Set units per strip for a strip-only drug."); return; }
    if (form.sell_mode !== "loose" && !form.non_loose_reason?.trim()) { setError("Give the reason it cannot be sold loose — the cashier shows it to the customer."); return; }
    // empty optional fields are sent as 0 / "" so the server clears them (null means "unchanged")
    const payload: DrugCreate = {
      ...form,
      units_per_strip: form.units_per_strip ?? 0, min_loose_qty: form.min_loose_qty ?? 0, content_per_unit: form.content_per_unit ?? 0,
      default_dose: form.default_dose ?? 0, max_days: form.max_days ?? 0, min_days: form.min_days ?? 0,
      non_loose_reason: form.non_loose_reason ?? "", dose_unit: form.dose_unit ?? "", default_frequency: form.default_frequency ?? "",
      base_unit: form.base_unit || DEFAULT_UNIT[form.dosage_form] || "unit", sell_mode: form.sell_mode ?? "loose",
    };
    setSaving(true); setError("");
    try {
      if (editTarget) {
        const updated = await drugService.update(editTarget.id, payload);
        setDrugs((prev) => prev.map((d) => d.id === updated.id ? updated : d));
      } else {
        const created = await drugService.create(payload);
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
        <div className={styles.sellBox}>
          <div className={styles.sellTitle}>Selling &amp; dosing <span>— how the counter sells it and what the days calculator uses</span></div>
          <div className={styles.sellGrid}>
            <Input label="Base unit (stock &amp; price counted in)" value={form.base_unit ?? ""} onChange={(e) => f("base_unit", e.target.value)} placeholder="tablet, capsule, bottle, tube…" />
            <div>
              <label className={styles.sellLabel}>Selling rule</label>
              <select className={styles.sellSelect} value={form.sell_mode ?? "loose"} onChange={(e) => f("sell_mode", e.target.value)}>
                {SELL_MODES.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
              </select>
            </div>
            <Input label={`Units per strip${form.sell_mode === "strip" ? " *" : ""}`} type="number" min={0} value={form.units_per_strip ?? ""} onChange={(e) => f("units_per_strip", parseInt(e.target.value) || null)} placeholder="e.g. 10" />
            <Input label="Units per pack" type="number" min={0} value={form.pack_size ?? ""} onChange={(e) => f("pack_size", parseInt(e.target.value) || undefined)} placeholder="e.g. 100 (box), 1 (bottle)" />
            {form.sell_mode === "loose"
              ? <Input label="Min. loose quantity" type="number" min={0} value={form.min_loose_qty ?? ""} onChange={(e) => f("min_loose_qty", parseInt(e.target.value) || null)} placeholder="optional, e.g. 2" />
              : <div>
                  <label className={styles.sellLabel}>Why not loose *</label>
                  <input className={styles.sellSelect} list="nonLooseReasons" value={form.non_loose_reason ?? ""} onChange={(e) => f("non_loose_reason", e.target.value)} placeholder="Shown to the cashier" />
                  <datalist id="nonLooseReasons">{REASONS.map((r) => <option key={r} value={r} />)}</datalist>
                </div>}
            <Input label="Dose unit (if not the base unit)" value={form.dose_unit ?? ""} onChange={(e) => f("dose_unit", e.target.value)} placeholder="ml, puff, drop…" />
            {form.dose_unit
              ? <Input label={`${form.dose_unit} per ${form.base_unit || "unit"}`} type="number" min={0} step={0.01} value={form.content_per_unit ?? ""} onChange={(e) => f("content_per_unit", parseFloat(e.target.value) || null)} placeholder="e.g. 100 ml per bottle" />
              : <div />}
            <Input label={`Usual dose (${form.dose_unit || form.base_unit || "units"})`} type="number" min={0} step={0.25} value={form.default_dose ?? ""} onChange={(e) => f("default_dose", parseFloat(e.target.value) || null)} placeholder="e.g. 1" />
            <div>
              <label className={styles.sellLabel}>Usual frequency</label>
              <select className={styles.sellSelect} value={form.default_frequency ?? ""} onChange={(e) => f("default_frequency", e.target.value)}>
                <option value="">— none —</option>
                {freqs.map((q) => <option key={q.code} value={q.code}>{q.code} · {q.description}</option>)}
              </select>
            </div>
            <Input label="Min. days (full course)" type="number" min={0} value={form.min_days ?? ""} onChange={(e) => f("min_days", parseInt(e.target.value) || null)} placeholder="e.g. 5 for antibiotics" />
            <Input label="Max. days per sale" type="number" min={0} value={form.max_days ?? ""} onChange={(e) => f("max_days", parseInt(e.target.value) || null)} placeholder="optional" />
          </div>
          <div className={styles.sellHint}>
            Unit price is per {form.base_unit || "unit"}.
            {form.units_per_strip ? ` A strip = ${form.units_per_strip} × ${formatCurrency(form.unit_price)} = ${formatCurrency(form.units_per_strip * form.unit_price)}.` : ""}
            {form.pack_size && form.pack_size > 1 ? ` A pack = ${form.pack_size} units (set a cheaper pack price per batch below if needed).` : ""}
          </div>
        </div>
        {editTarget && (
          <div style={{ marginTop: "var(--space-4)" }}>
            <div style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>
              Stock Batches <span style={{ fontWeight: 500, textTransform: "none", color: "var(--color-text-muted)" }}>· sold first-in, first-out (top row sells first)</span>
            </div>
            {batches.length === 0 ? <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>No stock on hand.</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "var(--color-surface-raised)" }}>
                  <th style={{ textAlign: "left", padding: 6 }}>#</th><th style={{ textAlign: "left", padding: 6 }}>Batch</th><th style={{ textAlign: "left", padding: 6 }}>Expiry</th>
                  <th style={{ textAlign: "left", padding: 6 }}>Received</th><th style={{ textAlign: "right", padding: 6 }}>Left / Recv</th>
                  <th style={{ textAlign: "right", padding: 6 }}>Cost</th><th style={{ textAlign: "right", padding: 6 }}>Unit Price</th><th style={{ textAlign: "right", padding: 6 }}>Pack Price</th>
                </tr></thead>
                <tbody>{batches.map((b, i) => (
                  <tr key={b.id} style={{ borderBottom: "1px solid var(--color-border)", background: i === 0 && !b.is_expired ? "var(--color-primary-light)" : undefined }}>
                    <td style={{ padding: 6 }}>{i + 1}{i === 0 && !b.is_expired && <Badge variant="success">Selling now</Badge>}</td>
                    <td style={{ padding: 6 }}>{b.batch_number ?? "—"} <span style={{ color: "var(--color-text-muted)", fontSize: 11 }}>{b.source}</span></td>
                    <td style={{ padding: 6 }}>{b.expiry_date ? formatDate(b.expiry_date) : "—"} {b.is_expired && <Badge variant="danger">Expired</Badge>}</td>
                    <td style={{ padding: 6 }}>{formatDate(b.received_at)}</td>
                    <td style={{ padding: 6, textAlign: "right" }}>{b.quantity_remaining} / {b.quantity_received}</td>
                    <td style={{ padding: 6, textAlign: "right" }}>{b.unit_cost != null ? formatCurrency(b.unit_cost) : "—"}</td>
                    <td style={{ padding: 6, textAlign: "right" }}>
                      {manager ? (
                        <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                          <input type="number" step="0.01" min={0} style={{ width: 90, textAlign: "right", padding: "3px 6px" }}
                            value={batchPrice[b.id] ?? String(b.selling_price)} onChange={(e) => setBatchPrice((p) => ({ ...p, [b.id]: e.target.value }))} />
                          {batchPrice[b.id] !== undefined && parseFloat(batchPrice[b.id]) !== b.selling_price &&
                            <Button size="sm" onClick={() => saveBatchPrice(b)}>Save</Button>}
                        </span>
                      ) : <strong>{formatCurrency(b.selling_price)}</strong>}
                    </td>
                    <td style={{ padding: 6, textAlign: "right" }}>
                      {manager && (form.pack_size ?? 0) > 1 ? (
                        <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                          <input type="number" step="0.01" min={0} style={{ width: 90, textAlign: "right", padding: "3px 6px" }}
                            placeholder={formatCurrency(b.selling_price * (form.pack_size ?? 1))}
                            value={packPrice[b.id] ?? (b.pack_selling_price != null ? String(b.pack_selling_price) : "")}
                            onChange={(e) => setPackPrice((p) => ({ ...p, [b.id]: e.target.value }))} />
                          {packPrice[b.id] !== undefined && <Button size="sm" onClick={() => saveBatchPackPrice(b)}>Save</Button>}
                        </span>
                      ) : (form.pack_size ?? 0) > 1
                        ? formatCurrency(b.pack_selling_price ?? b.selling_price * (form.pack_size ?? 1))
                        : "—"}
                    </td>
                  </tr>))}</tbody>
              </table>
            )}
            {batchMsg && <div style={{ fontSize: 13, marginTop: 6 }}>{batchMsg}</div>}
          </div>
        )}
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
