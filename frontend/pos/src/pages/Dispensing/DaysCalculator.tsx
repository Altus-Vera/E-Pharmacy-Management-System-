import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../services/api";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { formatCurrency } from "../../utils/formatters";
import { baseUnit, sellMode } from "../../store/cartStore";
import type { CalcResult, CartItem, Drug, FrequencyCode } from "../../types";
import styles from "./DaysCalculator.module.css";

export const DAY_CHIPS = [1, 2, 3, 5, 7, 10, 14, 30];

interface CalcResponse { items: CalcResult[]; errors: { drug_id: number; drug?: string; detail: string }[]; total: number }

async function calculate(items: { drug_id: number; dose: number; frequency_code: string; days: number }[]): Promise<CalcResponse> {
  return (await api.post<CalcResponse>("/dispense/calculate", { items })).data;
}

/** Loose / Strip / Pack chip with the reason as a tooltip. */
export function SellTag({ drug, compact }: { drug: Drug; compact?: boolean }) {
  const mode = sellMode(drug);
  const text = mode === "loose" ? (compact ? "LOOSE" : "Loose OK")
    : mode === "strip" ? `STRIP${drug.units_per_strip ? " ×" + drug.units_per_strip : ""}`
    : `PACK ONLY`;
  return (
    <span className={`${styles.sellTag} ${styles[`sell_${mode}`]}`} title={drug.non_loose_reason ?? (mode === "loose" ? `Can be sold by the ${baseUnit(drug)}` : "")}>
      {text}
    </span>
  );
}

function DayChips({ value, onChange, allowNone }: { value: number | null; onChange: (d: number | null) => void; allowNone?: boolean }) {
  const [custom, setCustom] = useState("");
  return (
    <div className={styles.chips}>
      {allowNone && <button type="button" className={`${styles.chip} ${value === null ? styles.chipOn : ""}`} onClick={() => onChange(null)}>None</button>}
      {DAY_CHIPS.map((d) => (
        <button type="button" key={d} className={`${styles.chip} ${value === d ? styles.chipOn : ""}`} onClick={() => { setCustom(""); onChange(d); }}>{d}d</button>
      ))}
      <input className={styles.chipInput} placeholder="days" inputMode="numeric" value={custom}
        onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 3); setCustom(v); if (+v > 0) onChange(+v); }} />
    </div>
  );
}

/* ── One medicine: "how much for N days?" ─────────────────────────────────── */

