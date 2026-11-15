import { useEffect, useState } from "react";
import { doctorService } from "../../services/doctor.service";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { Table } from "../../components/ui/Table";
import type { Doctor, DoctorCreate } from "../../types";
import { apiError } from "../../utils/errors";
import { isManager } from "../../utils/roles";
import { useAuthStore } from "../../store/authStore";
import styles from "./Doctors.module.css";

const emptyForm: DoctorCreate = {
  name: "",
  slmc_reg_number: "",
  specialization: "",
  hospital_clinic: "",
  contact_number: "",
  email: "",
};

export function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("active");

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Doctor | null>(null);
  const [form, setForm] = useState<DoctorCreate>(emptyForm);
  const user = useAuthStore((st) => st.user);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try { setDoctors(await doctorService.getAll()); }
    finally { setLoading(false); }
  }

  async function search(q: string) {
    setQuery(q);
    if (q.length < 2) { loadAll(); return; }
    try { setDoctors(await doctorService.search(q)); }
    catch { setDoctors([]); }
  }

  function openNew() {
    setEditTarget(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(d: Doctor) {
    setEditTarget(d);
    setForm({
      name: d.name,
      slmc_reg_number: d.slmc_reg_number,
      specialization: d.specialization ?? "",
      hospital_clinic: d.hospital_clinic ?? "",
      contact_number: d.contact_number ?? "",
      email: d.email ?? "",
      discount_rate: d.discount_rate ?? 0,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload: DoctorCreate = {
        ...form,
        specialization: form.specialization || undefined,
        hospital_clinic: form.hospital_clinic || undefined,
        contact_number: form.contact_number || undefined,
        email: form.email || undefined,
      };
      if (editTarget) {
        const updated = await doctorService.update(editTarget.id, payload);
        setDoctors((prev) => prev.map((d) => d.id === updated.id ? updated : d));
      } else {
        const created = await doctorService.create(payload);
        setDoctors((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (e) { alert(apiError(e)); } finally { setSaving(false); }
  }

  async function toggleActive(d: Doctor) {
    const updated = await doctorService.update(d.id, { is_active: !d.is_active });
    setDoctors((prev) => prev.map((x) => x.id === updated.id ? updated : x));
  }

  const f = (field: keyof DoctorCreate, value: string) =>
    setForm((p) => ({ ...p, [field]: value }));

  const displayed = doctors.filter((d) => {
    if (filterActive === "active") return d.is_active;
    if (filterActive === "inactive") return !d.is_active;
    return true;
  });

  return (
    <div className={styles.page}>

      {/* Stats bar */}
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{doctors.filter((d) => d.is_active).length}</div>
          <div className={styles.statLabel}>Active Doctors</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{[...new Set(doctors.filter(d => d.specialization).map(d => d.specialization))].length}</div>
          <div className={styles.statLabel}>Specializations</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{[...new Set(doctors.filter(d => d.hospital_clinic).map(d => d.hospital_clinic))].length}</div>
          <div className={styles.statLabel}>Hospitals / Clinics</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{doctors.length}</div>
          <div className={styles.statLabel}>Total Registered</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <Input
            label="Search"
            placeholder="Search by name, SLMC number or phone…"
            value={query}
            onChange={(e) => search(e.target.value)}
          />
          <div className={styles.filterTabs}>
            {(["active", "inactive", "all"] as const).map((tab) => (
              <button
                key={tab}
                className={`${styles.filterTab} ${filterActive === tab ? styles.filterTabActive : ""}`}
                onClick={() => setFilterActive(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={openNew}>+ New Doctor</Button>
      </div>

      {/* Table */}
      <Table<Doctor>
        columns={[
          {
            key: "name", header: "Doctor", render: (d) => (
              <div>
                <div className={styles.doctorName}>Dr. {d.name}</div>
                <div className={styles.slmcNum}>SLMC: {d.slmc_reg_number}</div>
              </div>
            ),
          },
          {
            key: "specialization", header: "Specialization", render: (d) =>
              d.specialization
                ? <Badge variant="info">{d.specialization}</Badge>
                : <span className={styles.muted}>—</span>
          },
          {
            key: "hospital_clinic", header: "Hospital / Clinic", render: (d) =>
              <span className={styles.hospital}>{d.hospital_clinic ?? "—"}</span>
          },
          {
            key: "contact_number", header: "Contact", render: (d) =>
              <span className={styles.muted}>{d.contact_number ?? "—"}</span>
          },
          {
            key: "is_active", header: "Status", render: (d) =>
              <Badge variant={d.is_active ? "success" : "neutral"}>{d.is_active ? "Active" : "Inactive"}</Badge>
          },
          {
            key: "actions", header: "", render: (d) => (
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <Button variant="ghost" size="sm" onClick={() => openEdit(d)}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => toggleActive(d)}>
                  {d.is_active ? "Deactivate" : "Activate"}
                </Button>
              </div>
            ),
          },
        ]}
        data={displayed}
        rowKey={(d) => d.id}
        emptyMessage={loading ? "Loading…" : "No doctors found."}
      />

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? "Edit Doctor" : "New Doctor"}
        size="lg"
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button loading={saving} onClick={handleSave}>Save Doctor</Button>
        </>}
      >
        <div className={styles.formGrid}>
          <Input label="Full Name" value={form.name} onChange={(e) => f("name", e.target.value)} required />
          <Input
            label="SLMC Registration No."
            value={form.slmc_reg_number}
            onChange={(e) => f("slmc_reg_number", e.target.value)}
            required
            placeholder="e.g. SLMC-38419"
          />
          <Input label="Specialization" value={form.specialization ?? ""} onChange={(e) => f("specialization", e.target.value)} placeholder="e.g. Cardiologist" />
          <Input label="Hospital / Clinic" value={form.hospital_clinic ?? ""} onChange={(e) => f("hospital_clinic", e.target.value)} placeholder="e.g. National Hospital" />
          <Input label="Contact Number" value={form.contact_number ?? ""} onChange={(e) => f("contact_number", e.target.value)} />
          <Input label="Email" type="email" value={form.email ?? ""} onChange={(e) => f("email", e.target.value)} />
          <Input
            label={isManager(user?.user_type) ? "Doctor Discount %" : "Doctor Discount % (manager only)"}
            type="number" min={0} max={100} step={0.5}
            disabled={!isManager(user?.user_type)}
            value={form.discount_rate ?? 0}
            onChange={(e) => setForm((p) => ({ ...p, discount_rate: parseFloat(e.target.value) || 0 }))}
          />
        </div>
      </Modal>
    </div>
  );
}
