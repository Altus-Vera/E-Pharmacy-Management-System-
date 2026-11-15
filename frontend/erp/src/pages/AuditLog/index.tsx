import { useEffect, useState } from "react";
import api from "../../services/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table } from "../../components/ui/Table";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { formatDateTime } from "../../utils/formatters";
import { apiError, exportCsv } from "../../utils/errors";
import s from "../../styles/erp.module.css";

interface AuditRow {
  id: number; user_id: number | null; user_name: string | null; action: string; entity_type: string;
  entity_id: number | null; new_value: string | null; ip_address: string | null; created_at: string;
}

const verbVariant = (a: string) => (a.startsWith("POST") ? "success" : a.startsWith("PATCH") || a.startsWith("PUT") ? "warning" : a.startsWith("DELETE") ? "danger" : "neutral");

export function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [entity, setEntity] = useState("");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<AuditRow | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true); setError("");
    try { setRows((await api.get<AuditRow[]>("/audit-logs", { params: { from, to, entity: entity || undefined, take: 2000 } })).data); }
    catch (e) { setError(apiError(e)); }
    finally { setLoading(false); }
  }

  const entities = Array.from(new Set(rows.map((r) => r.entity_type))).sort();
  const filtered = rows.filter((r) => {
    const t = q.trim().toLowerCase();
    return !t || (r.user_name ?? "").toLowerCase().includes(t) || r.action.toLowerCase().includes(t) || (r.new_value ?? "").toLowerCase().includes(t);
  });

  return (
    <div className={s.page}>
      <div className={s.toolbar} style={{ alignItems: "flex-end" }}>
        <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <div className={s.field}>
          <span className={s.fieldLabel}>Area</span>
          <select className={s.select} style={{ width: 180 }} value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value="">All areas</option>
            {entities.map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>
        <Button onClick={load}>Apply</Button>
        <input className={s.search} placeholder="Search user, action or data…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className={s.spacer} />
        <Button variant="secondary" onClick={() => exportCsv("audit-log.csv", [["When", "User", "Action", "Area", "Record", "IP", "Data"], ...filtered.map((r) => [r.created_at, r.user_name, r.action, r.entity_type, r.entity_id, r.ip_address, r.new_value])])}>Export CSV</Button>
      </div>
      {error && <div className={s.error}>{error}</div>}
      <Table<AuditRow>
        columns={[
          { key: "created_at", header: "When", render: (r) => formatDateTime(r.created_at) },
          { key: "user", header: "User", render: (r) => <span className={s.strong}>{r.user_name ?? "System"}</span> },
          { key: "action", header: "Action", render: (r) => <Badge variant={verbVariant(r.action)}>{r.action.split(" ")[0]}</Badge> },
          { key: "path", header: "Endpoint", render: (r) => <code style={{ fontSize: 12 }}>{r.action.split(" ")[1]}</code> },
          { key: "entity_type", header: "Area" },
          { key: "entity_id", header: "Record", render: (r) => r.entity_id ?? "—" },
          { key: "ip_address", header: "IP", render: (r) => <span className={s.muted}>{r.ip_address ?? "—"}</span> },
          { key: "view", header: "", render: (r) => r.new_value ? <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>Data</Button> : null },
        ]}
        data={filtered}
        rowKey={(r) => r.id}
        emptyMessage={loading ? "Loading…" : "No audit entries in this period."}
      />
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.action}` : ""} size="lg">
        {detail && <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, background: "var(--color-surface-raised)", padding: 12, borderRadius: 8, maxHeight: 420, overflow: "auto" }}>
          {(() => { try { return JSON.stringify(JSON.parse(detail.new_value ?? ""), null, 2); } catch { return detail.new_value; } })()}
        </pre>}
      </Modal>
    </div>
  );
}