export function DaysCalcModal({ open, drug, initial, freqs, onClose, onApply }: {
  open: boolean;
  drug: Drug | null;
  initial?: { dose?: number; frequency_code?: string; days?: number };
  freqs: FrequencyCode[];
  onClose: () => void;
  onApply: (drug: Drug, calc: CalcResult) => void;
}) {
  const [dose, setDose] = useState("1");
  const [freq, setFreq] = useState("TDS");
  const [days, setDays] = useState<number | null>(3);
  const [res, setRes] = useState<CalcResult | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!open || !drug) return;
    setDose(String(initial?.dose ?? drug.default_dose ?? 1));
    setFreq(initial?.frequency_code ?? drug.default_frequency ?? "TDS");
    setDays(initial?.days ?? 3);
    setRes(null); setErr("");
  }, [open, drug?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !drug || !days || !(+dose > 0)) return;
    const my = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await calculate([{ drug_id: drug.id, dose: +dose, frequency_code: freq, days }]);
        if (my !== seq.current) return;
        setRes(r.items[0] ?? null);
        setErr(r.errors[0]?.detail ?? "");
      } catch { if (my === seq.current) setErr("Could not calculate — check the connection."); }
      finally { if (my === seq.current) setBusy(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [open, drug, dose, freq, days]);

  const doseUnit = drug ? (drug.dose_unit || baseUnit(drug)) : "";
  const sos = freqs.find((f) => f.code === freq)?.times_per_day == null;

  return (
    <Modal open={open && !!drug} onClose={onClose} title={`How much for… — ${drug?.brand_name ?? ""}`} size="md"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!res || !res.available || busy || !!err} onClick={() => drug && res && onApply(drug, res)}>
          {res ? `Put on bill · ${formatCurrency(res.total)}` : "Put on bill"}
        </Button>
      </>}>
      {drug && (
        <div className={styles.body}>
          <div className={styles.drugHead}>
            <div>
              <div className={styles.drugName}>{drug.brand_name} <SellTag drug={drug} /></div>
              <div className={styles.drugSub}>{drug.generic_name}{drug.strength ? ` · ${drug.strength}` : ""} · priced per {baseUnit(drug)}
                {drug.units_per_strip ? ` · strip of ${drug.units_per_strip}` : ""}{(drug.pack_size ?? 0) > 1 ? ` · pack of ${drug.pack_size}` : ""}</div>
              {sellMode(drug) !== "loose" && drug.non_loose_reason && <div className={styles.reason}>Not sold loose: {drug.non_loose_reason}</div>}
            </div>
          </div>

          <div className={styles.row3}>
            <label className={styles.lbl}>Dose ({doseUnit})
              <input className={styles.inp} type="number" min={0.25} step={0.25} value={dose} onChange={(e) => setDose(e.target.value)} />
            </label>
            <label className={styles.lbl}>How often
              <select className={styles.inp} value={freq} onChange={(e) => setFreq(e.target.value)}>
                {freqs.map((f) => <option key={f.code} value={f.code}>{f.code} · {f.description}</option>)}
              </select>
            </label>
          </div>
          <div className={styles.lbl}>For how many days</div>
          <DayChips value={days} onChange={setDays} />

          {sos && <div className={styles.warn}>“As needed” has no fixed daily amount — enter the quantity on the bill instead.</div>}
          {err && !sos && <div className={styles.warn}>{err}</div>}
          {res && !err && (
            <div className={styles.result}>
              <div className={styles.resultMain}>
                <div>
                  <div className={styles.resultQty}>{res.lines.map((l) => l.label).join(" + ") || "—"}</div>
                  <div className={styles.resultSub}>Needs {res.units_needed} {res.base_unit}{res.units_needed === 1 ? "" : "s"} · {res.directions}</div>
                </div>
                <div className={styles.resultPrice}>{formatCurrency(res.total)}</div>
              </div>
              {res.lines.length > 1 && (
                <table className={styles.lines}>
                  <tbody>{res.lines.map((l) => (
                    <tr key={`${l.drug_batch_id}-${l.sale_unit}`}>
                      <td>{l.label}</td><td>Batch {l.batch_number ?? "—"}</td>
                      <td className={styles.r}>{formatCurrency(l.unit_price)}</td><td className={styles.r}>{formatCurrency(l.line_total)}</td>
                    </tr>))}</tbody>
                </table>
              )}
              {res.warnings.map((w) => <div key={w} className={styles.warn}>{w}</div>)}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ── Whole bill: "how much for everything for 2 / 3 days?" ────────────────── */

interface Row { drug: Drug; dose: string; freq: string }

export function BillQuoteModal({ open, items, freqs, onClose, onApply, onPrint }: {
  open: boolean;
  items: CartItem[];
  freqs: FrequencyCode[];
  onClose: () => void;
  onApply: (results: { drug: Drug; calc: CalcResult }[]) => void;
  onPrint: (results: { drug: Drug; calc: CalcResult }[], days: number) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [daysA, setDaysA] = useState<number | null>(3);
  const [daysB, setDaysB] = useState<number | null>(null);
  const [resA, setResA] = useState<CalcResponse | null>(null);
  const [resB, setResB] = useState<CalcResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!open) return;
    const seen = new Map<number, Row>();
    for (const i of items) if (!seen.has(i.drug.id))
      seen.set(i.drug.id, { drug: i.drug, dose: String(i.dose ?? i.drug.default_dose ?? 1), freq: i.frequency_code ?? i.drug.default_frequency ?? "TDS" });
    setRows([...seen.values()]);
    setDaysA(items.find((i) => i.days)?.days ?? 3);
    setDaysB(null); setResA(null); setResB(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !rows.length || !daysA) return;
    const my = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      const body = (d: number) => rows.filter((r) => +r.dose > 0).map((r) => ({ drug_id: r.drug.id, dose: +r.dose, frequency_code: r.freq, days: d }));
      try {
        const [a, b] = await Promise.all([calculate(body(daysA)), daysB ? calculate(body(daysB)) : Promise.resolve(null)]);
        if (my !== seq.current) return;
        setResA(a); setResB(b);
      } catch { /* keep the last result */ }
      finally { if (my === seq.current) setBusy(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [open, rows, daysA, daysB]);

  const find = (r: CalcResponse | null, id: number) => r?.items.find((x) => x.drug_id === id);
  const errOf = (r: CalcResponse | null, id: number) => r?.errors.find((x) => x.drug_id === id)?.detail;
  const results = useMemo(() => rows.flatMap((r) => { const c = find(resA, r.drug.id); return c ? [{ drug: r.drug, calc: c }] : []; }), [rows, resA]);
  const unavailable = results.some((x) => !x.calc.available);
  const setRow = (id: number, patch: Partial<Row>) => setRows((p) => p.map((r) => (r.drug.id === id ? { ...r, ...patch } : r)));

  return (
    <Modal open={open} onClose={onClose} title="Days Quote — whole bill" size="lg"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Button variant="secondary" disabled={!results.length || busy} onClick={() => daysA && onPrint(results, daysA)}>Print Quote ({daysA}d)</Button>
        <Button disabled={!results.length || busy || unavailable} onClick={() => onApply(results)}>
          Put {daysA}-day quantities on bill · {formatCurrency(resA?.total ?? 0)}
        </Button>
      </>}>
      <div className={styles.body}>
        <div className={styles.quoteBar}>
          <div><div className={styles.lbl}>Quote for</div><DayChips value={daysA} onChange={(d) => setDaysA(d ?? 3)} /></div>
          <div><div className={styles.lbl}>Compare with</div><DayChips value={daysB} onChange={setDaysB} allowNone /></div>
        </div>
        <table className={styles.quote}>
          <thead>
            <tr>
              <th>Medicine</th><th>Dose</th><th>How often</th>
              <th className={styles.r}>{daysA}d quantity</th><th className={styles.r}>{daysA}d price</th>
              {daysB && <><th className={styles.r}>{daysB}d quantity</th><th className={styles.r}>{daysB}d price</th></>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const a = find(resA, r.drug.id); const b = find(resB, r.drug.id);
              const ea = errOf(resA, r.drug.id);
              return (
                <tr key={r.drug.id}>
                  <td><div className={styles.qName}>{r.drug.brand_name}</div><SellTag drug={r.drug} compact /></td>
                  <td><input className={styles.qInp} type="number" min={0.25} step={0.25} value={r.dose} onChange={(e) => setRow(r.drug.id, { dose: e.target.value })} />
                    <span className={styles.qUnit}>{r.drug.dose_unit || baseUnit(r.drug)}</span></td>
                  <td><select className={styles.qSel} value={r.freq} onChange={(e) => setRow(r.drug.id, { freq: e.target.value })}>
                    {freqs.map((f) => <option key={f.code} value={f.code}>{f.code}</option>)}
                  </select></td>
                  {ea ? <td colSpan={daysB ? 4 : 2} className={styles.qErr}>{ea} — line left as it is</td> : <>
                    <td className={styles.r}>{a ? a.lines.map((l) => l.label).join(" + ") : "…"}
                      {a?.extra_units ? <div className={styles.qExtra}>+{a.extra_units} extra (rounding)</div> : null}
                      {a && !a.available && <div className={styles.qErr}>not enough stock</div>}</td>
                    <td className={styles.r}><strong>{a ? formatCurrency(a.total) : "…"}</strong></td>
                    {daysB && <>
                      <td className={styles.r}>{b ? b.lines.map((l) => l.label).join(" + ") : "…"}</td>
                      <td className={styles.r}><strong>{b ? formatCurrency(b.total) : "…"}</strong></td>
                    </>}
                  </>}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Total {busy && <span className={styles.qBusy}>updating…</span>}</td>
              <td colSpan={2} className={styles.r}><span className={styles.qTotal}>{formatCurrency(resA?.total ?? 0)}</span></td>
              {daysB && <td colSpan={2} className={styles.r}><span className={styles.qTotal}>{formatCurrency(resB?.total ?? 0)}</span></td>}
            </tr>
          </tfoot>
        </table>
        {results.flatMap((x) => x.calc.warnings.filter((w) => !w.startsWith("Rounded") && !w.startsWith("Sold in")).map((w) => <div key={x.drug.id + w} className={styles.warn}>{x.drug.brand_name}: {w}</div>))}
      </div>
    </Modal>
  );
}
