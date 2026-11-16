import { useEffect, useRef, useState } from "react";
import api from "../../services/api";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { formatCurrency } from "../../utils/formatters";
import type { CalcResult, Drug, FrequencyCode } from "../../types";
import styles from "./RxScan.module.css";

/*
 * Prescription scan: photo(s) from WhatsApp → read by the server (Claude vision) → suggested lines.
 * Handwriting can never be read 100%, so nothing reaches the bill until the cashier has compared
 * every line with the photo and ticked it. They can change the product, dose, frequency and days,
 * remove or add lines, or ask for a fresh reading with a correction note.
 */

interface Match { drug_id: number; brand_name: string; generic_name: string | null; strength: string | null; dosage_form: string | null; quantity: number; score: number }
interface OcrLine {
  line_no: number; raw_text: string; drug_name: string | null; strength: string | null; form: string | null;
  dose: number | null; frequency_code: string | null; frequency_text: string | null; days: number | null; quantity: number | null;
  confidence: "high" | "medium" | "low"; note: string | null; matched_drug_id: number | null; matches: Match[];
}
interface OcrResponse {
  scan_id: string; images: string[];
  result: { patient_name: string | null; doctor_name: string | null; rx_date: string | null; notes: string | null; lines: OcrLine[]; warnings: string[]; model: string };
}
interface Row {
  id: string; raw: string; confidence: OcrLine["confidence"] | "manual"; note: string | null;
  drugId: number | null; matches: Match[]; dose: string; freq: string; days: string; qty: string;
  checked: boolean; calc: CalcResult | null; error: string;
}

const apiError = (e: unknown) => { const x = e as { response?: { data?: { detail?: string } }; message?: string }; return x?.response?.data?.detail ?? x?.message ?? "Request failed"; };
const uid = () => Math.random().toString(36).slice(2);

