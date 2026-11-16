import { useEffect, useState } from "react";
import api from "../../services/api";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { DrugPicker } from "../../components/ui/DrugPicker";
import { apiError } from "../../utils/errors";
import type { GrnItemCreate } from "../../services/grn.service";

interface Match { drug_id: number; brand_name: string; strength: string | null }
interface InvLine {
  raw_text: string; product_name: string | null; strength: string | null; pack_size: string | null;
  batch_number: string | null; expiry_date: string | null; quantity: number | null; free_quantity: number | null;
  unit_cost: number | null; line_total: number | null; confidence: "high" | "medium" | "low"; note: string | null;
  matched_drug_id: number | null; matches: Match[];
}
interface InvResult {
  supplier_name: string | null; matched_supplier_id: number | null; invoice_number: string | null; invoice_date: string | null;
  total_amount: number | null; lines: InvLine[]; warnings: string[]; model: string;
}
interface Row {
  raw: string; confidence: InvLine["confidence"]; note: string | null; matches: Match[]; pack: string | null;
  drug_id: number; batch: string; expiry: string; qty: number; free: number; per: number; cost: number; checked: boolean;
}
export interface InvoiceApply { supplier_id?: number; received_date?: string; notes?: string; items: GrnItemCreate[] }

const badge = (c: string) => {
  const [bg, fg, t] = c === "high" ? ["#dcfce7", "#166534", "Clear"] : c === "medium" ? ["#fef3c7", "#92400e", "Check"] : ["#fee2e2", "#991b1b", "Unsure"];
  return <span style={{ background: bg, color: fg, borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>{t}</span>;
};
const inp: React.CSSProperties = { width: "100%", padding: "4px 6px", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 13 };
const today = new Date().toISOString().split("T")[0];

/**
 * Scan a supplier invoice → review every line against the photo → fill the GRN form.
 * Separate from saving: the normal GRN form (and its checks) still decides what goes into stock.
 */
export function InvoiceScanModal({ open, onClose, onApply }: { open: boolean; onClose: () => void; onApply: (a: InvoiceApply) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [res, setRes] = useState<InvResult | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [zoom, setZoom] = useState(1);

  useEffect(() => { if (!open) { setFiles([]); setRes(null); setRows([]); setError(""); setHint(""); setZoom(1); } }, [open]);
  useEffect(() => { const u = files.map(f => URL.createObjectURL(f)); setPreviews(u); return () => u.forEach(URL.revokeObjectURL); }, [files]);

  function addFiles(list: FileList | File[]) {
    const ok = Array.from(list).filter(f => /^image\/(jpeg|png|webp|gif)$/.test(f.type));
    setFiles(prev => [...prev, ...ok].slice(0, 4));
  }

  async function read() {
    if (!files.length) { setError("Attach a photo of the invoice."); return; }
    setBusy(true); setError("");
    try {
      const form = new FormData();
      files.forEach(f => form.append("files", f));
      if (hint.trim()) form.append("hint", hint.trim());
      const r = (await api.post<{ result: InvResult }>("/grn/ocr", form, { timeout: 180000, headers: { "Content-Type": "multipart/form-data" } })).data.result;
      setRes(r);
      setRows(r.lines.map(l => ({
        raw: l.raw_text, confidence: l.confidence, note: l.note, matches: l.matches, pack: l.pack_size,
        drug_id: l.matched_drug_id ?? 0, batch: l.batch_number ?? "", expiry: l.expiry_date ?? "",
        qty: l.quantity ?? 0, free: l.free_quantity ?? 0, per: 1,
        cost: l.unit_cost ?? (l.line_total && l.quantity ? +(l.line_total / l.quantity).toFixed(2) : 0), checked: false,
      })));
    } catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  }

  const set = (i: number, patch: Partial<Row>) => setRows(prev => prev.map((r, k) => k === i ? { ...r, ...patch, checked: "checked" in patch ? !!patch.checked : false } : r));
  const allChecked = rows.length > 0 && rows.every(r => r.checked);
  const sum = rows.reduce((s, r) => s + r.qty * r.cost, 0);

  function apply() {
    if (rows.some(r => !r.drug_id || r.qty <= 0)) { setError("Every line needs a product and a quantity — fix or remove it."); return; }
    const items: GrnItemCreate[] = [];
    for (const r of rows) {
      const per = r.per > 0 ? r.per : 1;
      const base = { drug_id: r.drug_id, batch_number: r.batch.trim() || undefined, expiry_date: r.expiry || undefined };
      items.push({ ...base, quantity_received: r.qty * per, unit_cost: +(r.cost / per).toFixed(4), is_free_goods: false });
      if (r.free > 0) items.push({ ...base, quantity_received: r.free * per, unit_cost: 0, is_free_goods: true });
    }
    const notes = [res?.invoice_number ? `Invoice ${res.invoice_number}` : null, res?.invoice_date ? `dated ${res.invoice_date}` : null, "(read from photo)"].filter(Boolean).join(" ");
    onApply({
      supplier_id: res?.matched_supplier_id ?? undefined,
      received_date: res?.invoice_date && /^\d{4}-\d{2}-\d{2}$/.test(res.invoice_date) && res.invoice_date <= today ? res.invoice_date : undefined,
      notes, items,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Scan supplier invoice" size="xl">
      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 0.8fr) 2fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {previews.length ? (
            <div style={{ maxHeight: "62vh", overflow: "auto", border: "1px solid var(--color-border)", borderRadius: 8, background: "#0f172a" }}>
              {previews.map((u, i) => <img key={i} src={u} alt={`Invoice page ${i + 1}`} style={{ width: `${zoom * 100}%`, display: "block" }} />)}
            </div>
          ) : (
            <label onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
              onPaste={e => addFiles(Array.from(e.clipboardData.files))} tabIndex={0}
              style={{ minHeight: 300, border: "2px dashed #94a3b8", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", textAlign: "center", padding: 16 }}>
              <b>Drop, paste (Ctrl+V) or choose invoice photos</b>
              <small style={{ color: "var(--color-text-muted)" }}>Up to 4 pages · JPG / PNG / WebP · max 5 MB each</small>
              <input type="file" accept="image/*" multiple hidden onChange={e => e.target.files && addFiles(e.target.files)} />
            </label>
          )}
          {previews.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Button size="sm" variant="ghost" onClick={() => setZoom(z => Math.max(1, z - 0.5))}>−</Button>
              <Button size="sm" variant="ghost" onClick={() => setZoom(z => Math.min(4, z + 0.5))}>+ Zoom</Button>
              {!res && <Button size="sm" variant="ghost" onClick={() => setFiles([])}>Clear photos</Button>}
            </div>
          )}
          {!res && <input style={inp} placeholder="Optional note for the reader (e.g. 'quantities are in boxes of 10')" value={hint} onChange={e => setHint(e.target.value)} />}
          {!res && <Button variant="primary" onClick={read} disabled={busy || !files.length}>{busy ? "Reading invoice… (10–40 s)" : "Read invoice with AI"}</Button>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, minWidth: 0 }}>
          {error && <div style={{ color: "var(--color-danger)", background: "var(--color-danger-light)", padding: 8, borderRadius: 6 }}>{error}</div>}
          {!res && !error && <div style={{ color: "var(--color-text-muted)" }}>The AI reads product, batch, expiry, quantity and cost from the invoice. You check every line against the photo, then it fills the GRN form. Nothing is added to stock until you press “Create GRN”.</div>}
          {res && (
            <>
              <div>
                Supplier: <b>{res.supplier_name ?? "—"}</b>{res.supplier_name && !res.matched_supplier_id && <span style={{ color: "#b45309" }}> (not in list — pick in form)</span>}
                {" · "}Invoice <b>{res.invoice_number ?? "—"}</b> · Date <b>{res.invoice_date ?? "—"}</b>
                {res.total_amount != null && <> · Invoice total <b>Rs. {res.total_amount.toFixed(2)}</b> · Lines add up to <b style={{ color: Math.abs(sum - res.total_amount) > 1 ? "#b45309" : undefined }}>Rs. {sum.toFixed(2)}</b></>}
              </div>
              {res.warnings.map((w, i) => <div key={i} style={{ color: "#92400e", background: "#fef3c7", padding: "4px 8px", borderRadius: 6 }}>{w}</div>)}
              <div style={{ maxHeight: "55vh", overflow: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {rows.map((r, i) => (
                  <div key={i} style={{ border: `1.5px solid ${r.checked ? "#86efac" : "var(--color-border)"}`, borderRadius: 8, padding: 8, background: r.checked ? "#f0fdf4" : undefined }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <b>{i + 1}.</b> <i style={{ flex: 1 }}>“{r.raw}”</i> {badge(r.confidence)}
                      <button onClick={() => setRows(p => p.filter((_, k) => k !== i))} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--color-danger)" }}>✕</button>
                    </div>
                    {r.note && <div style={{ color: "#b45309", marginBottom: 6 }}>{r.note}</div>}
                    <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr", gap: 6, alignItems: "end" }}>
                      <div>
                        {r.matches.length > 0 && (
                          <select style={{ ...inp, marginBottom: 4 }} value={r.matches.some(m => m.drug_id === r.drug_id) ? r.drug_id : ""} onChange={e => set(i, { drug_id: Number(e.target.value) })}>
                            <option value="">— suggestions —</option>
                            {r.matches.map(m => <option key={m.drug_id} value={m.drug_id}>{m.brand_name}{m.strength ? ` ${m.strength}` : ""}</option>)}
                          </select>
                        )}
                        <DrugPicker label="Product" value={r.drug_id} onChange={d => set(i, { drug_id: d?.id ?? 0 })} />
                      </div>
                      <label>Batch<input style={inp} value={r.batch} onChange={e => set(i, { batch: e.target.value })} /></label>
                      <label>Expiry<input style={inp} type="date" value={r.expiry} onChange={e => set(i, { expiry: e.target.value })} /></label>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr) 1.3fr", gap: 6, marginTop: 6, alignItems: "end" }}>
                      <label>Qty (as invoiced)<input style={inp} type="number" min={0} value={r.qty} onChange={e => set(i, { qty: parseInt(e.target.value) || 0 })} /></label>
                      <label>Free qty<input style={inp} type="number" min={0} value={r.free} onChange={e => set(i, { free: parseInt(e.target.value) || 0 })} /></label>
                      <label title="If the invoice counts boxes/cards, enter units in each (e.g. 100 tablets per box)">Units each{r.pack && <small style={{ color: "var(--color-text-muted)" }}> ({r.pack})</small>}<input style={inp} type="number" min={1} value={r.per} onChange={e => set(i, { per: parseInt(e.target.value) || 1 })} /></label>
                      <label>Cost each (Rs.)<input style={inp} type="number" step="0.01" min={0} value={r.cost} onChange={e => set(i, { cost: parseFloat(e.target.value) || 0 })} /></label>
                      <label style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 700, cursor: "pointer" }}>
                        <input type="checkbox" checked={r.checked} onChange={e => set(i, { checked: e.target.checked })} style={{ width: 18, height: 18 }} /> Checked against photo
                      </label>
                    </div>
                    {r.per > 1 && <div style={{ color: "var(--color-text-muted)", marginTop: 4 }}>Stock in: {r.qty * r.per}{r.free ? ` + ${r.free * r.per} free` : ""} units at Rs. {(r.cost / r.per).toFixed(2)} each</div>}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
                <Button size="sm" variant="ghost" onClick={() => setRows(p => [...p, { raw: "(added by hand)", confidence: "high", note: null, matches: [], pack: null, drug_id: 0, batch: "", expiry: "", qty: 1, free: 0, per: 1, cost: 0, checked: false }])}>+ Add line</Button>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="ghost" onClick={() => { setRes(null); setRows([]); }}>Read again</Button>
                  <Button variant="primary" disabled={!allChecked} onClick={apply}>
                    {allChecked ? `Fill GRN with ${rows.length} line${rows.length === 1 ? "" : "s"}` : `Tick all lines (${rows.filter(r => r.checked).length}/${rows.length})`}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
