import { useEffect, useState } from "react";
import { userService } from "../../services/user.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table } from "../../components/ui/Table";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { formatUserType, formatDateTime } from "../../utils/formatters";
import type { User, UserCreate, UserType } from "../../types";
import styles from "./UserManagement.module.css";

const USER_TYPES: UserType[] = ["pharmacist", "stock_manager", "pharmacy_manager", "system_administrator"];

const emptyForm: UserCreate = { name: "", nic: "", username: "", password: "", user_type: "pharmacist" };

export function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<UserCreate>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setUsers(await userService.getAll()); }
    finally { setLoading(false); }
  }

  function openNew() { setForm(emptyForm); setModalOpen(true); }

  async function handleSave() {
    setSaving(true);
    try {
      const created = await userService.create(form);
      setUsers((prev) => [created, ...prev]);
      setModalOpen(false);
    } finally { setSaving(false); }
  }

  const f = (field: keyof UserCreate, v: string) => setForm((p) => ({ ...p, [field]: v }));

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <Button onClick={openNew}>+ New User</Button>
      </div>

      <Table<User>
        columns={[
          { key: "name", header: "Name" },
          { key: "username", header: "Username" },
          { key: "user_type", header: "Role", render: (r) => <Badge variant="primary">{formatUserType(r.user_type)}</Badge> },
          { key: "nic", header: "NIC" },
          { key: "contact_number", header: "Phone", render: (r) => r.contact_number ?? "—" },
          { key: "last_login_at", header: "Last Login", render: (r) => r.last_login_at ? formatDateTime(r.last_login_at) : "Never" },
          { key: "is_active", header: "Status", render: (r) => <Badge variant={r.is_active ? "success" : "neutral"}>{r.is_active ? "Active" : "Inactive"}</Badge> },
        ]}
        data={users}
        rowKey={(r) => r.id}
        emptyMessage={loading ? "Loading…" : "No users found."}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New User"
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button loading={saving} onClick={handleSave}>Create User</Button>
        </>}
      >
        <div className={styles.formGrid}>
          <Input label="Full Name" value={form.name} onChange={(e) => f("name", e.target.value)} required />
          <Input label="NIC" value={form.nic} onChange={(e) => f("nic", e.target.value)} required />
          <Input label="Username" value={form.username} onChange={(e) => f("username", e.target.value)} required />
          <Input label="Password" type="password" value={form.password} onChange={(e) => f("password", e.target.value)} required />
          <div>
            <label style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-medium)", color: "var(--color-text-secondary)" }}>Role</label>
            <select
              style={{ width: "100%", marginTop: "var(--space-1)", padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "var(--font-size-sm)" }}
              value={form.user_type}
              onChange={(e) => f("user_type", e.target.value)}
            >
              {USER_TYPES.map((t) => <option key={t} value={t}>{formatUserType(t)}</option>)}
            </select>
          </div>
          <Input label="Phone" value={form.contact_number ?? ""} onChange={(e) => f("contact_number", e.target.value)} />
          <div className={styles.fullWidth}>
            <Input label="Address" value={form.address ?? ""} onChange={(e) => f("address", e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
