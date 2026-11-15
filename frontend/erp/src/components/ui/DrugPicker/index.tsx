import { useEffect, useRef, useState } from "react";
import { drugService } from "../../../services/drug.service";
import type { Drug } from "../../../types";
import styles from "./DrugPicker.module.css";

interface Props {
  label?: string;
  value: number;
  onChange: (drug: Drug | null) => void;
  placeholder?: string;
}

/** Search-by-name drug selector (brand, generic or item code). */
export function DrugPicker({ label, value, onChange, placeholder = "Search drug by name or code…" }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Drug[]>([]);
  const [selected, setSelected] = useState<Drug | null>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<number>();

  useEffect(() => {
    if (!value) { setSelected(null); return; }
    if (selected?.id === value) return;
    drugService.getById(value).then(setSelected).catch(() => setSelected(null));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  function search(text: string) {
    setQ(text);
    setOpen(true);
    window.clearTimeout(timer.current);
    if (text.trim().length < 2) { setResults([]); return; }
    timer.current = window.setTimeout(async () => {
      try { setResults((await drugService.search(text.trim())).slice(0, 12)); } catch { setResults([]); }
    }, 250);
  }

  function pick(d: Drug) {
    setSelected(d); setOpen(false); setQ(""); setResults([]);
    onChange(d);
  }

  return (
    <div className={styles.wrap}>
      {label && <label className={styles.label}>{label}</label>}
      {selected ? (
        <div className={styles.chip}>
          <div>
            <div className={styles.chipName}>{selected.brand_name}</div>
            <div className={styles.chipSub}>{selected.item_code} · {selected.generic_name} · Stock {selected.quantity}</div>
          </div>
          <button type="button" className={styles.clear} onClick={() => { setSelected(null); onChange(null); }}>✕</button>
        </div>
      ) : (
        <input
          className={styles.input}
          value={q}
          placeholder={placeholder}
          onChange={(e) => search(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        />
      )}
      {open && results.length > 0 && !selected && (
        <ul className={styles.list}>
          {results.map((d) => (
            <li key={d.id} onMouseDown={() => pick(d)}>
              <strong>{d.brand_name}</strong> <span>{d.item_code} · {d.generic_name} · Stock {d.quantity}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
