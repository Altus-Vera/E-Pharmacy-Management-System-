import { useEffect, useState } from "react";
import api from "../../services/api";
import { apiError } from "../../utils/errors";
import s from "./PrescriptionForm.module.css";

export interface RxDoctor { id: number; name: string; slmc_reg_no?: string | null; slmc_reg_number?: string | null; specialization?: string | null }
export interface RxCreated { id: number; customer_id: number; doctor_id: number | null; issue_date: string; scan_file_path: string | null; drug_details_text: string | null; reproduce_type: string; valid_days: number | null; valid_months: number | null }

interface Props {
  customerId: number;
  customerName: string;
  initialDoctor?: RxDoctor | null;
  onSaved: (rx: RxCreated) => void;
  onCancel: () => void;
}

/**
 * New prescription with scanned copy and OCR (System Requirements: Prescription Management).
 * OCR runs in the browser with tesseract.js; the pharmacist reviews the text before saving.
 */
export function PrescriptionForm({ customerId, customerName, initialDoctor, onSaved, onCancel }: Props) {
  const [doctor, setDoctor] = useState<RxDoctor | null>(initialDoctor ?? null);
  const [docQ, setDocQ] = useState("");
  const [docResults, setDocResults] = useState<RxDoctor[]>([]);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [reproduce, setReproduce] = useState<"onetime" | "recurrent">("onetime");
  const [validDays, setValidDays] = useState(30);
  const [validMonths, setValidMonths] = useState(0);
  const [details, setDetails] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ocrState, setOcrState] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (docQ.trim().length < 2) { setDocResults([]); return; }
    const t = window.setTimeout(() => {
      api.get<RxDoctor[]>("/doctors", { params: { search: docQ.trim() } }).then((r) => setDocResults(r.data.slice(0, 8))).catch(() => setDocResults([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [docQ]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function pickFile(f: File | null) {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f && f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }

  async function runOcr() {
    if (!file || !file.type.startsWith("image/")) { setError("OCR needs an image scan (JPG or PNG)."); return; }
    setError(""); setOcrState("Loading OCR engine…");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: (m: { status: string; progress: number }) => setOcrState(`${m.status} ${Math.round((m.progress ?? 0) * 100)}%`),
      });
      const { data } = await worker.recognize(file);
      await worker.terminate();
      const text = data.text.replace(/\n{3,}/g, "\n\n").trim();
      setDetails((d) => (d ? `${d}\n${text}` : text));
      setOcrState(text ? `Read ${text.length} characters — please check and correct.` : "No text found in the image.");
    } catch (e) {
      setOcrState("");
      setError(`OCR failed: ${apiError(e)}`);
    }
  }

  async function save() {
    if (!file) { setError("Attach the scanned copy of the prescription."); return; }
    if (reproduce === "onetime" && validDays <= 0 && validMonths <= 0) { setError("Enter a valid period."); return; }
    setSaving(true); setError("");
    try {
      const rx = (await api.post<RxCreated>("/prescriptions", {
        customer_id: customerId, doctor_id: doctor?.id ?? null, issue_date: issueDate,
        drug_details_text: details || null, reproduce_type: reproduce,
        valid_days: validDays || null, valid_months: validMonths || null,
      })).data;
      const form = new FormData();
      form.append("file", file);
      const withScan = (await api.post<RxCreated>(`/prescriptions/${rx.id}/scan`, form, { headers: { "Content-Type": "multipart/form-data" } })).data;
      onSaved(withScan);
    } catch (e) { setError(apiError(e)); }
    finally { setSaving(false); }
  }

  return (
    <div className={s.wrap}>
      {error && <div className={s.error}>{error}</div>}
      <div className={s.grid}>
        <div className={s.field}><span className={s.label}>Customer</span><div className={s.static}>{customerName}</div></div>
        <div className={s.field} style={{ position: "relative" }}>
          <span className={s.label}>Prescribing Doctor</span>
          {doctor ? (
            <div className={s.chip}>
              <span><strong>{doctor.name}</strong> · SLMC {doctor.slmc_reg_no ?? doctor.slmc_reg_number ?? "—"}</span>
              <button type="button" onClick={() => setDoctor(null)}>✕</button>
            </div>
          ) : (
            <>
              <input className={s.input} placeholder="Search name or SLMC number…" value={docQ} onChange={(e) => setDocQ(e.target.value)} />
              {docResults.length > 0 && (
                <ul className={s.list}>
                  {docResults.map((d) => <li key={d.id} onMouseDown={() => { setDoctor(d); setDocQ(""); setDocResults([]); }}><strong>{d.name}</strong> · SLMC {d.slmc_reg_no ?? d.slmc_reg_number ?? "—"} {d.specialization ? `· ${d.specialization}` : ""}</li>)}
                </ul>
              )}
            </>
          )}
        </div>
        <div className={s.field}><span className={s.label}>Issue Date</span><input className={s.input} type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
        <div className={s.field}>
          <span className={s.label}>Reproduce</span>
          <select className={s.input} value={reproduce} onChange={(e) => setReproduce(e.target.value as "onetime" | "recurrent")}>
            <option value="onetime">One time</option>
            <option value="recurrent">Recurrent</option>
          </select>
        </div>
        <div className={s.field}><span className={s.label}>Valid (days)</span><input className={s.input} type="number" min={0} value={validDays} onChange={(e) => setValidDays(parseInt(e.target.value) || 0)} /></div>
        <div className={s.field}><span className={s.label}>Valid (months)</span><input className={s.input} type="number" min={0} value={validMonths} onChange={(e) => setValidMonths(parseInt(e.target.value) || 0)} /></div>
        <div className={`${s.field} ${s.full}`}>
          <span className={s.label}>Scanned Copy * (image or PDF)</span>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
        </div>
        {preview && <div className={s.full}><img src={preview} alt="Prescription scan" className={s.preview} /></div>}
        <div className={`${s.field} ${s.full}`}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span className={s.label}>Drug Details (text)</span>
            <button type="button" className={s.ocrBtn} disabled={!preview || ocrState.startsWith("recogn") || ocrState.startsWith("Loading")} onClick={runOcr}>🔍 Read from scan (OCR)</button>
          </div>
          <textarea className={s.input} rows={5} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Drug names, strengths, dosage — type or use OCR" />
          {ocrState && <span className={s.hint}>{ocrState}</span>}
        </div>
      </div>
      <div className={s.footer}>
        <button type="button" className={s.secondary} onClick={onCancel}>Cancel</button>
        <button type="button" className={s.primary} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save Prescription"}</button>
      </div>
    </div>
  );
}
