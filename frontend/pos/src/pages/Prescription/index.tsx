import { useState } from "react";
import { customerService } from "../../services/customer.service";
import { prescriptionService } from "../../services/prescription.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table } from "../../components/ui/Table";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { formatDate } from "../../utils/formatters";
import type { Customer, Prescription, PrescriptionCreate } from "../../types";
import styles from "./Prescription.module.css";

export function PrescriptionPage() {
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<PrescriptionCreate>({
    customer_id: 0,
    issue_date: new Date().toISOString().split("T")[0],
    reproduce_type: "one_time",
  });
  const [saving, setSaving] = useState(false);

  async function searchCustomers(q: string) {
    setCustomerQuery(q);
    if (q.length < 2) { setCustomerResults([]); return; }
    try {
      setCustomerResults(await customerService.search(q));
    } catch {
      setCustomerResults([]);
    }
  }

  async function selectCustomer(c: Customer) {
    setSelectedCustomer(c);
    setCustomerResults([]);
    setCustomerQuery(c.name);
    const list = await prescriptionService.getByCustomer(c.id);
    setPrescriptions(list);
  }

  function openNew() {
    if (!selectedCustomer) return;
    setForm({
      customer_id: selectedCustomer.id,
      issue_date: new Date().toISOString().split("T")[0],
      reproduce_type: "one_time",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const created = await prescriptionService.create(form);
      setPrescriptions((prev) => [created, ...prev]);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.searchInput}>
          <Input
            label="Customer"
            placeholder="Search customer by name or phone…"
            value={customerQuery}
            onChange={(e) => searchCustomers(e.target.value)}
          />
          {customerResults.map((c) => (
            <div
              key={c.id}
              onClick={() => selectCustomer(c)}
              style={{
                padding: "var(--space-2) var(--space-3)",
                cursor: "pointer",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderTop: "none",
                fontSize: "var(--font-size-sm)",
              }}
            >
              {c.name} — {c.contact_number}
            </div>
          ))}
        </div>
        <Button onClick={openNew} disabled={!selectedCustomer}>
          + New Prescription
        </Button>
      </div>

      <Table<Prescription>
        columns={[
          { key: "id", header: "ID" },
          { key: "issue_date", header: "Issue Date", render: (r) => formatDate(r.issue_date) },
          { key: "reproduce_type", header: "Type", render: (r) => <Badge variant="info">{r.reproduce_type}</Badge> },
          {
            key: "is_active",
            header: "Status",
            render: (r) => <Badge variant={r.is_active ? "success" : "neutral"}>{r.is_active ? "Active" : "Inactive"}</Badge>,
          },
          {
            key: "scan_file_path",
            header: "Scan",
            render: (r) =>
              r.scan_file_path ? (
                <Badge variant="success">Uploaded</Badge>
              ) : (
                <Badge variant="neutral">None</Badge>
              ),
          },
        ]}
        data={prescriptions}
        rowKey={(r) => r.id}
        emptyMessage={selectedCustomer ? "No prescriptions for this customer." : "Select a customer to view prescriptions."}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Prescription"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleSave}>Save</Button>
          </>
        }
      >
        <div className={styles.formGrid}>
          <Input
            label="Issue Date"
            type="date"
            value={form.issue_date}
            onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
            required
          />
          <div>
            <label style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-medium)", color: "var(--color-text-secondary)" }}>
              Type
            </label>
            <select
              style={{ width: "100%", padding: "var(--space-2) var(--space-3)", marginTop: "var(--space-1)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "var(--font-size-sm)" }}
              value={form.reproduce_type}
              onChange={(e) => setForm({ ...form, reproduce_type: e.target.value as "one_time" | "recurrent" })}
            >
              <option value="one_time">One Time</option>
              <option value="recurrent">Recurrent</option>
            </select>
          </div>
          <Input
            label="Valid Days"
            type="number"
            min={1}
            value={form.valid_days ?? ""}
            onChange={(e) => setForm({ ...form, valid_days: Number(e.target.value) || undefined })}
          />
          <Input
            label="Valid Months"
            type="number"
            min={1}
            value={form.valid_months ?? ""}
            onChange={(e) => setForm({ ...form, valid_months: Number(e.target.value) || undefined })}
          />
          <div className={styles.fullWidth}>
            <Input
              label="Drug Details"
              value={form.drug_details_text ?? ""}
              onChange={(e) => setForm({ ...form, drug_details_text: e.target.value })}
              placeholder="Notes about prescribed drugs"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
