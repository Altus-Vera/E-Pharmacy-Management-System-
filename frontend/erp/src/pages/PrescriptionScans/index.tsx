import { useEffect, useState } from "react";
import api from "../../services/api";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { Table } from "../../components/ui/Table";
import { apiError } from "../../utils/errors";

interface ScanRow {
  scan_id: string; at: string; user: string | null; model: string | null; patient_name: string | null; doctor_name: string | null;
  lines_read: number; low_confidence: number; confirmed_at: string | null; confirmed_by: string | null; lines_kept: number | null; lines_changed: number | null;
}
interface ReadLine { raw_text: string; drug_name: string | null; strength: string | null; dose: number | null; frequency_code: string | null; days: number | null; confidence: string; note: string | null; matched_drug_id: number | null; matches: { drug_id: number; brand_name: string; strength: string | null }[] }
interface ConfLine { raw_text: string; drug_id: number | null; dose: number | null; frequency_code: string | null; days: number | null; quantity: number | null }
interface Detail {
  scan_id: string; images: number;
  read: { at: string; user: string | null; hint: string | null; result: { patient_name: string | null; doctor_name: string | null; rx_date: string | null; notes: string | null; model: string; lines: ReadLine[] } };
  confirmed: { at: string; user: string | null; confirmed: { lines: ConfLine[] } } | null;
}

const fmt = (d: string) => new Date(d).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" });
const confBadge = (c: string) => c === "high" ? <Badge variant="success">Clear</Badge> : c === "medium" ? <Badge variant="warning">Check</Badge> : <Badge variant="danger">Unsure</Badge>;

/**
 * Prescription photos read by AI at the POS (Scan Rx): what the AI read next to what the cashier confirmed.
 * Lets managers see how often the reading needed correcting before trusting it more.
 */