export function RxScanModal({ open, freqs, onClose, onApply }: {
  open: boolean;
  freqs: FrequencyCode[];
  onClose: () => void;
  /** lines the cashier confirmed: either a days calculation or a plain quantity */
  onApply: (lines: { drug: Drug; calc: CalcResult | null; quantity: number }[], meta: { patient: string | null; doctor: string | null }) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [scan, setScan] = useState<OcrResponse | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [shown, setShown] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [search, setSearch] = useState<{ row: string; q: string; res: Drug[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFiles([]); setPreviews([]); setHint(""); setErr(""); setScan(null); setRows([]); setShown(0); setZoom(1); setSearch(null);
    api.get<{ enabled: boolean }>("/prescriptions/ocr/status").then((r) => setEnabled(r.data.enabled)).catch(() => setEnabled(false));
  }, [open]);

  // paste a photo straight from WhatsApp Desktop / Web (Ctrl+V)
  useEffect(() => {
    if (!open || scan) return;
    const onPaste = (e: ClipboardEvent) => {
      const imgs = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (imgs.length) { e.preventDefault(); addFiles(imgs); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  function addFiles(list: File[]) {
    const imgs = list.filter((f) => /^image\/(jpeg|png|webp|gif)$/.test(f.type));
    if (imgs.length < list.length) setErr("Only JPG, PNG or WebP photos can be read.");
    const next = [...files, ...imgs].slice(0, 4);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  }

  async function read(again = false) {
    setBusy(true); setErr("");
    try {
      const fd = new FormData();
      if (again && scan) fd.append("scanId", scan.scan_id);
      else files.forEach((f) => fd.append("files", f));
      if (hint.trim()) fd.append("hint", hint.trim());
      const r = (await api.post<OcrResponse>("/prescriptions/ocr", fd, { timeout: 180000, headers: { "Content-Type": "multipart/form-data" } })).data;
      setScan(r);
      const next: Row[] = r.result.lines.map((l) => ({
        id: uid(), raw: l.raw_text, confidence: l.confidence, note: l.note,
        drugId: l.matched_drug_id, matches: l.matches,
        dose: String(l.dose ?? 1), freq: l.frequency_code ?? "", days: l.days ? String(l.days) : "", qty: l.quantity ? String(l.quantity) : "",
        checked: false, calc: null, error: "",
      }));
      setRows(next);
      next.forEach((row) => void recalc(row));
    } catch (e) { setErr(apiError(e)); }
    finally { setBusy(false); }
  }

  async function recalc(row: Row) {
    if (!row.drugId || !row.freq || !(+row.days > 0) || !(+row.dose > 0)) { patch(row.id, { calc: null, error: "" }, false); return; }
    try {
      const r = (await api.post<{ items: CalcResult[]; errors: { detail: string }[] }>("/dispense/calculate",
        { items: [{ drug_id: row.drugId, dose: +row.dose, frequency_code: row.freq, days: +row.days }] })).data;
      patch(row.id, { calc: r.items[0] ?? null, error: r.errors[0]?.detail ?? "" }, false);
    } catch (e) { patch(row.id, { calc: null, error: apiError(e) }, false); }
  }

  /** any edit un-ticks the line: the cashier must look again */
  function patch(id: string, p: Partial<Row>, edit = true) {
    setRows((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const n = { ...r, ...p, ...(edit ? { checked: false } : {}) };
      if (edit && ("drugId" in p || "dose" in p || "freq" in p || "days" in p)) void recalc(n);
      return n;
    }));
  }

  useEffect(() => {
    if (!search || search.q.trim().length < 2) return;
    const t = setTimeout(() => {
      api.get<Drug[]>("/drugs", { params: { search: search.q.trim() } })
        .then((r) => setSearch((s) => (s && s.row === search.row ? { ...s, res: r.data.slice(0, 8) } : s))).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [search?.q]); // eslint-disable-line react-hooks/exhaustive-deps

  function pickDrug(row: Row, d: Drug) {
    const m: Match = { drug_id: d.id, brand_name: d.brand_name, generic_name: d.generic_name ?? null, strength: d.strength ?? null, dosage_form: d.dosage_form ?? null, quantity: d.quantity, score: 0 };
    patch(row.id, { drugId: d.id, matches: row.matches.some((x) => x.drug_id === d.id) ? row.matches : [m, ...row.matches] });
    setSearch(null);
  }

  const kept = rows;
  const allChecked = kept.length > 0 && kept.every((r) => r.checked);
  const ready = kept.every((r) => r.drugId && (r.calc?.available || (!r.calc && +r.qty > 0)));
  const total = kept.reduce((s, r) => s + (r.calc?.total ?? 0), 0);

  async function apply() {
    setBusy(true); setErr("");
    try {
      const out: { drug: Drug; calc: CalcResult | null; quantity: number }[] = [];
      for (const r of kept) {
        const drug = (await api.get<Drug>(`/drugs/${r.drugId}`)).data;
        out.push({ drug, calc: r.calc, quantity: r.calc ? 0 : +r.qty });
      }
      if (scan) {
        void api.post(`/prescriptions/ocr/${scan.scan_id}/confirm`, {
          lines: kept.map((r) => ({ raw_text: r.raw, ocr_confidence: r.confidence, drug_id: r.drugId, dose: +r.dose, frequency_code: r.freq, days: +r.days || null, quantity: +r.qty || null })),
          suggested: scan.result.lines.map((l) => ({ raw_text: l.raw_text, drug_id: l.matched_drug_id })),
        }).catch(() => {});
      }
      onApply(out, { patient: scan?.result.patient_name ?? null, doctor: scan?.result.doctor_name ?? null });
    } catch (e) { setErr(apiError(e)); }
    finally { setBusy(false); }
  }

  // the photos attached here stay in the browser; the server copy is only for audit
  const images = previews.length ? previews : (scan?.images ?? []);

  return (
    <Modal open={open} onClose={onClose} title="Scan Prescription (WhatsApp photo)" size="xl"
      footer={scan ? <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="secondary" disabled={busy} onClick={() => void read(true)} title="Read the same photo again, using your correction note">Read again</Button>
        <Button disabled={busy || !allChecked || !ready} onClick={() => void apply()}
          title={!allChecked ? "Tick every line after checking it against the photo" : !ready ? "Every line needs a product and a quantity or days" : ""}>
          Add {kept.length} checked line{kept.length === 1 ? "" : "s"} to bill{total ? ` · ${formatCurrency(total)}` : ""}
        </Button>
      </> : <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={busy || !files.length || enabled === false} onClick={() => void read()}>{busy ? "Reading handwriting…" : "Read prescription"}</Button>
      </>}>
      <div className={styles.wrap}>
        {/* left: the photo, always visible for comparison */}
        <div className={styles.photoCol}>
          {images.length ? <>
            <div className={styles.photoBox}>
              <img src={images[shown]} alt="Prescription" style={{ transform: `scale(${zoom})` }} className={styles.photo} />
            </div>
            <div className={styles.photoBar}>
              {images.map((_, i) => <button key={i} type="button" className={`${styles.thumbBtn} ${i === shown ? styles.thumbOn : ""}`} onClick={() => setShown(i)}>Photo {i + 1}</button>)}
              <span className={styles.spacer} />
              <button type="button" className={styles.thumbBtn} onClick={() => setZoom((z) => Math.max(1, z - 0.5))}>−</button>
              <button type="button" className={styles.thumbBtn} onClick={() => setZoom((z) => Math.min(4, z + 0.5))}>+</button>
            </div>
          </> : (
            <div className={styles.drop} onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles([...e.dataTransfer.files]); }}>
              <div className={styles.dropBig}>Drop the WhatsApp photo here</div>
              <div>or click to choose · or press <kbd>Ctrl</kbd>+<kbd>V</kbd> to paste</div>
              <div className={styles.dropSub}>Prescription photo plus any description photo — up to 4</div>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { addFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
          {!scan && files.length > 0 && files.length < 4 && <button type="button" className={styles.link} onClick={() => fileRef.current?.click()}>+ add another photo</button>}
          <label className={styles.lbl}>{scan ? "Correction note for “Read again”" : "WhatsApp message text (optional)"}
            <textarea className={styles.hint} rows={2} value={hint} onChange={(e) => setHint(e.target.value)}
              placeholder={scan ? "e.g. line 2 is Augmentin 625, not Amoxil" : "e.g. for my mother, 3 days only"} />
          </label>
        </div>

        {/* right: lines to check */}
        <div className={styles.linesCol}>
          {enabled === false && <div className={styles.err}>Prescription reading is not set up on the server (Google GEMINI_API_KEY missing). Ask the administrator.</div>}
          {err && <div className={styles.err}>{err}</div>}
          {!scan && !busy && <div className={styles.help}>
            The photo is read by AI. Handwriting is never 100% certain, so you will check every line against the photo and tick it before it goes on the bill.
          </div>}
          {busy && !scan && <div className={styles.help}>Reading the prescription… this can take 10–30 seconds.</div>}
          {scan && <>
            <div className={styles.meta}>
              {scan.result.patient_name && <span>Patient: <b>{scan.result.patient_name}</b></span>}
              {scan.result.doctor_name && <span>Doctor: <b>{scan.result.doctor_name}</b></span>}
              {scan.result.rx_date && <span>Date: <b>{scan.result.rx_date}</b></span>}
            </div>
            {scan.result.notes && <div className={styles.warn}>Note on prescription: {scan.result.notes}</div>}
            {scan.result.warnings.map((w) => <div key={w} className={styles.warn}>{w}</div>)}
            <div className={styles.progress}>{kept.filter((r) => r.checked).length} of {kept.length} lines checked</div>

            {rows.map((r, i) => {
              return (
                <div key={r.id} className={`${styles.line} ${r.checked ? styles.lineOk : styles[`conf_${r.confidence}`]}`}>
                  <div className={styles.lineHead}>
                    <span className={styles.no}>{i + 1}</span>
                    <span className={styles.raw} title="As written on the prescription">“{r.raw || "added by hand"}”</span>
                    <span className={`${styles.badge} ${styles[`b_${r.confidence}`]}`}>
                      {r.confidence === "manual" ? "Manual" : r.confidence === "high" ? "Clear" : r.confidence === "medium" ? "Check" : "Unsure"}
                    </span>
                    <button type="button" className={styles.remove} title="Remove line" onClick={() => setRows((p) => p.filter((x) => x.id !== r.id))}>✕</button>
                  </div>
                  {r.note && <div className={styles.note}>{r.note}</div>}

                  <div className={styles.grid}>
                    <label className={styles.f}>Product
                      <select value={r.drugId ?? ""} onChange={(e) => e.target.value === "__search" ? setSearch({ row: r.id, q: "", res: [] }) : patch(r.id, { drugId: +e.target.value || null })}>
                        <option value="">— choose —</option>
                        {r.matches.map((m) => <option key={m.drug_id} value={m.drug_id}>{m.brand_name}{m.strength ? ` ${m.strength}` : ""}{m.generic_name ? ` (${m.generic_name})` : ""} · stock {m.quantity}</option>)}
                        <option value="__search">Search another product…</option>
                      </select>
                    </label>
                    <label className={styles.f}>Dose<input type="number" min={0.25} step={0.25} value={r.dose} onChange={(e) => patch(r.id, { dose: e.target.value })} /></label>
                    <label className={styles.f}>How often
                      <select value={r.freq} onChange={(e) => patch(r.id, { freq: e.target.value })}>
                        <option value="">—</option>
                        {freqs.map((f) => <option key={f.code} value={f.code}>{f.code} · {f.description}</option>)}
                      </select>
                    </label>
                    <label className={styles.f}>Days<input inputMode="numeric" value={r.days} onChange={(e) => patch(r.id, { days: e.target.value.replace(/\D/g, "").slice(0, 3) })} /></label>
                    {!r.calc && <label className={styles.f}>Qty<input inputMode="numeric" value={r.qty} onChange={(e) => patch(r.id, { qty: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></label>}
                  </div>
                  {search?.row === r.id && (
                    <div className={styles.search}>
                      <input autoFocus placeholder="Type brand or generic name…" value={search.q} onChange={(e) => setSearch({ ...search, q: e.target.value })} />
                      {search.res.map((d) => <button type="button" key={d.id} onClick={() => pickDrug(r, d)}>{d.brand_name} {d.strength ?? ""} <small>stock {d.quantity}</small></button>)}
                    </div>
                  )}
                  {r.freq === "" && r.drugId && !r.qty && <div className={styles.note}>Written as: {scan.result.lines.find((l) => l.raw_text === r.raw)?.frequency_text ?? "—"} — choose how often, or enter a quantity.</div>}

                  <div className={styles.lineFoot}>
                    <div className={styles.calc}>
                      {r.error ? <span className={styles.errTxt}>{r.error}</span>
                        : r.calc ? <><b>{r.calc.lines.map((l) => l.label).join(" + ")}</b> · {formatCurrency(r.calc.total)}
                          {!r.calc.available && <span className={styles.errTxt}> · not enough stock</span>}
                          <div className={styles.dir}>{r.calc.directions}</div></>
                        : r.drugId ? <span className={styles.muted}>{+r.qty > 0 ? `${r.qty} as written` : "Set days + how often, or a quantity"}</span> : null}
                    </div>
                    <label className={`${styles.check} ${r.checked ? styles.checkOn : ""}`}>
                      <input type="checkbox" checked={r.checked} disabled={!r.drugId} onChange={(e) => patch(r.id, { checked: e.target.checked }, false)} />
                      Checked against photo
                    </label>
                  </div>
                </div>
              );
            })}
            <button type="button" className={styles.link} onClick={() => setRows((p) => [...p, { id: uid(), raw: "", confidence: "manual", note: null, drugId: null, matches: [], dose: "1", freq: "", days: "", qty: "", checked: false, calc: null, error: "" }])}>
              + Add a line the reading missed
            </button>
          </>}
        </div>
      </div>
    </Modal>
  );
}

