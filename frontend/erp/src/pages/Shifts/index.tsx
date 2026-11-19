import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { Button } from "../../components/ui/Button";
import { Table } from "../../components/ui/Table";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { formatCurrency, formatDateTime } from "../../utils/formatters";
import { apiError, exportCsv } from "../../utils/errors";
import s from "../../styles/erp.module.css";

interface Totals {
  sales_count: number; gross_sales: number; discount_total: number; net_sales: number;
  cash_sales: number; card_sales: number; other_sales: number;
  void_count: number; void_total: number; return_count: number; return_total: number;
  items_sold: number; opening_cash: number; expected_cash: number; last_sale_at?: string | null;
}
interface Shift {
  id: number; shift_number: string; user_id: number; cashier_name: string; cashier_username: string; terminal: string | null;
  status: "open" | "closed"; live: boolean; opened_at: string; closed_at: string | null; closed_by_name: string | null;
  duration_minutes: number; opening_cash: number; opening_notes: string | null; counted_cash: number | null; closing_notes: string | null;
  totals: Totals; cash_difference: number | null; top_items: { name: string; quantity: number; amount: number }[] | null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const dur = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;
const diffText = (d: number | null) => d == null ? "—" : Math.abs(d) < 0.005 ? "Balanced" : d > 0 ? `Over ${formatCurrency(d)}` : `Short ${formatCurrency(-d)}`;

export function ShiftsPage() {
  const [rows, setRows] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState(iso(new Date(Date.now() - 6 * 864e5)));
  const [to, setTo] = useState(iso(new Date()));
  const [status, setStatus] = useState("all");
  const [detail, setDetail] = useState<Shift | null>(null);
  const [closing, setClosing] = useState<Shift | null>(null);
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [updated, setUpdated] = useState<Date | null>(null);

  async function load(quiet = false) {
    if (!quiet) setLoading(true);
    try {
      const params: Record<string, string> = { from, to: iso(new Date(new Date(to).getTime() + 864e5)) };
      if (status !== "all") params.status = status;
      setRows((await api.get<Shift[]>("/shifts", { params })).data);
      setUpdated(new Date()); setError("");
    } catch (e) { setError(apiError(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [from, to, status]); // eslint-disable-line react-hooks/exhaustive-deps
  // live progress: refresh every 30 s while any shift is open
  useEffect(() => {
    if (!rows.some((r) => r.live)) return;
    const t = setInterval(() => void load(true), 30000);
    return () => clearInterval(t);
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = rows.filter((r) => r.live);
  const sum = (f: (t: Totals) => number) => rows.reduce((a, r) => a + f(r.totals), 0);
  const shortTotal = useMemo(() => rows.reduce((a, r) => a + (r.cash_difference && r.cash_difference < 0 ? r.cash_difference : 0), 0), [rows]);

  async function openDetail(r: Shift) {
    try { setDetail((await api.get<Shift>(`/shifts/${r.id}`)).data); }
    catch (e) { setError(apiError(e)); }
  }

  async function forceEnd() {
    if (!closing) return;
    const c = Number(counted);
    if (counted.trim() === "" || !Number.isFinite(c) || c < 0) { setError("Enter the cash counted in the drawer."); return; }
    try {
      const r = (await api.post<Shift>(`/shifts/${closing.id}/end`, { counted_cash: c, notes: note.trim() || `Ended by manager` })).data;
      setClosing(null); setDetail(r); void load(true);
    } catch (e) { setError(apiError(e)); }
  }

  return (
    <div className={s.page}>
      <div className={s.stats}>
        <div className={s.stat}><div className={s.statLabel}>Open shifts now</div><div className={s.statValue}>{open.length}</div></div>
        <div className={s.stat}><div className={s.statLabel}>Net sales (period)</div><div className={s.statValue}>{formatCurrency(sum((t) => t.net_sales))}</div></div>
        <div className={`${s.stat} ${s.statInfo}`}><div className={s.statLabel}>Bills (period)</div><div className={s.statValue}>{sum((t) => t.sales_count)}</div></div>
        <div className={`${s.stat} ${s.statWarn}`}><div className={s.statLabel}>Returns (period)</div><div className={s.statValue}>{formatCurrency(sum((t) => t.return_total))}</div></div>
        <div className={`${s.stat} ${s.statDanger}`}><div className={s.statLabel}>Cash short (period)</div><div className={s.statValue}>{formatCurrency(-shortTotal)}</div></div>
      </div>

      {open.length > 0 && (
        <div>
          <div className={s.linesTitle} style={{ marginBottom: 8 }}>Live now <span className={s.muted}>· updates every 30 s{updated ? ` · last ${updated.toLocaleTimeString("en-GB")}` : ""}</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {open.map((r) => (
              <div key={r.id} className={s.stat} style={{ cursor: "pointer" }} onClick={() => void openDetail(r)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b>{r.cashier_name}</b><Badge variant="success">Open · {dur(r.duration_minutes)}</Badge>
                </div>
                <div className={s.muted}>{r.terminal ?? "—"} · since {formatDateTime(r.opened_at)}</div>
                <div className={s.statValue}>{formatCurrency(r.totals.net_sales)}</div>
                <div className={s.muted}>
                  {r.totals.sales_count} bills · cash {formatCurrency(r.totals.cash_sales)} · card {formatCurrency(r.totals.card_sales)}
                  {r.totals.return_count ? ` · ${r.totals.return_count} returns` : ""}
                  {r.totals.last_sale_at ? ` · last sale ${new Date(r.totals.last_sale_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}
                </div>
                <div className={s.muted}>Expected cash in drawer: <b>{formatCurrency(r.totals.expected_cash)}</b></div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={s.toolbar}>
        <label className={s.muted}>From <input className={s.search} style={{ minWidth: 0 }} type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className={s.muted}>To <input className={s.search} style={{ minWidth: 0 }} type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <select className={s.select} style={{ width: 150 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All shifts</option>
          <option value="open">Open</option>
          <option value="closed">Ended</option>
        </select>
        <div className={s.spacer} />
        <Button variant="secondary" onClick={() => void load()}>↻ Refresh</Button>
        <Button variant="secondary" onClick={() => exportCsv("shifts.csv", [
          ["Shift", "Cashier", "Terminal", "Started", "Ended", "Bills", "Net sales", "Cash", "Card", "Other", "Returns", "Voids", "Opening cash", "Expected cash", "Counted", "Difference"],
          ...rows.map((r) => [r.shift_number, r.cashier_name, r.terminal ?? "", r.opened_at, r.closed_at ?? "open", r.totals.sales_count, r.totals.net_sales.toFixed(2), r.totals.cash_sales.toFixed(2), r.totals.card_sales.toFixed(2), r.totals.other_sales.toFixed(2), r.totals.return_total.toFixed(2), r.totals.void_total.toFixed(2), r.opening_cash.toFixed(2), r.totals.expected_cash.toFixed(2), r.counted_cash?.toFixed(2) ?? "", r.cash_difference?.toFixed(2) ?? ""]),
        ])}>Export CSV</Button>
      </div>
      {error && <div className={s.error}>{error}</div>}

      <Table<Shift>
        columns={[
          { key: "shift_number", header: "Shift", render: (r) => <span className={s.strong}>{r.shift_number}</span> },
          { key: "cashier", header: "Cashier", render: (r) => <>{r.cashier_name} <span className={s.muted}>{r.terminal ?? ""}</span></> },
          { key: "opened_at", header: "Started", render: (r) => formatDateTime(r.opened_at) },
          { key: "closed_at", header: "Ended", render: (r) => r.closed_at ? formatDateTime(r.closed_at) : <Badge variant="success">Open</Badge> },
          { key: "bills", header: "Bills", render: (r) => r.totals.sales_count },
          { key: "net", header: "Net sales", render: (r) => formatCurrency(r.totals.net_sales) },
          { key: "returns", header: "Returns", render: (r) => r.totals.return_count ? formatCurrency(r.totals.return_total) : "—" },
          { key: "expected", header: "Expected cash", render: (r) => formatCurrency(r.totals.expected_cash) },
          { key: "diff", header: "Cash check", render: (r) => r.live ? <span className={s.muted}>in progress</span>
              : <Badge variant={Math.abs(r.cash_difference ?? 0) < 0.005 ? "success" : (r.cash_difference ?? 0) < 0 ? "danger" : "warning"}>{diffText(r.cash_difference)}</Badge> },
          { key: "actions", header: "", render: (r) => (
            <div className={s.actions}>
              <Button size="sm" variant="secondary" onClick={() => void openDetail(r)}>View</Button>
              {r.live && <Button size="sm" variant="danger" onClick={() => { setClosing(r); setCounted(""); setNote(""); }}>End shift</Button>}
            </div>
          ) },
        ]}
        data={rows}
        rowKey={(r) => r.id}
        emptyMessage={loading ? "Loading…" : "No shifts in this period."}
      />

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Shift ${detail.shift_number}` : ""} size="lg"
        footer={<><Button variant="secondary" onClick={() => detail && printShift(detail)}>Print</Button><Button onClick={() => setDetail(null)}>Close</Button></>}>
        {detail && <ShiftDetail sh={detail} />}
      </Modal>

      <Modal open={!!closing} onClose={() => setClosing(null)} title={closing ? `End shift for ${closing.cashier_name}` : ""} size="sm"
        footer={<><Button variant="secondary" onClick={() => setClosing(null)}>Cancel</Button><Button variant="danger" onClick={() => void forceEnd()}>End shift</Button></>}>
        {closing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>Expected cash in drawer: <b>{formatCurrency(closing.totals.expected_cash)}</b></div>
            <label className={s.field}><span className={s.fieldLabel}>Cash counted (Rs.)</span>
              <input className={s.search} type="number" min={0} step="0.01" value={counted} onChange={(e) => setCounted(e.target.value)} autoFocus /></label>
            <label className={s.field}><span className={s.fieldLabel}>Note</span>
              <input className={s.search} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. cashier left without ending shift" /></label>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ShiftDetail({ sh }: { sh: Shift }) {
  const t = sh.totals;
  const line = (l: string, v: string, strong = false) => <tr key={l}><td style={strong ? { fontWeight: 700 } : undefined}>{l}</td><td className={s.num} style={strong ? { fontWeight: 700 } : undefined}>{v}</td></tr>;
  return (
    <>
      <div className={s.detailGrid}>
        <div>Cashier: <b>{sh.cashier_name}</b> <span className={s.muted}>({sh.cashier_username})</span></div>
        <div>Terminal: <b>{sh.terminal ?? "—"}</b></div>
        <div>Started: <b>{formatDateTime(sh.opened_at)}</b></div>
        <div>Ended: <b>{sh.closed_at ? formatDateTime(sh.closed_at) : "still open"}</b>{sh.closed_by_name ? <span className={s.muted}> by {sh.closed_by_name}</span> : null}</div>
        <div>Duration: <b>{dur(sh.duration_minutes)}</b></div>
        <div>Status: <Badge variant={sh.live ? "success" : "neutral"}>{sh.live ? "Open (live)" : "Ended"}</Badge></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <table className={s.dtable}><tbody>
          {line("Bills", String(t.sales_count))}
          {line("Items sold", String(t.items_sold))}
          {line("Gross sales", formatCurrency(t.gross_sales))}
          {line("Discounts", `− ${formatCurrency(t.discount_total)}`)}
          {line("Net sales", formatCurrency(t.net_sales), true)}
          {line("Cash", formatCurrency(t.cash_sales))}
          {line("Card", formatCurrency(t.card_sales))}
          {line("LankaQR / Other", formatCurrency(t.other_sales))}
        </tbody></table>
        <table className={s.dtable}><tbody>
          {line(`Returns (${t.return_count})`, `− ${formatCurrency(t.return_total)}`)}
          {line(`Voided bills (${t.void_count})`, formatCurrency(t.void_total))}
          {line("Opening cash", formatCurrency(sh.opening_cash))}
          {line("Expected cash", formatCurrency(t.expected_cash), true)}
          {line("Counted cash", sh.counted_cash != null ? formatCurrency(sh.counted_cash) : "—")}
          {line("Difference", diffText(sh.cash_difference), true)}
        </tbody></table>
      </div>
      {(sh.opening_notes || sh.closing_notes) && (
        <div className={s.muted} style={{ marginTop: 10 }}>
          {sh.opening_notes && <div>Start note: {sh.opening_notes}</div>}
          {sh.closing_notes && <div>End note: {sh.closing_notes}</div>}
        </div>
      )}
      {sh.top_items && sh.top_items.length > 0 && (
        <>
          <div className={s.linesTitle} style={{ margin: "14px 0 6px" }}>Top items</div>
          <table className={s.dtable}>
            <thead><tr><th>Item</th><th className={s.num}>Qty</th><th className={s.num}>Amount</th></tr></thead>
            <tbody>{sh.top_items.map((i) => <tr key={i.name}><td>{i.name}</td><td className={s.num}>{i.quantity}</td><td className={s.num}>{formatCurrency(i.amount)}</td></tr>)}</tbody>
          </table>
        </>
      )}
    </>
  );
}

function printShift(sh: Shift) {
  const t = sh.totals;
  const r = (l: string, v: string) => `<tr><td>${l}</td><td style="text-align:right">${v}</td></tr>`;
  const html = `<html><head><title>${sh.shift_number}</title><style>body{font-family:Arial;font-size:13px;max-width:640px;margin:20px auto}h2{margin:0 0 4px}table{width:100%;border-collapse:collapse;margin:8px 0}td{padding:4px;border-bottom:1px solid #ddd}h3{margin:14px 0 2px;font-size:14px}</style></head><body>
    <h2>Shift report — ${sh.shift_number}</h2>
    <div>${sh.cashier_name} (${sh.cashier_username}) · ${sh.terminal ?? ""}<br>${formatDateTime(sh.opened_at)} → ${sh.closed_at ? formatDateTime(sh.closed_at) : "still open"} (${dur(sh.duration_minutes)})</div>
    <h3>Sales</h3><table>${r("Bills", String(t.sales_count))}${r("Items sold", String(t.items_sold))}${r("Gross", formatCurrency(t.gross_sales))}${r("Discounts", formatCurrency(t.discount_total))}${r("<b>Net sales</b>", `<b>${formatCurrency(t.net_sales)}</b>`)}${r("Cash", formatCurrency(t.cash_sales))}${r("Card", formatCurrency(t.card_sales))}${r("LankaQR / Other", formatCurrency(t.other_sales))}</table>
    <h3>Returns &amp; voids</h3><table>${r(`Returns (${t.return_count})`, formatCurrency(t.return_total))}${r(`Voided bills (${t.void_count})`, formatCurrency(t.void_total))}</table>
    <h3>Cash drawer</h3><table>${r("Opening cash", formatCurrency(sh.opening_cash))}${r("Expected", formatCurrency(t.expected_cash))}${r("Counted", sh.counted_cash != null ? formatCurrency(sh.counted_cash) : "—")}${r("<b>Difference</b>", `<b>${diffText(sh.cash_difference)}</b>`)}</table>
    ${sh.closing_notes ? `<div>Note: ${sh.closing_notes.replace(/</g, "&lt;")}</div>` : ""}
    <script>window.onload=()=>{window.print()}</script></body></html>`;
  const w = window.open("", "_blank", "width=720,height=900");
  if (w) { w.document.write(html); w.document.close(); }
}
