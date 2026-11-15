import { useEffect, useState } from "react";
import api from "../../services/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { Table } from "../../components/ui/Table";
import { apiError } from "../../utils/errors";
import { isManager } from "../../utils/roles";
import { useAuthStore } from "../../store/authStore";

interface FreqCode { id: number; code: string; description: string; times_per_day: number | null; sort_order: number; is_active: boolean }
interface Form { code: string; description: string; times_per_day: string; sort_order: string; is_active: boolean }
const empty: Form = { code: "", description: "", times_per_day: "", sort_order: "100", is_active: true };

/** Dosing frequencies used by the POS days calculator (OD, BD, TDS, 1-0-1 …). */
export function DoseCodesPage() {
  const [rows, setRows] = useState<FreqCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<FreqCode | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const manager = isManager(useAuthStore((s) => s.user)?.user_type);

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    try { setRows((await api.get<FreqCode[]>("/frequency-codes", { params: { all: true } })).data); }
    finally { setLoading(false); }
  }

  function openNew() { setEdit(null); setForm(empty); setError(""); setOpen(true); }
  function openEdit(r: FreqCode) {
    setEdit(r);
    setForm({ code: r.code, description: r.description, times_per_day: r.times_per_day?.toString() ?? "", sort_order: String(r.sort_order), is_active: r.is_active });
    setError(""); setOpen(true);
  }

  async function save() {
    const body = {
      code: form.code.trim(), description: form.description.trim(),
      times_per_day: form.times_per_day === "" ? null : Number(form.times_per_day),
      sort_order: Number(form.sort_order) || 100, is_active: form.is_active,
    };
    setSaving(true); setError("");
    try {
      if (edit) await api.patch(`/frequency-codes/${edit.id}`, body); else await api.post("/frequency-codes", body);
      setOpen(false); load();
    } catch (e) { setError(apiError(e)); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
          Frequencies the POS uses to work out "how much for N days". Leave times-per-day empty for "as needed" (quantity entered by hand).
        </span>
        {manager && <Button variant="primary" onClick={openNew}>+ New Dose Code</Button>}
      </div>
      <Table<FreqCode>
        columns={[
          { key: "code", header: "Code", render: (r) => <code style={{ fontWeight: 700 }}>{r.code}</code> },
          { key: "desc", header: "Meaning", render: (r) => <span>{r.description}</span> },
          { key: "tpd", header: "Times / day", render: (r) => <span>{r.times_per_day ?? "as needed"}</span> },
          { key: "ex", header: "Example: 1 tablet × 3 days", render: (r) => <span style={{ color: "var(--color-text-muted)" }}>{r.times_per_day ? `${Math.ceil(r.times_per_day * 3)} tablets` : "—"}</span> },
          { key: "st", header: "Status", render: (r) => r.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Hidden</Badge> },
          { key: "a", header: "", render: (r) => manager ? <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Edit</Button> : null },
        ]}
        data={rows}
        rowKey={(r) => r.id}
        emptyMessage={loading ? "Loading…" : "No dose codes."}
      />
      <Modal open={open} onClose={() => setOpen(false)} title={edit ? `Edit ${edit.code}` : "New Dose Code"} size="sm">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {error && <div style={{ color: "var(--color-danger)", fontSize: "var(--font-size-sm)" }}>{error}</div>}
          <Input label="Code" value={form.code} disabled={!!edit} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. TDS or 1-0-1" />
          <Input label="Meaning (printed on the label)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Three times a day" />
          <Input label="Times per day" type="number" min={0} step={0.01} value={form.times_per_day} onChange={(e) => setForm({ ...form, times_per_day: e.target.value })} placeholder="empty = as needed" />
          <Input label="Order in lists" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "var(--font-size-sm)" }}>
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Show in POS
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={saving || !form.code.trim() || !form.description.trim()} onClick={save}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
