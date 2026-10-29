import { useEffect, useState } from "react";
import { customerService } from "../../services/customer.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { Table } from "../../components/ui/Table";
import { formatCurrency, formatDate } from "../../utils/formatters";
import type { Customer, CustomerCreate, CustomerInvoiceSummary, Gender } from "../../types";
import styles from "./Customers.module.css";

// ── helpers ───────────────────────────────────────────────────────────────────

function calcAge(dob: string | null): string {
  if (!dob) return "—";
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${years} yrs`;
}

const emptyForm: CustomerCreate = {
  name: "",
  contact_number: "",
  email: "",
  address: "",
  dob: "",
  gender: undefined,
  discount_rate: 0,
  clinical_remarks: "",
};

// ── component ─────────────────────────────────────────────────────────────────

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("active");

  // Create / edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerCreate>(emptyForm);
  const [saving, setSaving] = useState(false);

  // View detail / history modal
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<CustomerInvoiceSummary[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try { setCustomers(await customerService.getAll()); }
    finally { setLoading(false); }
  }

  async function search(q: string) {
    setQuery(q);
    if (q.length < 2) { loadAll(); return; }
    try { setCustomers(await customerService.search(q)); }
    catch { setCustomers([]); }
  }

  // ── create / edit ──────────────────────────────────────────────────────────
  function openNew() {
    setEditTarget(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(c: Customer) {
    setEditTarget(c);
    setForm({
      name: c.name,
      contact_number: c.contact_number,
      email: c.email ?? "",
      address: c.address ?? "",
      dob: c.dob ?? "",
      gender: c.gender ?? undefined,
      discount_rate: c.discount_rate,
      clinical_remarks: c.clinical_remarks ?? "",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload: CustomerCreate = {
        ...form,
        email: form.email || undefined,
        address: form.address || undefined,
        dob: form.dob || undefined,
        clinical_remarks: form.clinical_remarks || undefined,
      };
      if (editTarget) {
        const updated = await customerService.update(editTarget.id, payload);
        setCustomers((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      } else {
        const created = await customerService.create(payload);
        setCustomers((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } finally { setSaving(false); }
  }

  // ── toggle active ──────────────────────────────────────────────────────────
  async function toggleActive(c: Customer) {
    const updated = await customerService.update(c.id, { is_active: !c.is_active } as Partial<CustomerCreate>);
    setCustomers((prev) => prev.map((x) => x.id === updated.id ? updated : x));
  }

  // ── view detail ───────────────────────────────────────────────────────────
  async function openDetail(c: Customer) {
    setDetailCustomer(c);
    setDetailModalOpen(true);
    setLoadingInvoices(true);
    try { setInvoices(await customerService.getInvoices(c.id)); }
    catch { setInvoices([]); }
    finally { setLoadingInvoices(false); }
  }

  const f = (field: keyof CustomerCreate, value: unknown) =>
    setForm((p) => ({ ...p, [field]: value }));

  // ── filter ─────────────────────────────────────────────────────────────────
  const displayed = customers.filter((c) => {
    if (filterActive === "active") return c.is_active;
    if (filterActive === "inactive") return !c.is_active;
    return true;
  });

  const totalLoyalty = displayed.reduce((s, c) => s + c.loyalty_points, 0);

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ── Stats bar ── */}
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{customers.filter((c) => c.is_active).length}</div>
          <div className={styles.statLabel}>Active Patients</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{customers.filter((c) => c.clinical_remarks).length}</div>
          <div className={styles.statLabel}>With Allergy / Clinical Notes</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{totalLoyalty.toLocaleString()}</div>
          <div className={styles.statLabel}>Total Loyalty Points</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{customers.filter((c) => c.discount_rate > 0).length}</div>
          <div className={styles.statLabel}>With Special Discount</div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <Input
            label="Search"
            placeholder="Search by name or phone…"
            value={query}
            onChange={(e) => search(e.target.value)}
          />
          <div className={styles.filterTabs}>
            {(["active", "inactive", "all"] as const).map((f) => (
              <button
                key={f}
                className={`${styles.filterTab} ${filterActive === f ? styles.filterTabActive : ""}`}
                onClick={() => setFilterActive(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={openNew}>+ New Customer</Button>
      </div>

      {/* ── Table ── */}
      <Table<Customer>
        columns={[
          {
            key: "name", header: "Patient", render: (c) => (
              <div>
                <div className={styles.patientName}>{c.name}</div>
                <div className={styles.patientPhone}>{c.contact_number}</div>
              </div>
            ),
          },
          { key: "dob", header: "Age / Gender", render: (c) => (
            <span>{calcAge(c.dob)}{c.gender ? ` · ${c.gender.charAt(0).toUpperCase()}` : ""}</span>
          )},
          { key: "clinical_remarks", header: "Clinical Notes", render: (c) =>
            c.clinical_remarks
              ? <span className={styles.clinicalNote}>⚠ {c.clinical_remarks}</span>
              : <span className={styles.noNote}>—</span>
          },
          { key: "loyalty_points", header: "Loyalty Pts", render: (c) => (
            <span className={styles.loyaltyVal}>⭐ {c.loyalty_points}</span>
          )},
          { key: "discount_rate", header: "Discount", render: (c) =>
            c.discount_rate > 0
              ? <Badge variant="success">{c.discount_rate}%</Badge>
              : <span className={styles.noNote}>—</span>
          },
          { key: "is_active", header: "Status", render: (c) =>
            <Badge variant={c.is_active ? "success" : "neutral"}>{c.is_active ? "Active" : "Inactive"}</Badge>
          },
          { key: "actions", header: "", render: (c) => (
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button variant="ghost" size="sm" onClick={() => openDetail(c)}>View</Button>
              <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Edit</Button>
              <Button variant="ghost" size="sm" onClick={() => toggleActive(c)}>
                {c.is_active ? "Deactivate" : "Activate"}
              </Button>
            </div>
          )},
        ]}
        data={displayed}
        rowKey={(c) => c.id}
        emptyMessage={loading ? "Loading…" : "No customers found."}
      />

      {/* ══ Create / Edit Modal ═════════════════════════════════════════════════ */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? "Edit Customer" : "New Customer"}
        size="lg"
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button loading={saving} onClick={handleSave}>Save Customer</Button>
        </>}
      >
        <div className={styles.formGrid}>
          <Input label="Full Name" value={form.name} onChange={(e) => f("name", e.target.value)} required />
          <Input label="Contact Number" value={form.contact_number} onChange={(e) => f("contact_number", e.target.value)} required />
          <Input label="Email" type="email" value={form.email ?? ""} onChange={(e) => f("email", e.target.value)} />
          <Input label="Date of Birth" type="date" value={form.dob ?? ""} onChange={(e) => f("dob", e.target.value)} />

          <div>
            <label className={styles.fieldLabel}>Gender</label>
            <select className={styles.selectField} value={form.gender ?? ""} onChange={(e) => f("gender", e.target.value as Gender || undefined)}>
              <option value="">— Select —</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <Input label="Discount Rate (%)" type="number" min={0} max={100} step={0.5}
            value={form.discount_rate ?? 0} onChange={(e) => f("discount_rate", parseFloat(e.target.value) || 0)} />

          <div className={styles.fullWidth}>
            <Input label="Address" value={form.address ?? ""} onChange={(e) => f("address", e.target.value)} />
          </div>

          <div className={styles.fullWidth}>
            <label className={styles.fieldLabel}>Clinical Remarks / Allergy Notes</label>
            <textarea
              className={styles.textareaField}
              rows={3}
              placeholder="e.g. Penicillin Group Allergy • Regular Cardiac Patient"
              value={form.clinical_remarks ?? ""}
              onChange={(e) => f("clinical_remarks", e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* ══ Detail / History Modal ══════════════════════════════════════════════ */}
      {detailCustomer && (
        <Modal
          open={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title="Patient Details"
          size="lg"
          footer={<>
            <Button variant="secondary" onClick={() => { setDetailModalOpen(false); openEdit(detailCustomer); }}>Edit</Button>
            <Button onClick={() => setDetailModalOpen(false)}>Close</Button>
          </>}
        >
          {/* Profile card */}
          <div className={styles.profileCard}>
            <div className={styles.profileAvatar}>
              {detailCustomer.name.charAt(0).toUpperCase()}
            </div>
            <div className={styles.profileInfo}>
              <div className={styles.profileName}>{detailCustomer.name}</div>
              <div className={styles.profileMeta}>
                {detailCustomer.contact_number}
                {detailCustomer.email && ` · ${detailCustomer.email}`}
                {detailCustomer.dob && ` · Age: ${calcAge(detailCustomer.dob)}`}
                {detailCustomer.gender && ` · ${detailCustomer.gender}`}
              </div>
              {detailCustomer.address && (
                <div className={styles.profileMeta}>{detailCustomer.address}</div>
              )}
            </div>
            <div className={styles.profileBadges}>
              <div className={styles.loyaltyBlock}>
                <div className={styles.loyaltyNum}>⭐ {detailCustomer.loyalty_points}</div>
                <div className={styles.loyaltyText}>Loyalty Points</div>
              </div>
              {detailCustomer.discount_rate > 0 && (
                <Badge variant="success">{detailCustomer.discount_rate}% Discount</Badge>
              )}
              <Badge variant={detailCustomer.is_active ? "success" : "neutral"}>
                {detailCustomer.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>

          {/* Allergy / clinical alert */}
          {detailCustomer.clinical_remarks && (
            <div className={styles.allergyBlock}>
              <span className={styles.allergyIcon}>⚠</span>
              <div>
                <div className={styles.allergyTitle}>Clinical Notes / Allergy Alert</div>
                <div className={styles.allergyText}>{detailCustomer.clinical_remarks}</div>
              </div>
            </div>
          )}

          {/* Purchase history */}
          <div className={styles.historySection}>
            <div className={styles.historyTitle}>Purchase History</div>
            {loadingInvoices ? (
              <div className={styles.historyEmpty}>Loading…</div>
            ) : invoices.length === 0 ? (
              <div className={styles.historyEmpty}>No purchase records found.</div>
            ) : (
              <table className={styles.historyTable}>
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Payment</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className={styles.invoiceNum}>{inv.invoice_number}</td>
                      <td>{formatDate(inv.created_at)}</td>
                      <td style={{ textTransform: "capitalize" }}>{inv.payment_mode}</td>
                      <td style={{ fontWeight: "var(--font-weight-semibold)" }}>{formatCurrency(inv.total_amount)}</td>
                      <td>
                        <Badge variant={inv.status === "completed" ? "success" : "danger"}>
                          {inv.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
