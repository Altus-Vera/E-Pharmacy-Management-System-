import { useEffect, useState } from "react";
import api from "../../services/api";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { formatCurrency, formatDateTime } from "../../utils/formatters";
import { apiError } from "../../utils/errors";
import s from "../../styles/erp.module.css";

interface Entry {
  id: number; queue_date: string; queue_number: number; note: string | null; created_at: string; uploaded_by: string | null;
  invoice_id: number; invoice_number: string; invoice_total: number; invoice_status: string; invoice_at: string;
  customer_name: string | null; doctor_name: string | null; files: { index: number; kind: "image" | "pdf" }[];
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** Prescription copies kept with POS bills, one queue per day. */
export function RxQueuePage() {
  const [date, setDate] = useState(today());
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sel, setSel] = useState<Entry | null>(null);
  const [page, setPage] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = (await api.get<Entry[]>("/bill-rx", { params: { date, search: q.trim() || undefined } })).data;
      setRows(r); setError("");
      setSel((cur) => (cur ? r.find((x) => x.id === cur.id) ?? null : r[0] ?? null));
    } catch (e) { setError(apiError(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [date]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(() => void load(), 350); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  // files are behind the login: fetch with the token, show from a blob URL
  useEffect(() => {
    setUrl(null);
    if (!sel) return;
    let u: string | null = null, live = true;
    api.get(`/bill-rx/${sel.id}/files/${page}`, { responseType: "blob" })
      .then((r) => { if (live) { u = URL.createObjectURL(r.data as Blob); setUrl(u); } })
      .catch(() => setUrl(null));
    return () => { live = false; if (u) URL.revokeObjectURL(u); };
  }, [sel, page]);

  function printList() {
    const body = rows.map((r) => `<tr><td style="font-weight:700;font-size:16px">#${r.queue_number}</td><td>${time(r.invoice_at)}</td><td>${r.invoice_number}${r.invoice_status === "cancelled" ? " (VOID)" : ""}</td><td>${(r.customer_name ?? "Walk-in").replace(/</g, "&lt;")}</td><td>${r.doctor_name ? "Dr. " + r.doctor_name.replace(/</g, "&lt;") : ""}</td><td style="text-align:right">${formatCurrency(r.invoice_total)}</td><td>${r.files.length}</td><td style="width:90px"></td></tr>`).join("");
    const w = window.open("", "_blank", "width=900,height=900");
    if (!w) return;
    w.document.write(`<html><head><title>Prescription queue ${date}</title><style>body{font-family:Arial;font-size:13px;margin:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #999;padding:6px;text-align:left}th{background:#eee}</style></head><body>
      <h2 style="margin:0">Prescription queue — ${date}</h2><div style="margin:4px 0 12px">${rows.length} prescriptions kept with bills</div>
      <table><thead><tr><th>Queue</th><th>Time</th><th>Bill</th><th>Patient</th><th>Doctor</th><th>Bill total</th><th>Pages</th><th>Filed ✓</th></tr></thead><tbody>${body}</tbody></table>
      <script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  }

  return (
    <div className={s.page}>
      <div className={s.stats}>
        <div className={s.stat}><div className={s.statLabel}>Prescriptions in queue</div><div className={s.statValue}>{rows.length}</div></div>
        <div className={`${s.stat} ${s.statInfo}`}><div className={s.statLabel}>Bills total</div><div className={s.statValue}>{formatCurrency(rows.filter((r) => r.invoice_status !== "cancelled").reduce((a, r) => a + r.invoice_total, 0))}</div></div>
        <div className={`${s.stat} ${s.statWarn}`}><div className={s.statLabel}>Last number</div><div className={s.statValue}>{rows.length ? `#${rows[rows.length - 1].queue_number}` : "—"}</div></div>
      </div>

      <div className={s.toolbar}>
        <input className={s.search} style={{ minWidth: 0 }} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input className={s.search} placeholder="Search bill #, patient or note…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className={s.spacer} />
        <Button variant="secondary" onClick={() => void load()}>↻ Refresh</Button>
        <Button variant="secondary" onClick={printList} disabled={!rows.length}>Print queue list</Button>
        <Button onClick={() => setAttachOpen(true)}>+ Attach copy to a bill</Button>
      </div>
      {error && <div className={s.error}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "70vh", overflow: "auto" }}>
          {loading && <div className={s.muted}>Loading…</div>}
          {!loading && rows.length === 0 && <div className={s.muted}>No prescription copies were kept on this day.</div>}
          {rows.map((r) => (
            <div key={r.id} onClick={() => { setSel(r); setPage(0); }}
              className={s.stat} style={{ cursor: "pointer", display: "flex", gap: 12, alignItems: "center", padding: 10, borderLeftColor: sel?.id === r.id ? "var(--color-primary)" : "var(--color-border)", background: sel?.id === r.id ? "var(--color-primary-light)" : undefined }}>
              <div style={{ minWidth: 52, height: 52, borderRadius: 10, background: "var(--color-primary)", color: "#fff", fontWeight: 800, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>#{r.queue_number}</div>
              <div style={{ minWidth: 0 }}>
                <div className={s.strong}>{r.invoice_number} {r.invoice_status === "cancelled" && <Badge variant="danger">Void</Badge>}</div>
                <div className={s.muted}>{time(r.invoice_at)} · {r.customer_name ?? "Walk-in"} · {formatCurrency(r.invoice_total)}</div>
                <div className={s.muted}>{r.files.length} page{r.files.length > 1 ? "s" : ""}{r.uploaded_by ? ` · kept by ${r.uploaded_by}` : ""}</div>
              </div>
            </div>
          ))}
        </div>

        <div className={s.stat} style={{ minHeight: 400, display: "flex", flexDirection: "column", gap: 8 }}>
          {sel ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div><b style={{ fontSize: 18 }}>Queue #{sel.queue_number}</b> · Bill <b>{sel.invoice_number}</b> · {formatDateTime(sel.invoice_at)}</div>
                {url && <a href={url} download={`rx-queue-${sel.queue_date}-${sel.queue_number}-p${page + 1}${sel.files[page]?.kind === "pdf" ? ".pdf" : ".jpg"}`}><Button size="sm" variant="secondary">Download page</Button></a>}
              </div>
              <div className={s.muted}>
                Patient: <b>{sel.customer_name ?? "Walk-in"}</b>{sel.doctor_name ? <> · Doctor: <b>Dr. {sel.doctor_name}</b></> : null} · Bill total {formatCurrency(sel.invoice_total)}
                {sel.uploaded_by ? ` · kept by ${sel.uploaded_by} at ${time(sel.created_at)}` : ""}
              </div>
              {sel.note && <div className={s.muted}>Note: {sel.note}</div>}
              {sel.files.length > 1 && (
                <div style={{ display: "flex", gap: 6 }}>
                  {sel.files.map((f) => <Button key={f.index} size="sm" variant={page === f.index ? "primary" : "secondary"} onClick={() => setPage(f.index)}>Page {f.index + 1}</Button>)}
                </div>
              )}
              {!url ? <div className={s.muted}>Loading copy…</div>
                : sel.files[page]?.kind === "pdf" ? <iframe src={url} title="Prescription" style={{ width: "100%", height: "62vh", border: "none" }} />
                : <img src={url} alt="Prescription copy" style={{ maxWidth: "100%", maxHeight: "62vh", objectFit: "contain", alignSelf: "center" }} />}
            </>
          ) : <div className={s.muted}>Choose a prescription on the left.</div>}
        </div>
      </div>

      <AttachModal open={attachOpen} onClose={() => setAttachOpen(false)} onDone={(e) => { setAttachOpen(false); setDate(e.queue_date); void load(); setSel(e); }} />
    </div>
  );
}

/** Attach a copy to a bill after the sale (e.g. the upload failed at the counter, or the patient brought it later). */
function AttachModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (e: Entry) => void }) {
  const [billNo, setBillNo] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setBillNo(""); setFiles([]); setNote(""); setError(""); } }, [open]);

  async function save() {
    setError("");
    const t = billNo.trim().toLowerCase();
    if (!t) { setError("Enter the bill (invoice) number."); return; }
    if (!files.length) { setError("Choose the prescription photo or PDF."); return; }
    setBusy(true);
    try {
      const list = (await api.get<{ id: number; invoice_number: string }[]>("/invoices")).data;
      const inv = list.find((i) => i.invoice_number.toLowerCase() === t) ?? list.find((i) => i.invoice_number.toLowerCase().endsWith(t));
      if (!inv) { setError("No bill found with that number."); return; }
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      if (note.trim()) form.append("note", note.trim());
      onDone((await api.post<Entry>(`/invoices/${inv.id}/rx-copy`, form, { headers: { "Content-Type": "multipart/form-data" } })).data);
    } catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Attach prescription copy to a bill" size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Attach"}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label className={s.field}><span className={s.fieldLabel}>Bill number</span>
          <input className={s.search} value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="e.g. INV-1795058309826 or the last digits" autoFocus /></label>
        <label className={s.field}><span className={s.fieldLabel}>Prescription photo(s) or PDF — up to 4</span>
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 4))} /></label>
        <label className={s.field}><span className={s.fieldLabel}>Note (optional)</span>
          <input className={s.search} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <div className={s.muted}>If the bill already has a copy, these pages are added to it. Otherwise it gets the next number in that day's queue.</div>
        {error && <div className={s.error}>{error}</div>}
      </div>
    </Modal>
  );
}