export function PrescriptionScansPage() {
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [imgs, setImgs] = useState<string[]>([]);
  const [imgLoading, setImgLoading] = useState(false);
  const [drugNames, setDrugNames] = useState<Record<number, string>>({});

  useEffect(() => {
    api.get<ScanRow[]>("/prescriptions/ocr/history").then((r) => setRows(r.data)).catch((e) => setError(apiError(e))).finally(() => setLoading(false));
  }, []);

  useEffect(() => () => imgs.forEach((u) => URL.revokeObjectURL(u)), [imgs]);

  async function open(id: string) {
    setError("");
    try {
      const d = (await api.get<Detail>(`/prescriptions/ocr/${id}`)).data;
      setDetail(d);
      setImgLoading(true);
      // photos come through the API (behind login), so fetch them as blobs
      const urls = await Promise.all(Array.from({ length: d.images }, (_, n) =>
        api.get(`/prescriptions/ocr/${id}/image/${n}`, { responseType: "blob" }).then((r) => URL.createObjectURL(r.data as Blob)).catch(() => "")));
      setImgs(urls.filter(Boolean));
      setImgLoading(false);
      // names for confirmed products that were not among the AI's suggestions
      const names: Record<number, string> = {};
      d.read.result.lines.forEach((l) => l.matches.forEach((m) => { names[m.drug_id] = `${m.brand_name}${m.strength ? " " + m.strength : ""}`; }));
      const missing = (d.confirmed?.confirmed.lines ?? []).map((l) => l.drug_id).filter((x): x is number => !!x && !names[x]);
      await Promise.all([...new Set(missing)].map((x) => api.get<{ brand_name: string; strength: string | null }>(`/drugs/${x}`)
        .then((r) => { names[x] = `${r.data.brand_name}${r.data.strength ? " " + r.data.strength : ""}`; }).catch(() => {})));
      setDrugNames(names);
    } catch (e) { setError(apiError(e)); }
  }

  const confirmed = rows.filter((r) => r.confirmed_at);
  const totalKept = confirmed.reduce((s, r) => s + (r.lines_kept ?? 0), 0);
  const totalChanged = confirmed.reduce((s, r) => s + (r.lines_changed ?? 0), 0);
  const accuracy = totalKept ? Math.round(((totalKept - totalChanged) / totalKept) * 100) : null;

  const card = (label: string, value: string, sub?: string) => (
    <div style={{ flex: 1, minWidth: 160, border: "1px solid var(--color-border)", borderRadius: 10, padding: "var(--space-3)", background: "var(--color-surface, #fff)" }}>
      <div style={{ fontSize: "var(--font-size-xs, 0.72rem)", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-muted)", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 800 }}>{value}</div>
      {sub && <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
        Prescription photos read by AI at the POS (Scan Rx). Each scan shows what the AI read and what the cashier confirmed after checking it against the photo.
      </span>
      {error && <div style={{ color: "var(--color-danger)", fontSize: "var(--font-size-sm)" }}>{error}</div>}
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        {card("Scans", String(rows.length), `${confirmed.length} put on a bill`)}
        {card("Lines confirmed", String(totalKept), `${totalChanged} needed a different product`)}
        {card("Product match rate", accuracy === null ? "—" : `${accuracy}%`, "AI's product kept by the cashier")}
      </div>
      <Table<ScanRow>
        columns={[
          { key: "at", header: "When", render: (r) => <span>{fmt(r.at)}</span> },
          { key: "user", header: "Scanned by", render: (r) => <span>{r.user ?? "—"}</span> },
          { key: "pt", header: "Patient / Doctor (as read)", render: (r) => <span>{r.patient_name ?? "—"}<br /><small style={{ color: "var(--color-text-muted)" }}>{r.doctor_name ?? ""}</small></span> },
          { key: "lines", header: "Lines read", render: (r) => <span>{r.lines_read}{r.low_confidence ? <small style={{ color: "var(--color-warning, #b45309)" }}> · {r.low_confidence} unsure</small> : null}</span> },
          { key: "st", header: "Result", render: (r) => r.confirmed_at
            ? (r.lines_changed ? <Badge variant="warning">{r.lines_changed} of {r.lines_kept} corrected</Badge> : <Badge variant="success">All {r.lines_kept} correct</Badge>)
            : <Badge variant="neutral">Not used</Badge> },
          { key: "m", header: "Read by", render: (r) => <small>{r.model ?? "—"}</small> },
          { key: "a", header: "", render: (r) => <Button size="sm" variant="ghost" onClick={() => void open(r.scan_id)}>View</Button> },
        ]}
        data={rows}
        rowKey={(r) => r.scan_id}
        emptyMessage={loading ? "Loading…" : "No scans yet. Use Scan Rx in the POS."}
      />

      <Modal open={!!detail} onClose={() => { setDetail(null); setImgs([]); setImgLoading(false); }} title="Prescription scan" size="xl">
        {detail && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 0.9fr) 1.5fr", gap: "var(--space-4)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "70vh", overflow: "auto" }}>
              {imgs.length ? imgs.map((u, i) => <img key={i} src={u} alt={`Prescription photo ${i + 1}`} style={{ width: "100%", borderRadius: 8, border: "1px solid var(--color-border)" }} />)
                : <div style={{ color: "var(--color-text-muted)" }}>{imgLoading ? "Loading photo…" : "Photo not available."}</div>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", fontSize: "var(--font-size-sm)" }}>
              <div>
                Scanned {fmt(detail.read.at)} by <b>{detail.read.user ?? "—"}</b> · read by {detail.read.result.model}
                {detail.confirmed ? <> · confirmed {fmt(detail.confirmed.at)} by <b>{detail.confirmed.user ?? "—"}</b></> : <> · <i>not put on a bill</i></>}
              </div>
              <div>
                Patient: <b>{detail.read.result.patient_name ?? "—"}</b> · Doctor: <b>{detail.read.result.doctor_name ?? "—"}</b> · Date: <b>{detail.read.result.rx_date ?? "—"}</b>
                {detail.read.hint && <div>Message text: “{detail.read.hint}”</div>}
                {detail.read.result.notes && <div>Note on prescription: {detail.read.result.notes}</div>}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "2px solid var(--color-border)" }}>
                    <th style={{ padding: 6 }}>Written</th><th style={{ padding: 6 }}>AI read</th><th style={{ padding: 6 }}>Cashier confirmed</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.read.result.lines.map((l, i) => {
                    const ai = l.matched_drug_id ? drugNames[l.matched_drug_id] ?? `#${l.matched_drug_id}` : "no match";
                    const c = detail.confirmed?.confirmed.lines.find((x) => x.raw_text === l.raw_text);
                    const same = c && c.drug_id === l.matched_drug_id;
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid var(--color-border)", verticalAlign: "top" }}>
                        <td style={{ padding: 6, fontStyle: "italic" }}>“{l.raw_text}”{l.note && <div style={{ fontStyle: "normal", color: "var(--color-warning, #b45309)" }}>{l.note}</div>}</td>
                        <td style={{ padding: 6 }}>{ai} {confBadge(l.confidence)}<div style={{ color: "var(--color-text-muted)" }}>{[l.dose, l.frequency_code, l.days ? `${l.days} days` : null].filter(Boolean).join(" · ")}</div></td>
                        <td style={{ padding: 6 }}>{!detail.confirmed ? "—" : !c ? <Badge variant="neutral">Removed</Badge>
                          : <>{c.drug_id ? drugNames[c.drug_id] ?? `#${c.drug_id}` : "—"} {same ? <Badge variant="success">Same</Badge> : <Badge variant="warning">Changed</Badge>}
                            <div style={{ color: "var(--color-text-muted)" }}>{[c.dose, c.frequency_code, c.days ? `${c.days} days` : null, c.quantity ? `qty ${c.quantity}` : null].filter(Boolean).join(" · ")}</div></>}</td>
                      </tr>
                    );
                  })}
                  {detail.confirmed?.confirmed.lines.filter((c) => !detail.read.result.lines.some((l) => l.raw_text === c.raw_text)).map((c, i) => (
                    <tr key={`add${i}`} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td style={{ padding: 6, color: "var(--color-text-muted)" }}>(missed by AI)</td><td style={{ padding: 6 }}>—</td>
                      <td style={{ padding: 6 }}>{c.drug_id ? drugNames[c.drug_id] ?? `#${c.drug_id}` : "—"} <Badge variant="warning">Added</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
