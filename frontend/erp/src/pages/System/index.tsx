import { useEffect, useState } from "react";
import api from "../../services/api";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Table } from "../../components/ui/Table";
import { formatDateTime } from "../../utils/formatters";
import { apiError } from "../../utils/errors";
import s from "../../styles/erp.module.css";

interface BackupRow { finished_at: string | null; device: string | null; size_bytes: number | null }

const mb = (b: number | null) => (b == null ? "—" : `${(b / 1048576).toFixed(1)} MB`);

export function SystemPage() {
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [health, setHealth] = useState<string>("checking…");

  useEffect(() => { load(); }, []);
  async function load() {
    setError("");
    api.get("/health").then(() => setHealth("Online")).catch(() => setHealth("Unreachable"));
    try { setBackups((await api.get<BackupRow[]>("/admin/backups")).data); }
    catch (e) { setError(apiError(e)); }
  }

  async function backupNow() {
    if (!confirm("Create a full database backup now? This does not change any data.")) return;
    setBusy(true); setMsg(""); setError("");
    try {
      const r = (await api.post<{ file: string; message: string }>("/admin/backup")).data;
      setMsg(`${r.message} File: ${r.file}`);
      await load();
    } catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  }

  const last = backups[0]?.finished_at;
  const daysSince = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null;

  return (
    <div className={s.page}>
      <div className={s.stats}>
        <div className={s.stat}><div className={s.statLabel}>API Status</div><div className={s.statValue} style={{ fontSize: "1.2rem" }}>{health}</div></div>
        <div className={`${s.stat} ${daysSince == null || daysSince > 1 ? s.statDanger : ""}`}>
          <div className={s.statLabel}>Last Backup</div>
          <div className={s.statValue} style={{ fontSize: "1.2rem" }}>{last ? formatDateTime(last) : "Never"}</div>
        </div>
        <div className={`${s.stat} ${s.statInfo}`}><div className={s.statLabel}>Backups on record</div><div className={s.statValue}>{backups.length}</div></div>
      </div>

      <Card title="Database Backup">
        <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", marginTop: 0 }}>
          Writes a full SQL Server backup (.bak) to the database server's default backup folder. Run it at least once a day
          and copy the file to another drive or cloud storage. Backups never modify or delete data.
        </p>
        {msg && <div style={{ background: "var(--color-success-light)", color: "var(--color-success)", border: "1px solid var(--color-success)", padding: "8px 12px", borderRadius: 8, fontWeight: 600, fontSize: 14, marginBottom: 12 }}>{msg}</div>}
        {error && <div className={s.error} style={{ marginBottom: 12 }}>{error}</div>}
        <Button loading={busy} onClick={backupNow}>Back Up Now</Button>
      </Card>

      <Table<BackupRow>
        columns={[
          { key: "finished_at", header: "Completed", render: (r) => (r.finished_at ? formatDateTime(r.finished_at) : "—") },
          { key: "device", header: "File", render: (r) => <code style={{ fontSize: 12 }}>{r.device}</code> },
          { key: "size_bytes", header: "Size", render: (r) => mb(r.size_bytes) },
        ]}
        data={backups}
        rowKey={(r) => `${r.finished_at}-${r.device}`}
        emptyMessage="No backups recorded yet."
      />
    </div>
  );
}
