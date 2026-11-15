import type { CartItem, Customer, Doctor, Invoice } from "../types";

export interface ReceiptLine {
  name: string;
  sub?: string;
  flag?: string;          // "Rx" | "HA" | "N" — regulatory class printed next to the item
  unit?: string;          // sale unit, e.g. "strip × 10", "tablet"
  directions?: string;    // e.g. "1 tablet, three times a day, for 3 days"
  qty: number;
  price: number;
  disc: number;           // discount rate %
  total: number;
}

export interface ReceiptPayment {
  method: string;         // Cash / Card / LankaQR
  amount: number;
  reference?: string;     // card approval code / last 4, QR transaction ref
}

export interface ReceiptData {
  title: string;
  number?: string;
  date: string;
  cashier?: string;
  terminal?: string;
  customer?: Customer | null;
  doctor?: Doctor | null;
  prescriptionId?: number | null;
  verifiedBy?: string;
  lines: ReceiptLine[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMode?: string;
  payment?: ReceiptPayment;
  tendered?: number;
  change?: number;
  loyaltyEarned?: number;
  notes?: string;
  footer?: string;
  reprint?: boolean;
}

// Store details printed in the receipt header. Override per branch with VITE_STORE_* in frontend/pos/.env
const env = import.meta.env;
export const STORE = {
  name: env.VITE_STORE_NAME || "AltusVera",
  tagline: env.VITE_STORE_TAGLINE || "National Medicines Regulatory Authority Licensed",
  address: env.VITE_STORE_ADDRESS || "No. 45, Galle Road, Colombo 03, Sri Lanka",
  phone: env.VITE_STORE_PHONE || "+94 11 234 5678",
  regNo: env.VITE_STORE_REG_NO || "NMRA/PH/2026/0001",
  terminal: env.VITE_TERMINAL_ID ?? "POS-01",
};

function esc(s: string | number | null | undefined): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const money = (n: number) => n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function flagOf(d: CartItem["drug"]): string | undefined {
  if (d.is_narcotic) return "N";
  if (d.is_high_alert) return "HA";
  if (d.is_prescription_only) return "Rx";
  return undefined;
}

export function cartToLines(items: CartItem[]): ReceiptLine[] {
  return items.map((i) => ({
    name: [i.drug.brand_name, i.drug.strength].filter(Boolean).join(" "),
    sub: [i.drug.generic_name,
      (i.batch?.batch_number ?? i.drug.batch_number) && `Batch ${i.batch?.batch_number ?? i.drug.batch_number}`,
      (i.batch?.expiry_date ?? i.drug.expiry_date) && `Exp ${(i.batch?.expiry_date ?? i.drug.expiry_date)!.slice(0, 7)}`]
      .filter(Boolean).join(" | "),
    flag: flagOf(i.drug),
    unit: i.sale_unit === "unit" ? (i.drug.base_unit || undefined) : i.sale_unit === "strip" ? `strip×${i.units_per}` : i.units_per > 1 ? `pack×${i.units_per}` : (i.drug.base_unit || undefined),
    directions: i.directions,
    qty: i.quantity,
    price: i.unit_price,
    disc: i.discount_rate,
    total: i.line_total,
  }));
}

export function invoiceToLines(inv: Invoice, nameOf: (drugId: number) => string): ReceiptLine[] {
  return inv.items.map((i) => ({
    name: nameOf(i.drug_id),
    qty: i.quantity,
    price: i.unit_price,
    disc: i.discount_rate,
    total: i.line_total,
  }));
}

const row = (l: string, r: string, cls = "") => `<tr class="${cls}"><td>${l}</td><td class="r">${r}</td></tr>`;

/** 80 mm thermal receipt in the layout used by retail pharmacies (header, bill meta, item table, totals, payment, footer). */
export function renderReceipt(d: ReceiptData): string {
  const itemCount = d.lines.reduce((s, l) => s + l.qty, 0);
  const gross = d.lines.reduce((s, l) => s + l.qty * l.price, 0);
  const hasFlags = d.lines.some((l) => l.flag);
  const items = d.lines.map((l, i) => `
    <tr class="it"><td class="no">${i + 1}</td><td colspan="4"><b>${esc(l.name)}</b>${l.flag ? ` <span class="fl">${l.flag}</span>` : ""}
      ${l.sub ? `<div class="s">${esc(l.sub)}</div>` : ""}${l.directions ? `<div class="dir">&#8478; ${esc(l.directions)}</div>` : ""}</td></tr>
    <tr><td></td><td class="r">${l.qty}${l.unit ? ` <span class="s">${esc(l.unit)}</span>` : ""}</td><td class="r">${money(l.price)}</td><td class="r">${l.disc ? `${l.disc}%` : "-"}</td><td class="r">${money(l.total)}</td></tr>`).join("");
  const pay = d.payment;
  const saved = d.discount > 0.004 ? d.discount : 0;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.number ?? d.title)}</title><style>
    @page { size: 80mm auto; margin: 3mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Consolas','Courier New',monospace; font-size: 11px; width: 74mm; margin: 0 auto; color:#000; line-height: 1.3; }
    .c { text-align:center; } .r { text-align:right; } .s { font-size: 9.5px; } b { font-weight: 700; }
    .store { font-size: 16px; font-weight: 700; text-align:center; letter-spacing: .5px; }
    .title { text-align:center; font-weight:700; font-size: 12px; margin: 5px 0; padding: 3px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; letter-spacing: 2px; }
    .meta { width:100%; } .meta td { padding: 0; } .meta td:first-child { width: 34%; }
    table { width:100%; border-collapse: collapse; } td { padding: 1px 0; vertical-align: top; }
    .head td { font-weight: 700; border-bottom: 1px solid #000; padding-bottom: 2px; font-size: 10px; }
    .it td { padding-top: 4px; } .no { width: 5mm; }
    .fl { border: 1px solid #000; font-size: 8.5px; padding: 0 2px; font-weight: 700; }
    hr { border:0; border-top:1px dashed #000; margin: 5px 0; }
    .grand td { font-size: 15px; font-weight: 700; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 0; }
    .saved { text-align:center; font-weight:700; border: 1px solid #000; padding: 2px; margin: 5px 0; }
    .rp { text-align:center; font-weight:700; font-size: 12px; }
    .dir { font-size: 10px; font-weight: 700; margin-top: 1px; }
  </style></head><body>
    <div class="store">${esc(STORE.name)}</div>
    <div class="c s">${[esc(STORE.tagline), STORE.address && esc(STORE.address), STORE.phone && `Tel: ${esc(STORE.phone)}`, STORE.regNo && `Pharmacy Reg. No: ${esc(STORE.regNo)}`].filter(Boolean).join("<br>")}</div>
    <div class="title">${esc(d.title)}</div>
    ${d.reprint ? `<div class="rp">*** DUPLICATE COPY ***</div>` : ""}
    <table class="meta">
      ${d.number ? row("Invoice No", `<b>${esc(d.number)}</b>`) : ""}
      ${row("Date/Time", esc(d.date))}
      ${row("Terminal", esc(d.terminal ?? STORE.terminal))}
      ${d.cashier ? row("Cashier", esc(d.cashier)) : ""}
      ${d.customer ? row("Patient", `${esc(d.customer.name)}${d.customer.contact_number ? `<br>${esc(d.customer.contact_number)}` : ""}`) : row("Patient", "Walk-in")}
      ${d.doctor ? row("Prescriber", `Dr. ${esc(d.doctor.name)}${d.doctor.slmc_reg_no ? `<br>SLMC ${esc(d.doctor.slmc_reg_no)}` : ""}`) : ""}
      ${d.prescriptionId ? row("Rx Ref", `#${d.prescriptionId}`) : ""}
      ${d.verifiedBy ? row("Checked by", esc(d.verifiedBy)) : ""}
    </table>
    <hr>
    <table>
      <tr class="head"><td class="no">#</td><td class="r">Qty</td><td class="r">Price</td><td class="r">Disc</td><td class="r">Amount</td></tr>
      ${items}
    </table>
    <hr>
    <table>
      ${row(`Items: ${d.lines.length} &nbsp; Qty: ${itemCount}`, "")}
      ${row("Gross Amount", money(gross))}
      ${saved ? row("Discount", `-${money(saved)}`) : ""}
      ${row("NET TOTAL (Rs.)", money(d.total), "grand")}
    </table>
    <table style="margin-top:4px">
      ${pay ? row(`Paid - ${esc(pay.method)}`, money(pay.amount)) : d.paymentMode ? row("Paid by", esc(d.paymentMode)) : ""}
      ${pay?.reference ? row(pay.method === "Card" ? "Approval / Ref" : "Txn Ref", esc(pay.reference)) : ""}
      ${d.tendered ? row("Cash Tendered", money(d.tendered)) + row("<b>Balance</b>", `<b>${money(d.change ?? 0)}</b>`) : ""}
    </table>
    ${saved ? `<div class="saved">YOU SAVED Rs. ${money(saved)}</div>` : ""}
    ${d.loyaltyEarned ? `<div class="c">Loyalty points earned: <b>${d.loyaltyEarned}</b>${d.customer ? ` | Total: <b>${(d.customer.loyalty_points ?? 0) + d.loyaltyEarned}</b>` : ""}</div>` : ""}
    ${d.notes ? `<hr><div class="s">Note: ${esc(d.notes)}</div>` : ""}
    ${hasFlags ? `<hr><div class="s">Rx = Prescription only &nbsp; HA = High alert &nbsp; N = Narcotic<br>Take medicines only as directed by your doctor or pharmacist.</div>` : ""}
    <hr>
    <div class="c s">
      ${esc(d.footer ?? "Thank you! Get well soon.")}<br>
      Please check your medicines and balance before leaving the counter.<br>
      Medicines once sold are returnable within 7 days with this receipt, unopened and as per pharmacy policy.
      Fridge items and narcotics are not returnable.
    </div>
    <div class="c s" style="margin-top:6px">Powered by AltusVera</div>
  </body></html>`;
}

type PrintResult = { ok: boolean; error?: string; printer?: string };
declare global {
  interface Window { electronAPI?: { platform: string; printReceipt?: (html: string) => Promise<PrintResult> } }
}

/** Desktop app: prints silently to the receipt printer. Browser: falls back to the browser print dialog. */
export async function printHtml(html: string): Promise<PrintResult> {
  if (window.electronAPI?.printReceipt) {
    try { return await window.electronAPI.printReceipt(html); }
    catch (e) { return { ok: false, error: String(e) }; }
  }
  printInBrowser(html);
  return { ok: true };
}

function printInBrowser(html: string) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentWindow!.document;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
    setTimeout(() => frame.remove(), 1000);
  }, 150);
}

const LAST_KEY = "pos_last_receipt";

export function saveLastReceipt(d: ReceiptData) {
  try { localStorage.setItem(LAST_KEY, JSON.stringify(d)); } catch { /* ignore */ }
}

export function loadLastReceipt(): ReceiptData | null {
  try { return JSON.parse(localStorage.getItem(LAST_KEY) ?? "null"); } catch { return null; }
}
