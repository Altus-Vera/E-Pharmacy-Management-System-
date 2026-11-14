import { useState } from "react";
import { customerService } from "../../services/customer.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table } from "../../components/ui/Table";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import type { Customer, CustomerCreate } from "../../types";
import styles from "./Customer.module.css";

const emptyForm: CustomerCreate = {
  name: "",
  contact_number: "",
  email: "",
  address: "",
  clinical_remarks: "",
};

export function CustomerPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CustomerCreate>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function search(q: string) {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      setResults(await customerService.search(q));
    } finally {
      setSearching(false);
    }
  }

  function openNew() {
    setForm(emptyForm);
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const created = await customerService.create(form);
      setResults((prev) => [created, ...prev]);
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
            label="Customer Search"
            placeholder="Search by name or phone…"
            value={query}
            onChange={(e) => search(e.target.value)}
          />
        </div>
        <Button onClick={openNew}>+ New Customer</Button>
      </div>

      <Table<Customer>
        columns={[
          { key: "name", header: "Name" },
          { key: "contact_number", header: "Phone" },
          { key: "email", header: "Email", render: (r) => r.email ?? "—" },
          {
            key: "loyalty_points",
            header: "Loyalty Pts",
            render: (r) => <Badge variant="info">{r.loyalty_points}</Badge>,
          },
          {
            key: "is_active",
            header: "Status",
            render: (r) => (
              <Badge variant={r.is_active ? "success" : "neutral"}>
                {r.is_active ? "Active" : "Inactive"}
              </Badge>
            ),
          },
        ]}
        data={results}
        rowKey={(r) => r.id}
        emptyMessage={
          searching
            ? "Searching…"
            : query.length >= 2
            ? "No customers found."
            : "Search to find customers."
        }
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Customer"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleSave}>
              Save
            </Button>
          </>
        }
      >
        <div className={styles.formGrid}>
          <Input
            label="Full Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="Phone"
            value={form.contact_number}
            onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={form.email ?? ""}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Address"
            value={form.address ?? ""}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <Input
            label="Allergy / Clinical Notes"
            value={form.clinical_remarks ?? ""}
            onChange={(e) => setForm({ ...form, clinical_remarks: e.target.value })}
            placeholder="e.g. Penicillin Group Allergy"
          />
        </div>
      </Modal>
    </div>
  );
}
