import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useAuthStore } from "../../store/authStore";
import { useShiftStore, type Shift } from "../../store/shiftStore";
import { useCartStore } from "../../store/cartStore";
import { printHtml, renderShiftReport } from "../../utils/receipt";
import styles from "./Shift.module.css";

const money = (n: number) => `Rs. ${n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const errText = (e: unknown, fb: string) => (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? fb;
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** Nothing on the POS works until the signed-in cashier has an open shift. */
export function ShiftGate({ children }: { children: ReactNode }) {
  const { shift, load, start } = useShiftStore();
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [cash, setCash] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (shift === undefined) load().catch(() => setError("Could not check your shift. Is the server running?")); }, [shift, load]);

  if (shift) return <>{children}</>;
  if (shift === undefined && !error) return <div className={styles.gateWrap}><div className={styles.gateCard}>Checking your shift…</div></div>;

  async function begin() {
    const v = Number(cash);
    if (cash.trim() === "" || !Number.isFinite(v) || v < 0) { setError("Enter the cash in the drawer (0 if empty)."); return; }
    setBusy(true); setError("");
    try { await start(v, notes.trim() || undefined); }
    catch (e) { setError(errText(e, "Could not start the shift.")); }
    finally { setBusy(false); }
  }

  return (
    <div className={styles.gateWrap}>
      <div className={styles.gateCard}>
        <div className={styles.gateIcon}>🕘</div>
        <h2 className={styles.gateTitle}>Start your shift</h2>
        <p className={styles.gateSub}>
          {user ? <>Hello <b>{user.name}</b>. </> : null}Count the cash in the drawer and enter it below. Every sale and return from now on is recorded in this shift.
        </p>
        <label className={styles.lbl}>Opening cash in drawer (Rs.)
          <input className={styles.inpBig} type="number" min={0} step="0.01" autoFocus value={cash}
            onChange={(e) => setCash(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void begin()} placeholder="e.g. 5000" />
        </label>
        <label className={styles.lbl}>Note (optional)
          <input className={styles.inp} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. float received from manager" />
        </label>
        {error && <div className={styles.err}>{error}</div>}
        <Button onClick={() => void begin()} disabled={busy}>{busy ? "Starting…" : "Start Shift"}</Button>
        <button className={styles.linkBtn} onClick={() => { clearAuth(); useShiftStore.getState().reset(); navigate("/login"); }}>Log out</button>
      </div>
    </div>
  );
}

/** Header badge: shift number, start time, End Shift button. */
export function ShiftBadge() {
  const shift = useShiftStore((s) => s.shift);
  const [open, setOpen] = useState(false);
  return (
    <>
      {shift && (
        <div className={styles.badge} title={`Shift ${shift.shift_number}`}>
          <span className={styles.badgeDot} />
          <span>Shift since <b>{time(shift.opened_at)}</b></span>
          <button className={styles.badgeBtn} onClick={() => setOpen(true)}>End Shift</button>
        </div>
      )}
      {/* stays mounted after the shift ends so the report can be shown */}
      <div className={styles.modalText}><EndShiftModal open={open} onClose={() => setOpen(false)} /></div>
    </>
  );
}

/** Live totals → cash count → frozen report (print / new shift / log out). */
export function EndShiftModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { load, end } = useShiftStore();
  const { clearAuth } = useAuthStore();
  const cartCount = useCartStore((s) => s.items.length);
  const navigate = useNavigate();
  const [live, setLive] = useState<Shift | null>(null);
  const [report, setReport] = useState<Shift | null>(null);
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setReport(null); setCounted(""); setNotes(""); setError("");
    load().then((s) => setLive(s)).catch(() => setError("Could not load the shift figures."));
  }, [open, load]);

  const t = live?.totals;
  const c = Number(counted);
  const diff = counted.trim() !== "" && Number.isFinite(c) && t ? c - t.expected_cash : null;

  async function finish() {
    if (counted.trim() === "" || !Number.isFinite(c) || c < 0) { setError("Count the drawer and enter the cash amount."); return; }
    if (diff !== null && Math.abs(diff) >= 0.005 && !notes.trim()) { setError("The cash does not match. Add a note explaining the difference."); return; }
    setBusy(true); setError("");
    try {
      const r = await end(c, notes.trim() || undefined);
      setReport(r);
      void printHtml(renderShiftReport(r));
    } catch (e) { setError(errText(e, "Could not end the shift.")); }
    finally { setBusy(false); }
  }

  function printX() { if (live) void printHtml(renderShiftReport(live)); }

  const closeAll = () => { if (!report) onClose(); };

  if (report) {
    const r = report, rt = r.totals, d = r.cash_difference ?? 0;
    return (
      <Modal open={open} onClose={() => {}} title={`Shift ended — ${r.shift_number}`} size="md"
        footer={<>
          <Button variant="secondary" onClick={() => void printHtml(renderShiftReport(r))}>Print again</Button>
          <Button variant="secondary" onClick={() => { onClose(); setReport(null); }}>Start new shift</Button>
          <Button onClick={() => { useShiftStore.getState().reset(); clearAuth(); navigate("/login"); }}>Log out</Button>
        </>}>
        <div className={Math.abs(d) < 0.005 ? styles.okBox : styles.warnBox}>
          {Math.abs(d) < 0.005 ? "Cash balanced ✓" : d > 0 ? `Cash OVER by ${money(d)}` : `Cash SHORT by ${money(-d)}`}
        </div>
        <Figures t={rt} openingCash={r.opening_cash} counted={r.counted_cash} />
        <p className={styles.muted}>The report was sent to the printer and saved. The manager can see it in the ERP under Shifts.</p>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={closeAll} title="End shift" size="md"
      footer={<>
        <Button variant="secondary" onClick={printX} disabled={!live}>Print X-reading</Button>
        <Button variant="secondary" onClick={onClose}>Keep working</Button>
        <Button onClick={() => void finish()} disabled={busy || !live}>{busy ? "Ending…" : "End Shift & Print Report"}</Button>
      </>}>
      {!live ? <div className={styles.muted}>{error || "Loading shift figures…"}</div> : (
        <>
          <div className={styles.metaRow}>
            <span>Shift <b>{live.shift_number}</b></span>
            <span>Started {time(live.opened_at)} · {Math.floor(live.duration_minutes / 60)}h {live.duration_minutes % 60}m</span>
          </div>
          {cartCount > 0 && <div className={styles.warnBox}>There are {cartCount} item(s) on the current bill. Finish or clear that bill first, or it will not be in this shift.</div>}
          <Figures t={t!} openingCash={live.opening_cash} />
          <label className={styles.lbl}>Cash counted in drawer (Rs.)
            <input className={styles.inpBig} type="number" min={0} step="0.01" autoFocus value={counted} onChange={(e) => setCounted(e.target.value)} />
          </label>
          {diff !== null && (
            <div className={Math.abs(diff) < 0.005 ? styles.okBox : styles.warnBox}>
              {Math.abs(diff) < 0.005 ? "Cash matches ✓" : diff > 0 ? `Over by ${money(diff)}` : `Short by ${money(-diff)}`}
            </div>
          )}
          <label className={styles.lbl}>Note {diff !== null && Math.abs(diff) >= 0.005 ? "(required — explain the difference)" : "(optional)"}
            <input className={styles.inp} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {error && <div className={styles.err}>{error}</div>}
        </>
      )}
    </Modal>
  );
}

function Figures({ t, openingCash, counted }: { t: Shift["totals"]; openingCash: number; counted?: number | null }) {
  const rows: [string, string, boolean?][] = [
    ["Bills", String(t.sales_count)],
    ["Items sold", String(t.items_sold)],
    ["Gross sales", money(t.gross_sales)],
    ["Discounts", `− ${money(t.discount_total)}`],
    ["Net sales", money(t.net_sales), true],
    ["Cash", money(t.cash_sales)],
    ["Card", money(t.card_sales)],
    ["LankaQR / Other", money(t.other_sales)],
    [`Returns (${t.return_count})`, `− ${money(t.return_total)}`],
    [`Voided bills (${t.void_count})`, money(t.void_total)],
    ["Opening cash", money(openingCash)],
    ["Expected cash in drawer", money(t.expected_cash), true],
  ];
  if (counted != null) rows.push(["Counted cash", money(counted), true]);
  return (
    <table className={styles.fig}>
      <tbody>{rows.map(([l, v, b]) => <tr key={l} className={b ? styles.figStrong : undefined}><td>{l}</td><td>{v}</td></tr>)}</tbody>
    </table>
  );
}

/** Logout with an open shift: offer to end it first. */
export function useLogoutGuard() {
  const shift = useShiftStore((s) => s.shift);
  const { clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [ask, setAsk] = useState(false);
  const [ending, setEnding] = useState(false);
  const out = () => { useShiftStore.getState().reset(); clearAuth(); navigate("/login"); };
  const request = () => (shift ? setAsk(true) : out());
  const dialog = (
    <div className={styles.modalText}>
      <Modal open={ask} onClose={() => setAsk(false)} title="Your shift is still open" size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => { setAsk(false); out(); }}>Log out, keep shift open</Button>
          <Button onClick={() => { setAsk(false); setEnding(true); }}>End shift first</Button>
        </>}>
        <p>If you log out now, the shift stays open and continues when you log in again. To hand over the counter, end the shift first.</p>
      </Modal>
      <EndShiftModal open={ending} onClose={() => setEnding(false)} />
    </div>
  );
  return { request, dialog };
}
