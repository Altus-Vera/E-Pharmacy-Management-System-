import { useEffect, useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import api from "../../services/api";
import { formatCurrency } from "../../utils/formatters";
import styles from "./RxCopy.module.css";

export interface RxQueueEntry {
  id: number; queue_date: string; queue_number: number; note: string | null; created_at: string; uploaded_by: string | null;
  invoice_id: number; invoice_number: string; invoice_total: number; invoice_status: string; invoice_at: string;
  customer_name: string | null; doctor_name: string | null; files: { index: number; kind: "image" | "pdf" }[];
}

const OK_TYPES = /^(image\/(jpeg|png|webp)|application\/pdf)$/;
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** Upload the prescription copy for a bill that has just been saved. Returns the queue entry. */
export async function uploadRxCopy(invoiceId: number, files: File[], note?: string): Promise<RxQueueEntry> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  if (note?.trim()) form.append("note", note.trim());
  return (await api.post<RxQueueEntry>(`/invoices/${invoiceId}/rx-copy`, form, { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 })).data;
}

/** Choose the photos (or PDF) of the paper prescription to keep with this bill. Optional. */
export function RxCopyModal({ open, files, note, onClose, onSave }: {
  open: boolean; files: File[]; note: string; onClose: () => void; onSave: (files: File[], note: string) => void;
}) {
  const [list, setList] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => { if (open) { setList(files); setText(note); setErr(""); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const u = list.map((f) => URL.createObjectURL(f)); setUrls(u); return () => u.forEach(URL.revokeObjectURL); }, [list]);

  function add(fl: FileList | File[]) {
    const all = Array.from(fl);
    const ok = all.filter((f) => OK_TYPES.test(f.type) && f.size <= 8_000_000);
    if (ok.length < all.length) setErr("Only JPG, PNG, WebP or PDF up to 8 MB each.");
    setList((p) => [...p, ...ok].slice(0, 4));
  }

  return (
    <Modal open={open} onClose={onClose} title="Keep prescription copy with this bill" size="md"
      footer={<>
        {files.length > 0 && <Button variant="secondary" onClick={() => onSave([], "")}>Remove copy</Button>}
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(list, text)} disabled={!list.length}>Keep {list.length ? `${list.length} page${list.length > 1 ? "s" : ""}` : ""}</Button>
      </>}>
      <p className={styles.hint}>Optional. The copy is saved with the bill when you complete the sale and gets the next number in today's prescription queue. The number is printed on the receipt so the paper can be filed in order.</p>
      <label className={styles.drop} tabIndex={0}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files); }}
        onPaste={(e) => add(Array.from(e.clipboardData.files))}>
        <b>Drop, paste (Ctrl+V) or choose photos / PDF</b>
        <small>Up to 4 pages · use the tablet or phone camera if available</small>
        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" multiple hidden onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }} />
      </label>
      {list.length > 0 && (
        <div className={styles.thumbs}>
          {list.map((f, i) => (
            <div key={i} className={styles.thumb}>
              {f.type === "application/pdf" ? <div className={styles.pdf}>PDF<br /><small>{f.name}</small></div> : <img src={urls[i]} alt={`Page ${i + 1}`} />}
              <button onClick={() => setList((p) => p.filter((_, k) => k !== i))}>✕</button>
            </div>
          ))}
        </div>
      )}
      <input className={styles.inp} placeholder="Note (optional) — e.g. 'patient keeps original'" value={text} onChange={(e) => setText(e.target.value)} />
      {err && <div className={styles.err}>{err}</div>}
    </Modal>
  );
}

/** Image/PDF behind the login: fetched with the token and shown from a blob URL. */
function useFileUrl(entryId: number | null, index: number) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (entryId == null) return;
    let u: string | null = null, live = true;
    api.get(`/bill-rx/${entryId}/files/${index}`, { responseType: "blob" })
      .then((r) => { if (live) { u = URL.createObjectURL(r.data as Blob); setUrl(u); } })
      .catch(() => setUrl(null));
    return () => { live = false; if (u) URL.revokeObjectURL(u); };
  }, [entryId, index]);
  return url;
}

function FileView({ entry, index }: { entry: RxQueueEntry; index: number }) {
  const url = useFileUrl(entry.id, index);
  const kind = entry.files[index]?.kind;
  if (!url) return <div className={styles.loading}>Loading…</div>;
  return kind === "pdf" ? <iframe src={url} title="Prescription PDF" className={styles.pdfView} /> : <img src={url} alt="Prescription" className={styles.imgView} />;
}

/** Today's prescription queue at this POS. */
export function RxQueueModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<RxQueueEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<RxQueueEntry | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!open) return;
    setSel(null); setLoading(true);
    api.get<RxQueueEntry[]>("/bill-rx").then((r) => setRows(r.data)).finally(() => setLoading(false));
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={`Today's prescription queue (${rows.length})`} size="xl">
      <div className={styles.queueWrap}>
        <div className={styles.queueList}>
          {loading && <div className={styles.loading}>Loading…</div>}
          {!loading && rows.length === 0 && <div className={styles.loading}>No prescription copies kept today. Use the “Rx copy” chip on the bill to add one.</div>}
          {rows.map((r) => (
            <button key={r.id} className={`${styles.qRow} ${sel?.id === r.id ? styles.qRowOn : ""}`} onClick={() => { setSel(r); setPage(0); }}>
              <span className={styles.qNo}>#{r.queue_number}</span>
              <span className={styles.qMain}>
                <b>{r.invoice_number}</b>{r.invoice_status === "cancelled" && <span className={styles.void}>VOID</span>}
                <small>{time(r.invoice_at)} · {r.customer_name ?? "Walk-in"} · {formatCurrency(r.invoice_total)} · {r.files.length} page{r.files.length > 1 ? "s" : ""}</small>
              </span>
            </button>
          ))}
        </div>
        <div className={styles.queueView}>
          {sel ? (
            <>
              <div className={styles.viewHead}>
                <b>Queue #{sel.queue_number}</b> · Bill {sel.invoice_number} · {sel.customer_name ?? "Walk-in"}{sel.doctor_name ? ` · Dr. ${sel.doctor_name}` : ""}
                {sel.uploaded_by && <small> · kept by {sel.uploaded_by}</small>}
              </div>
              {sel.note && <div className={styles.hint}>Note: {sel.note}</div>}
              {sel.files.length > 1 && (
                <div className={styles.pages}>{sel.files.map((f) => <button key={f.index} className={page === f.index ? styles.pageOn : ""} onClick={() => setPage(f.index)}>Page {f.index + 1}</button>)}</div>
              )}
              <FileView key={`${sel.id}-${page}`} entry={sel} index={page} />
            </>
          ) : <div className={styles.loading}>Choose a prescription on the left to see the copy.</div>}
        </div>
      </div>
    </Modal>
  );
}
