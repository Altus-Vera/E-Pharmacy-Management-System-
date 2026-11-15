import type { CartItem, Customer, Doctor, Invoice } from "../types";

export interface ReceiptData {
  title: string;
  number?: string;
  date: string;
  cashier?: string;
  customer?: Customer | null;
  doctor?: Doctor | null;
  lines: { name: string; sub?: string; qty: number; price: number; disc: number; total: number }[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMode?: string;
  tendered?: number;
  change?: number;
  notes?: string;
  footer?: string;
}

const STORE_NAME = "AltusVera";
const STORE_SUB = "National Medicines Regulatory Authority Licensed";

function esc(s: string | number | null | undefined): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const money = (n: number) => n.toFixed(2);

export function cartToLines(items: CartItem[]): ReceiptData["lines"] {
  return items.map((i) => ({
    name: i.drug.brand_name,
    sub: [i.drug.generic_name, i.drug.strength, i.drug.batch_number && `B:${i.drug.batch_number}`].filter(Boolean).join(" · "),
    qty: i.quantity,
    price: i.unit_price,
    disc: i.discount_rate,
    total: i.line_total,
  }));
}

export function invoiceToLines(inv: Invoice, nameOf: (drugId: number) => string): ReceiptData["lines"] {
  return inv.items.map((i) => ({
    name: nameOf(i.drug_id),
    qty: i.quantity,
    price: i.unit_price,
    disc: i.discount_rate,
    total: i.line_total,
  }));
}

export function renderReceipt(d: ReceiptData): string {
  const rows = d.lines
    .map(
      (l) => `<tr><td colspan="4" class="n">${esc(l.name)}${l.sub ? `<div class="s">${esc(l.sub)}</div>` : ""}</td></tr>
      <tr><td></td><td class="r">${l.qty} x ${money(l.price)}</td><td class="r">${l.disc ? `-${l.disc}%` : ""}</td><td class="r">${money(l.total)}</td></tr>`
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.title)}</title><style>
    @page { size: 80mm auto; margin: 4mm; }
    body { font-family: 'Consolas','Courier New',monospace; font-size: 11px; width: 72mm; margin: 0 auto; color:#000; }
    h1 { font-size: 15px; text-align:center; margin: 0; } .c { text-align:center; } .s { font-size: 9px; color:#333; }
    .t { text-align:center; font-weight:bold; margin: 6px 0; border-top:1px dashed #000; border-bottom:1px dashed #000; padding:3px 0; letter-spacing:1px; }
    table { width:100%; border-collapse: collapse; } td { padding: 1px 0; vertical-align: top; } .r { text-align:right; } .n { font-weight:bold; padding-top:3px; }
    .tot td { padding: 2px 0; } .grand td { font-size: 14px; font-weight: bold; border-top:1px dashed #000; padding-top:4px; }
    .meta div { display:flex; justify-content:space-between; } hr { border:0; border-top:1px dashed #000; margin:6px 0; }
  </style></head><body>
    <h1>${STORE_NAME}</h1><div class="c s">${STORE_SUB}</div>
    <div class="t">${esc(d.title)}</div>
    <div class="meta">
      ${d.number ? `<div><span>No</span><span>${esc(d.number)}</span></div>` : ""}
      <div><span>Date</span><span>${esc(d.date)}</span></div>
      ${d.cashier ? `<div><span>Cashier</span><span>${esc(d.cashier)}</span></div>` : ""}
      ${d.customer ? `<div><span>Patient</span><span>${esc(d.customer.name)}</span></div>` : ""}
      ${d.doctor ? `<div><span>Prescriber</span><span>Dr. ${esc(d.doctor.name)}</span></div>` : ""}
    </div><hr>
    <table>${rows}</table><hr>
    <table class="tot">
      <tr><td>Sub Total</td><td class="r">${money(d.subtotal)}</td></tr>
      ${d.discount > 0 ? `<tr><td>Discount</td><td class="r">-${money(d.discount)}</td></tr>` : ""}
      <tr class="grand"><td>TOTAL (Rs.)</td><td class="r">${money(d.total)}</td></tr>
      ${d.paymentMode ? `<tr><td>Paid by</td><td class="r">${esc(d.paymentMode.toUpperCase())}</td></tr>` : ""}
      ${d.tendered ? `<tr><td>Tendered</td><td class="r">${money(d.tendered)}</td></tr><tr><td>Change</td><td class="r">${money(d.change ?? 0)}</td></tr>` : ""}
    </table>
    ${d.notes ? `<hr><div class="s">Note: ${esc(d.notes)}</div>` : ""}
    <hr><div class="c s">${esc(d.footer ?? "Thank you! Get well soon.")}<br>Medicines once sold are returnable only as per pharmacy policy.</div>
  </body></html>`;
}

export function printHtml(html: string) {
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
