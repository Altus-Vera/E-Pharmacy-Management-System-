import { useEffect, useRef, useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { drugService } from "../../services/drug.service";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { allowedUnits, baseUnit, defaultUnit, priceFor, sellableBatches, unitChoice, unitsPer } from "../../store/cartStore";
import type { CartItem, Drug, SaleUnit } from "../../types";
import styles from "./ItemSearch.module.css";

export interface PickOptions { batchId?: number; unit: SaleUnit; qty: number }

const daysTo = (d: string | null) => (d ? (new Date(d).getTime() - Date.now()) / 864e5 : null);

/**
 * Item search pop-up: type → pick the item → choose batch, unit (loose / card / pack) and quantity → Enter adds the line.
 * ↑↓ move through results · Tab to quantity · Enter add · Ctrl+Enter add and keep searching · Esc close.
 */
export function ItemSearchModal({ open, initialQuery, items, onClose, onPick }: {
  open: boolean; initialQuery: string; items: CartItem[];
  onClose: () => void; onPick: (drug: Drug, opts: PickOptions, keepOpen: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Drug[]>([]);
  const [busy, setBusy] = useState(false);
  const [idx, setIdx] = useState(0);
  const [batchId, setBatchId] = useState<number | undefined>();
  const [unit, setUnit] = useState<SaleUnit>("unit");
  const [qty, setQty] = useState("1");
  const inputRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!open) return;
    setQ(initialQuery); setIdx(0); setResults([]);
    setTimeout(() => { inputRef.current?.focus(); const n = initialQuery.length; inputRef.current?.setSelectionRange(n, n); }, 30);
  }, [open, initialQuery]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    const my = ++seq.current;
    setBusy(true);
    const t = setTimeout(() => {
      drugService.search(term)
        .then((r) => { if (my === seq.current) { setResults(r); setIdx(0); } })
        .catch(() => { if (my === seq.current) setResults([]); })
        .finally(() => { if (my === seq.current) setBusy(false); });
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  const drug = results[idx] ?? null;
  const room = (d: Drug, bId: number) => {
    const b = sellableBatches(d).find((x) => x.id === bId);
    if (!b) return 0;
    return b.quantity_remaining - items.filter((i) => i.drug.id === d.id && i.batch?.id === bId).reduce((s, i) => s + i.quantity * i.units_per, 0);
  };
  const batches = drug ? sellableBatches(drug) : [];

  // new item highlighted → oldest batch with room, default unit, qty 1
  useEffect(() => {
    if (!drug) return;
    const per = unitsPer(drug, defaultUnit(drug));
    setBatchId(sellableBatches(drug).find((b) => room(drug, b.id) >= per)?.id ?? sellableBatches(drug)[0]?.id);
    setUnit(defaultUnit(drug));
    setQty("1");
  }, [drug?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const batch = batches.find((b) => b.id === batchId) ?? null;
  const n = Math.max(0, parseInt(qty) || 0);
  const per = drug ? unitsPer(drug, unit) : 1;
  const left = drug && batch ? room(drug, batch.id) : drug?.quantity ?? 0;
  const totalLeft = drug ? batches.reduce((s, b) => s + room(drug, b.id), 0) : 0;
  const price = drug ? priceFor(drug, batch, unit) : 0;
  const spill = n * per > left && n * per <= totalLeft;
  const tooMany = n * per > totalLeft;

  function add(keepOpen: boolean) {
    if (!drug || n <= 0 || tooMany) return;
    onPick(drug, { batchId: batch?.id, unit, qty: n }, keepOpen);
    if (keepOpen) { setQ(""); setResults([]); setTimeout(() => inputRef.current?.focus(), 20); }
  }

  function onKey(e: React.KeyboardEvent) {
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && e.target === qtyRef.current) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); add(e.ctrlKey); }
    else if (e.key === "PageDown" && drug) { e.preventDefault(); const i = batches.findIndex((b) => b.id === batchId); setBatchId(batches[Math.min(i + 1, batches.length - 1)]?.id); }
    else if (e.key === "PageUp" && drug) { e.preventDefault(); const i = batches.findIndex((b) => b.id === batchId); setBatchId(batches[Math.max(i - 1, 0)]?.id); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Find item" size="xl">
      <div className={styles.wrap} onKeyDown={onKey}>
        <div className={styles.searchBar}>
          <input ref={inputRef} className={styles.search} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Brand, generic, strength or item code…" />
          <span className={styles.keys}>↑↓ item · PgUp/PgDn batch · Tab qty · Enter add · Ctrl+Enter add &amp; keep searching</span>
        </div>
        <div className={styles.cols}>
          <div className={styles.list}>
            {q.trim().length < 2 && <div className={styles.msg}>Type at least 2 letters.</div>}
            {q.trim().length >= 2 && busy && !results.length && <div className={styles.msg}>Searching…</div>}
            {q.trim().length >= 2 && !busy && !results.length && <div className={styles.msg}>No items found for “{q}”.</div>}
            {results.map((d, i) => {
              const bs = sellableBatches(d), avail = bs.reduce((s, b) => s + b.quantity_remaining, 0);
              return (
                <button key={d.id} className={`${styles.row} ${i === idx ? styles.rowOn : ""}`} onMouseEnter={() => setIdx(i)} onClick={() => { setIdx(i); qtyRef.current?.focus(); }} onDoubleClick={() => add(false)}>
                  <div className={styles.rowMain}>
                    <b>{d.brand_name}</b>
                    {(d.is_prescription_only || d.is_narcotic || d.is_high_alert) && <span className={styles.tagRx}>{d.is_narcotic ? "N" : d.is_high_alert ? "HA" : "Rx"}</span>}
                    <small>{d.generic_name}{d.strength ? ` · ${d.strength}` : ""} · {d.dosage_form} · {d.item_code}</small>
                  </div>
                  <div className={styles.rowSide}>
                    <b>{formatCurrency(bs[0]?.selling_price ?? d.unit_price)}</b>
                    <small className={avail <= d.reorder_level ? styles.low : undefined}>{avail ? `${avail} in stock` : d.quantity > 0 ? "expired stock" : "out of stock"}{bs.length > 1 ? ` · ${bs.length} batches` : ""}</small>
                  </div>
                </button>
              );
            })}
          </div>

          <div className={styles.detail}>
            {!drug ? <div className={styles.msg}>Pick an item on the left.</div> : (
              <>
                <div className={styles.dName}>{drug.brand_name} <small>{drug.generic_name}{drug.strength ? ` · ${drug.strength}` : ""}</small></div>

                <div className={styles.label}>Batch</div>
                {batches.length === 0 ? <div className={styles.warn}>No sellable batch — out of stock or expired.</div> : (
                  <div className={styles.batches}>
                    {batches.map((b, i) => {
                      const r = room(drug, b.id), dd = daysTo(b.expiry_date);
                      return (
                        <label key={b.id} className={`${styles.batch} ${b.id === batchId ? styles.batchOn : ""} ${r <= 0 ? styles.batchFull : ""}`}>
                          <input type="radio" name="batch" checked={b.id === batchId} disabled={r <= 0} onChange={() => setBatchId(b.id)} />
                          <span className={styles.bNo}>{b.batch_number ?? "—"}{i === 0 && <em>FIFO</em>}</span>
                          <span className={dd != null && dd < 90 ? styles.low : undefined}>exp {b.expiry_date ? formatDate(b.expiry_date) : "—"}</span>
                          <span>{r} {baseUnit(drug)}s left</span>
                          <span className={styles.bPrice}>{formatCurrency(b.selling_price)} / {baseUnit(drug)}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                <div className={styles.label}>Sell as</div>
                <div className={styles.units}>
                  {allowedUnits(drug).map((u) => (
                    <button key={u} className={`${styles.unit} ${u === unit ? styles.unitOn : ""}`} onClick={() => setUnit(u)}>
                      <b>{unitChoice(drug, u).split(" · ")[0]}</b>
                      <small>{unitChoice(drug, u).split(" · ")[1]} · {formatCurrency(priceFor(drug, batch, u))}</small>
                    </button>
                  ))}
                </div>
                {allowedUnits(drug).length === 1 && drug.sell_mode && drug.sell_mode !== "loose" && drug.non_loose_reason && <div className={styles.note}>Not sold loose: {drug.non_loose_reason}</div>}

                <div className={styles.addRow}>
                  <label className={styles.qtyBox}>Quantity
                    <input ref={qtyRef} type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} onFocus={(e) => e.target.select()} />
                  </label>
                  <div className={styles.sum}>
                    <div>{n} × {formatCurrency(price)}</div>
                    <b>{formatCurrency(n * price)}</b>
                    <small>{n * per} {baseUnit(drug)}s</small>
                  </div>
                  <button className={styles.addBtn} disabled={!n || tooMany || !batches.length} onClick={() => add(false)}>Add line ⏎</button>
                </div>
                {spill && <div className={styles.note}>This batch has {left} left — the rest comes from the next batch on its own line.</div>}
                {tooMany && <div className={styles.warn}>Only {totalLeft} {baseUnit(drug)}s sellable in stock.</div>}
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
