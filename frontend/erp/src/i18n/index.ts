/**
 * Screen-level translation for the ERP (English / Tamil / Sinhala).
 *
 * Instead of wrapping every label in t(), this watches the page and swaps any text it has a
 * translation for: static labels, menu items, table headers, button text, placeholders,
 * tooltips and values that come from the database (statuses, roles, units…). Anything not in
 * the dictionary — drug, patient and supplier names, numbers, codes — stays as it is.
 *
 * Keys are the English text. Digits are normalised to "#", so "Tick all lines (2/3)" matches
 * the key "Tick all lines (#/#)" and the numbers are put back in order.
 * Add data-no-i18n to an element to leave it (and everything inside) untouched.
 */
import ta from "./ta.json";
import si from "./si.json";

export type Lang = "en" | "ta" | "si";
export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ta", label: "தமிழ்" },
  { code: "si", label: "සිංහල" },
];

const KEY = "erp_lang";
const DICTS: Record<Lang, Record<string, string>> = { en: {}, ta: ta as Record<string, string>, si: si as Record<string, string> };
const lower: Record<Lang, Map<string, string>> = { en: new Map(), ta: new Map(), si: new Map() };
for (const l of ["ta", "si"] as Lang[]) for (const [k, v] of Object.entries(DICTS[l])) lower[l].set(norm(k).toLowerCase(), v);

let lang: Lang = (localStorage.getItem(KEY) as Lang) || "en";
if (!DICTS[lang]) lang = "en";
const listeners = new Set<(l: Lang) => void>();

export const getLang = () => lang;
export function onLangChange(fn: (l: Lang) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

function norm(s: string) { return s.replace(/\s+/g, " ").trim(); }

/** Translate one English string into the current language (returns it unchanged if unknown). */
export function tr(text: string, l: Lang = lang): string {
  if (l === "en" || !text) return text;
  const core = norm(text);
  if (!core || !/[A-Za-z]/.test(core)) return text;
  const lead = text.match(/^\s*/)![0], trail = text.match(/\s*$/)![0];
  const hit = look(core, l);
  return hit == null ? text : lead + hit + trail;
}

function look(core: string, l: Lang): string | null {
  const d = DICTS[l], m = lower[l];
  const direct = d[core] ?? m.get(core.toLowerCase());
  if (direct != null) return direct;
  // numbers → "#"
  const nums = core.match(/\d+(?:[.,]\d+)*/g);
  if (nums) {
    const key = core.replace(/\d+(?:[.,]\d+)*/g, "#");
    const v = d[key] ?? m.get(key.toLowerCase());
    if (v != null) { let i = 0; return v.replace(/#/g, () => nums[i++] ?? "#"); }
  }
  // raw database values: "partially_received" → "partially received"
  if (core.includes("_")) { const v = look(core.replace(/_/g, " "), l); if (v != null) return v; }
  // trailing punctuation / icons: "Supplier:", "Name *", "📷 Scan Invoice", "Save →"
  const pm = core.match(/^([^A-Za-z0-9]*)(.*?)([\s:*.…→←✓✔!?%]*)$/u);
  if (pm && (pm[1] || pm[3]) && pm[2]) {
    const inner = look(pm[2], l);
    if (inner != null) return pm[1] + inner + pm[3];
  }
  return null;
}

/* ── DOM layer ─────────────────────────────────────────── */
const ATTRS = ["placeholder", "title", "aria-label"];
type Rec = { orig: string; shown: string };
const textRec = new WeakMap<Text, Rec>();
const attrRec = new WeakMap<Element, Record<string, Rec>>();
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE"]);

function skipped(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    if (SKIP.has(e.tagName) || e.hasAttribute("data-no-i18n") || (e as HTMLElement).isContentEditable) return true;
  }
  return false;
}

function doText(n: Text) {
  const r = textRec.get(n), cur = n.nodeValue ?? "";
  const orig = r && cur === r.shown ? r.orig : cur;   // React wrote something new → that's the new original
  const shown = tr(orig);
  if (shown !== cur) n.nodeValue = shown;
  if (shown !== orig || r) textRec.set(n, { orig, shown });
}

function doAttrs(el: Element) {
  let recs = attrRec.get(el);
  for (const a of ATTRS) {
    const cur = el.getAttribute(a);
    if (cur == null) continue;
    const r = recs?.[a];
    const orig = r && cur === r.shown ? r.orig : cur;
    const shown = tr(orig);
    if (shown !== cur) el.setAttribute(a, shown);
    if (shown !== orig || r) { recs ??= {}; recs[a] = { orig, shown }; attrRec.set(el, recs); }
  }
  // <input type="button|submit" value="…">
  if (el instanceof HTMLInputElement && (el.type === "button" || el.type === "submit")) {
    const r = recs?.value, cur = el.value, orig = r && cur === r.shown ? r.orig : cur, shown = tr(orig);
    if (shown !== cur) el.value = shown;
    if (shown !== orig || r) { recs ??= {}; recs.value = { orig, shown }; attrRec.set(el, recs); }
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) { if (!skipped(root.parentElement)) doText(root as Text); return; }
  if (!(root instanceof Element) || skipped(root)) return;
  doAttrs(root);
  const it = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: n => n instanceof Element && (SKIP.has(n.tagName) || n.hasAttribute("data-no-i18n")) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  for (let n = it.nextNode(); n; n = it.nextNode()) n.nodeType === Node.TEXT_NODE ? doText(n as Text) : doAttrs(n as Element);
}

let busy = false;
const observer = new MutationObserver(muts => {
  if (busy) return;
  busy = true;
  try {
    for (const m of muts) {
      if (m.type === "characterData") walk(m.target);
      else if (m.type === "attributes") { if (!skipped(m.target as Element)) doAttrs(m.target as Element); }
      else m.addedNodes.forEach(walk);
    }
  } finally { observer.takeRecords(); busy = false; }
});

function applyDocLang() {
  document.documentElement.lang = lang;
  document.documentElement.dataset.lang = lang;
  document.title = tr("AltusVera ERP");
}

export function setLang(l: Lang) {
  if (l === lang) return;
  lang = l; localStorage.setItem(KEY, l);
  busy = true;
  try { walk(document.body); } finally { observer.takeRecords(); busy = false; }
  applyDocLang();
  listeners.forEach(fn => fn(l));
}

/** Start watching the page. Call once before rendering. */
export function initI18n() {
  applyDocLang();
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS, "value"] });
  walk(document.body);
  // browser pop-ups
  const { alert, confirm, prompt } = window;
  window.alert = (m?: unknown) => alert(typeof m === "string" ? tr(m) : m);
  window.confirm = (m?: string) => confirm(m && tr(m));
  window.prompt = (m?: string, d?: string) => prompt(m && tr(m), d);
}
