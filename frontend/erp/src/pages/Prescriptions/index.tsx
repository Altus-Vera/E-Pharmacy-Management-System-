import { useEffect, useRef, useState } from "react";
import { prescriptionService } from "../../services/prescription.service";
import { customerService } from "../../services/customer.service";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table } from "../../components/ui/Table";
import { formatDate } from "../../utils/formatters";
import type { Customer, Prescription } from "../../types";
import { Modal } from "../../components/ui/Modal";
import { PrescriptionForm } from "../../components/PrescriptionForm";
import styles from "./Prescriptions.module.css";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function PrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [query, setQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [filterType, setFilterType] = useState<"all" | "one_time" | "recurrent">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<number | null>(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try { setPrescriptions(await prescriptionService.getAll()); }
    finally { setLoading(false); }
  }

  async function searchCustomers(q: string) {
    setQuery(q);
    if (!q) { setSelectedCustomer(null); loadAll(); setCustomerResults([]); return; }
    if (q.length < 2) { setCustomerResults([]); return; }
    try { setCustomerResults(await customerService.search(q)); }
    catch { setCustomerResults([]); }
  }

  async function selectCustomer(c: Customer) {
    setSelectedCustomer(c);
    setQuery(c.name);
    setCustomerResults([]);
    setLoading(true);
    try { setPrescriptions(await prescriptionService.getByCustomer(c.id)); }
    finally { setLoading(false); }
  }

  async function toggleActive(p: Prescription) {
    const updated = await prescriptionService.update(p.id, { is_active: !p.is_active });
    setPrescriptions((prev) => prev.map((x) => x.id === updated.id ? updated : x));
  }

  function triggerUpload(prescriptionId: number) {
    uploadTargetRef.current = prescriptionId;
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const id = uploadTargetRef.current;
    if (!file || !id) return;
    e.target.value = "";
    setUploadingId(id);
    try {
      const updated = await prescriptionService.uploadScan(id, file);
      setPrescriptions((prev) => prev.map((x) => x.id === updated.id ? updated : x));
    } finally {
      setUploadingId(null);
    }
  }

  const displayed = prescriptions.filter((p) => {
    if (filterType !== "all" && p.reproduce_type !== filterType) return false;
    if (filterStatus === "active" && !p.is_active) return false;
    if (filterStatus === "inactive" && p.is_active) return false;
    return true;
  });

  const activeCount = prescriptions.filter((p) => p.is_active).length;
  const recurrentCount = prescriptions.filter((p) => p.reproduce_type === "recurrent").length;

  return (
    <div className={styles.page}>

      {/* Stats */}
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{prescriptions.length}</div>
          <div className={styles.statLabel}>Total Prescriptions</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{activeCount}</div>
          <div className={styles.statLabel}>Active</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{recurrentCount}</div>
          <div className={styles.statLabel}>Recurrent</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{prescriptions.filter((p) => p.scan_file_path).length}</div>
          <div className={styles.statLabel}>With Scan</div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
        {!selectedCustomer && <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Pick a patient below to add a prescription</span>}
        <Button disabled={!selectedCustomer} onClick={() => setNewOpen(true)}>+ New Prescription</Button>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.customerSearch}>
            <Input
              label="Filter by Patient"
              placeholder="Search patient name or phone…"
              value={query}
              onChange={(e) => searchCustomers(e.target.value)}
            />
            {customerResults.length > 0 && (
              <div className={styles.customerDropdown}>
                {customerResults.map((c) => (
                  <div key={c.id} className={styles.customerOption} onClick={() => selectCustomer(c)}>
                    <span className={styles.customerOptionName}>{c.name}</span>
                    <span className={styles.customerOptionPhone}>{c.contact_number}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className={styles.filterLabel}>Type</div>
            <div className={styles.filterTabs}>
              {(["all", "one_time", "recurrent"] as const).map((t) => (
                <button
                  key={t}
                  className={`${styles.filterTab} ${filterType === t ? styles.filterTabActive : ""}`}
                  onClick={() => setFilterType(t)}
                >
                  {t === "all" ? "All" : t === "one_time" ? "One-Time" : "Recurrent"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className={styles.filterLabel}>Status</div>
            <div className={styles.filterTabs}>
              {(["all", "active", "inactive"] as const).map((s) => (
                <button
                  key={s}
                  className={`${styles.filterTab} ${filterStatus === s ? styles.filterTabActive : ""}`}
                  onClick={() => setFilterStatus(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        {selectedCustomer && (
          <button className={styles.clearFilter} onClick={() => { setQuery(""); setSelectedCustomer(null); loadAll(); }}>
            ✕ Clear Filter
          </button>
        )}
      </div>

      {/* Table */}
      <Table<Prescription>
        columns={[
          {
            key: "id", header: "Rx #", render: (p) =>
              <span className={styles.rxNum}>RX-{String(p.id).padStart(5, "0")}</span>
          },
          {
            key: "customer_id", header: "Patient", render: (p) =>
              <span className={styles.patientName}>{p.customer_name ?? `Customer #${p.customer_id}`}</span>
          },
          {
            key: "issue_date", header: "Issue Date", render: (p) => formatDate(p.issue_date)
          },
          {
            key: "reproduce_type", header: "Type", render: (p) =>
              <Badge variant={p.reproduce_type === "recurrent" ? "warning" : "info"}>
                {p.reproduce_type === "recurrent" ? "Recurrent" : "One-Time"}
              </Badge>
          },
          {
            key: "valid_days", header: "Validity", render: (p) => {
              if (p.valid_months) return <span>{p.valid_months} month{p.valid_months > 1 ? "s" : ""}</span>;
              if (p.valid_days) return <span>{p.valid_days} day{p.valid_days > 1 ? "s" : ""}</span>;
              return <span className={styles.muted}>—</span>;
            }
          },
          {
            key: "scan_file_path", header: "Scan", render: (p) => (
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                {p.scan_file_path ? (
                  <a href={`${API_BASE}/uploads/${p.scan_file_path}`} target="_blank" rel="noreferrer">
                    <Badge variant="success">View Scan</Badge>
                  </a>
                ) : (
                  <Badge variant="neutral">None</Badge>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => triggerUpload(p.id)}
                  disabled={uploadingId === p.id}
                >
                  {uploadingId === p.id ? "Uploading…" : p.scan_file_path ? "Replace" : "Upload"}
                </Button>
              </div>
            )
          },
          {
            key: "drug_details_text", header: "Drug Notes", render: (p) =>
              p.drug_details_text
                ? <span className={styles.drugNotes} title={p.drug_details_text}>{p.drug_details_text.slice(0, 40)}{p.drug_details_text.length > 40 ? "…" : ""}</span>
                : <span className={styles.muted}>—</span>
          },
          {
            key: "is_active", header: "Status", render: (p) =>
              <Badge variant={p.is_active ? "success" : "neutral"}>{p.is_active ? "Active" : "Inactive"}</Badge>
          },
          {
            key: "actions", header: "", render: (p) => (
              <Button variant="ghost" size="sm" onClick={() => toggleActive(p)}>
                {p.is_active ? "Deactivate" : "Activate"}
              </Button>
            ),
          },
        ]}
        data={displayed}
        rowKey={(p) => p.id}
        emptyMessage={loading ? "Loading…" : "No prescriptions found."}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="New Prescription" size="lg">
        {selectedCustomer && (
          <PrescriptionForm
            customerId={selectedCustomer.id}
            customerName={`${selectedCustomer.name} · ${selectedCustomer.contact_number}`}
            onCancel={() => setNewOpen(false)}
            onSaved={() => { setNewOpen(false); selectCustomer(selectedCustomer); }}
          />
        )}
      </Modal>
    </div>
  );
}
