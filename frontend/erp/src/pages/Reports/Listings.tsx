import { useEffect, useState } from "react";
import api from "../../services/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { DrugPicker } from "../../components/ui/DrugPicker";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { apiError, exportCsv } from "../../utils/errors";
import s from "../../styles/erp.module.css";

interface Col { key: string; label: string; type: "text" | "num" | "money" | "date" }
interface ListingResult { title: string; columns: Col[]; rows: Record<string, unknown>[] }

const iso = (d: Date) => d.toISOString().slice(0, 10);
const NO_DATES = new Set(["pending-purchase-orders", "supplier-items", "stock-balance", "stock-taking", "stock-age-qty", "stock-age-value", "expiry-dates", "reorder-items", "bin-card", "stock-valuation-asat"]);

function cell(v: unknown, type: Col["type"]) {
  if (v == null || v === "") return "—";
  if (type === "money") return formatCurrency(Number(v));
  if (type === "num") return Number(v).toLocaleString();
  if (type === "date") return formatDate(String(v));
  return String(v);
}

/** Pharmacy-chain listing reports (System Requirements, "Reports available in the systems in Pharmacy Chains"). */
export function ListingsReport() {
  const [catalog, setCatalog] = useState<{ key: string; label: string }[]>([]);
  const [key, setKey] = useState("purchase-orders");
  const [from, setFrom] = useState(iso(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(iso(new Date()));
  const [asAt, setAsAt] = useState(iso(new Date()));
  const [drugId, setDrugId] = useState(0);
  const [data, setData] = useState<ListingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { api.get("/reports/listings").then((r) => setCatalog(r.data)).catch((e) => setError(apiError(e))); }, []);

  async function run() {
    if (key === "bin-card" && !drugId) { setError("Choose a drug for the BIN card."); return; }
    setLoading(true); setError("");
    try {
      const params: Record<string, string | number> = { from, to };
      if (key === "stock-valuation-asat") params.asAt = asAt;
      if (key === "bin-card") params.drugId = drugId;
      setData((await api.get<ListingResult>(`/reports/listings/${key}`, { params })).data);
    } catch (e) { setError(apiError(e)); setData(null); }
    finally { setLoading(false); }
  }

  const totals = data?.columns.filter((c) => c.type === "money" || (c.type === "num" && !/age|days|balance|reorder|level/i.test(c.key + c.label)));

  return (
    <div className={s.page}>
      <div className={s.toolbar} style={{ alignItems: "flex-end" }}>
        <div className={s.field} style={{ minWidth: 300 }}>
          <span className={s.fieldLabel}>Report</span>
          <select className={s.select} value={key} onChange={(e) => { setKey(e.target.value); setData(null); }}>
            {catalog.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        {!NO_DATES.has(key) && <>
          <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </>}
        {key === "stock-valuation-asat" && <Input label="As at" type="date" value={asAt} onChange={(e) => setAsAt(e.target.value)} />}
        {key === "bin-card" && <div style={{ minWidth: 320 }}><DrugPicker label="Drug" value={drugId} onChange={(d) => setDrugId(d?.id ?? 0)} /></div>}
        <Button loading={loading} onClick={run}>Run Report</Button>
        <div className={s.spacer} />
        {data && <>
          <Button variant="secondary" onClick={() => exportCsv(`${key}.csv`, [data.columns.map((c) => c.label), ...data.rows.map((r) => data.columns.map((c) => r[c.key] as string | number | null))])}>Export CSV</Button>
          <Button variant="secondary" onClick={() => window.print()}>Print</Button>
        </>}
      </div>
      {error && <div className={s.error}>{error}</div>}
      {data && (
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, overflow: "auto" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between" }}>
            <strong>{data.title}</strong><span className={s.muted}>{data.rows.length} row(s)</span>
          </div>
          <table className={s.dtable}>
            <thead><tr>{data.columns.map((c) => <th key={c.key} className={c.type === "num" || c.type === "money" ? s.num : ""}>{c.label}</th>)}</tr></thead>
            <tbody>
              {data.rows.length === 0 && <tr><td colSpan={data.columns.length} style={{ textAlign: "center", padding: 24 }} className={s.muted}>No data for this period.</td></tr>}
              {data.rows.map((r, i) => (
                <tr key={i}>{data.columns.map((c) => <td key={c.key} className={c.type === "num" || c.type === "money" ? s.num : ""}>{cell(r[c.key], c.type)}</td>)}</tr>
              ))}
              {data.rows.length > 1 && totals && totals.length > 0 && (
                <tr style={{ fontWeight: 800, background: "var(--color-primary-light)" }}>
                  {data.columns.map((c, i) => (
                    <td key={c.key} className={c.type === "num" || c.type === "money" ? s.num : ""}>
                      {totals.includes(c) ? cell(data.rows.reduce((a, r) => a + (Number(r[c.key]) || 0), 0), c.type) : i === 0 ? "TOTAL" : ""}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface MovementRow { drug_id: number; item_code: string; brand_name: string; received: number; sold: number; adjusted: number; returned_to_supplier: number; transferred_out: number; net_change: number; current_stock: number }

/** Daily / weekly / monthly inventory movement report (Reporting Requirements). */
export function StockMovementReport() {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [date, setDate] = useState(iso(new Date()));
  const [data, setData] = useState<{ start: string; end: string; rows: MovementRow[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setLoading(true); setError("");
    try { setData((await api.get("/reports/stock-movement", { params: { period, date } })).data); }
    catch (e) { setError(apiError(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { run(); }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  const cols: [keyof MovementRow, string][] = [["received", "Received"], ["sold", "Sold"], ["adjusted", "Adjusted"], ["returned_to_supplier", "Returned"], ["transferred_out", "Transferred"], ["net_change", "Net"], ["current_stock", "Current Stock"]];

  return (
    <div className={s.page}>
      <div className={s.toolbar} style={{ alignItems: "flex-end" }}>
        {(["daily", "weekly", "monthly"] as const).map((p) => (
          <Button key={p} variant={period === p ? "primary" : "secondary"} onClick={() => setPeriod(p)}>{p[0].toUpperCase() + p.slice(1)}</Button>
        ))}
        <Input label="Period containing" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button loading={loading} onClick={run}>Run</Button>
        <div className={s.spacer} />
        {data && <Button variant="secondary" onClick={() => exportCsv(`stock-movement-${period}-${date}.csv`, [["Code", "Drug", ...cols.map((c) => c[1])], ...data.rows.map((r) => [r.item_code, r.brand_name, ...cols.map((c) => r[c[0]] as number)])])}>Export CSV</Button>}
      </div>
      {error && <div className={s.error}>{error}</div>}
      {data && (
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, overflow: "auto" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border)" }}>
            <strong>{period[0].toUpperCase() + period.slice(1)} stock report</strong> <span className={s.muted}>{formatDate(data.start)} – {formatDate(data.end)}</span>
          </div>
          <table className={s.dtable}>
            <thead><tr><th>Code</th><th>Drug</th>{cols.map((c) => <th key={c[0]} className={s.num}>{c[1]}</th>)}</tr></thead>
            <tbody>
              {data.rows.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", padding: 24 }} className={s.muted}>No stock movements in this period.</td></tr>}
              {data.rows.map((r) => (
                <tr key={r.drug_id}><td>{r.item_code}</td><td className={s.strong}>{r.brand_name}</td>
                  {cols.map((c) => <td key={c[0]} className={s.num} style={c[0] === "net_change" ? { fontWeight: 700, color: r.net_change < 0 ? "var(--color-danger)" : "var(--color-success)" } : undefined}>{r[c[0]]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
