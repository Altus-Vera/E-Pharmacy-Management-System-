import { useState, useCallback, useEffect, useRef } from "react";
import { drugService } from "../../services/drug.service";
import { customerService } from "../../services/customer.service";
import { doctorService } from "../../services/doctor.service";
import { invoiceService } from "../../services/invoice.service";
import api from "../../services/api";
import { useCartStore } from "../../store/cartStore";
import { useAuthStore } from "../../store/authStore";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { formatCurrency, formatDate, formatDateTime } from "../../utils/formatters";
import {
  cartToLines, invoiceToLines, loadLastReceipt, printHtml, renderReceipt, saveLastReceipt, type ReceiptData,
} from "../../utils/receipt";
import type { Drug, Customer, Doctor, PaymentMode, Invoice, Gender, SalesReturnReason } from "../../types";
import styles from "./Dispensing.module.css";

// ── helpers ──────────────────────────────────────────────────────────────────

function isColdChain(drug: Drug): boolean {
  const s = (drug.storage_requirements ?? "").toLowerCase();
  return (s.includes("2") && s.includes("8")) || s.includes("refriger") || s.includes("cold");
}

function expiryWarning(expiry: string | null): "danger" | "warning" | null {
  if (!expiry) return null;
  const days = (new Date(expiry).getTime() - Date.now()) / (1000 * 3600 * 24);
  if (days < 0) return "danger";
  if (days < 90) return "warning";
  return null;
}

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const PAY_LABEL: Record<string, string> = { cash: "Cash", card: "Card", qr: "LankaQR", other: "LankaQR" };
const apiPayMode = (m: PaymentMode): "cash" | "card" | "other" => (m === "cash" || m === "card" ? m : "other");
const isTyping = (el: Element | null) =>
  !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");

type ModalKind =
  | null | "customer" | "doctor" | "priceCheck" | "qty" | "lineDisc" | "billDisc" | "note"
  | "hold" | "recall" | "sales" | "return" | "xreport" | "newPatient" | "history" | "help" | "confirmNew";

type FnAction =
  | "patient" | "prescriber" | "search" | "priceCheck" | "qty" | "lineDisc" | "voidLine"
  | "hold" | "recall" | "billDisc" | "note" | "newSale";

type ActAction =
  | "sales" | "void" | "return" | "reprint" | "repeat" | "quote"
  | "newPatient" | "history" | "xreport" | "lock" | "fullscreen" | "help";

// ── function key definitions (12 slots, 3 cols × 4 rows) ─────────────────────
const FN_BUTTONS: { label: string; sub: string; color: string; action: FnAction }[] = [
  { label: "Link Patient",    sub: "F4",       color: "blue",   action: "patient" },
  { label: "Link Prescriber", sub: "F5",       color: "teal",   action: "prescriber" },
  { label: "Drug Search",     sub: "F1",       color: "purple", action: "search" },
  { label: "Price Check",     sub: "F2",       color: "orange", action: "priceCheck" },
  { label: "Change Qty",      sub: "F8",       color: "blue",   action: "qty" },
  { label: "Line Discount",   sub: "F9",       color: "teal",   action: "lineDisc" },
  { label: "Void Line",       sub: "DEL",      color: "pink",   action: "voidLine" },
  { label: "Hold Bill",       sub: "F6",       color: "orange", action: "hold" },
  { label: "Recall Bill",     sub: "F7",       color: "purple", action: "recall" },
  { label: "Bill Discount",   sub: "F10",      color: "teal",   action: "billDisc" },
  { label: "Bill Note",       sub: "ALT+N",    color: "blue",   action: "note" },
  { label: "New Sale",        sub: "CTRL+DEL", color: "pink",   action: "newSale" },
];

// ── action button definitions (12 slots, 3 cols × 4 rows) ────────────────────
const ACTION_BUTTONS: { label: string; sub?: string; action: ActAction }[] = [
  { label: "Recent Sales",    action: "sales" },
  { label: "Void Invoice",    action: "void" },
  { label: "Sales Return",    action: "return" },
  { label: "Reprint Last",    sub: "F3", action: "reprint" },
  { label: "Repeat Last",     action: "repeat" },
  { label: "Print Quote",     action: "quote" },
  { label: "New Patient",     action: "newPatient" },
  { label: "Patient History", action: "history" },
  { label: "Day Summary",     action: "xreport" },
  { label: "Lock Terminal",   action: "lock" },
  { label: "Full Screen",     sub: "F11", action: "fullscreen" },
  { label: "Shortcuts",       sub: "?", action: "help" },
];

const RETURN_REASONS: { value: SalesReturnReason; label: string }[] = [
  { value: "damaged", label: "Damaged" },
  { value: "expired", label: "Expired" },
  { value: "wrong_item", label: "Wrong item" },
  { value: "patient_refusal", label: "Patient refusal" },
  { value: "other", label: "Other" },
];

const LAST_INVOICE_KEY = "pos_last_invoice_id";

// ── component ─────────────────────────────────────────────────────────────────

export function DispensingPage() {
  const searchRef = useRef<HTMLInputElement>(null);
  const user = useAuthStore((s) => s.user);

  // drug search
  const [drugQuery, setDrugQuery] = useState("");
  const [drugResults, setDrugResults] = useState<Drug[]>([]);
  const [searching, setSearching] = useState(false);

  // modal routing
  const [modal, setModal] = useState<ModalKind>(null);
  const [salesMode, setSalesMode] = useState<"view" | "void" | "return">("view");
  const closeModal = useCallback(() => { setModal(null); setTimeout(() => searchRef.current?.focus(), 0); }, []);

  // customer / doctor search
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [doctorQuery, setDoctorQuery] = useState("");
  const [doctorResults, setDoctorResults] = useState<Doctor[]>([]);

  // price check
  const [pcQuery, setPcQuery] = useState("");
  const [pcResults, setPcResults] = useState<Drug[]>([]);

  // generic numeric/text input used by qty, discounts, note, hold label
  const [inputVal, setInputVal] = useState("");
  const [discMode, setDiscMode] = useState<"pct" | "amt">("pct");

  // recent sales / void / return
  const [sales, setSales] = useState<Invoice[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [returnQty, setReturnQty] = useState<Record<number, number>>({});
  const [returnReason, setReturnReason] = useState<SalesReturnReason>("damaged");
  const [returnNote, setReturnNote] = useState("");
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // patient history
  const [history, setHistory] = useState<Invoice[]>([]);

  // new patient
  const [np, setNp] = useState({ name: "", contact_number: "", gender: "" as "" | Gender, dob: "", clinical_remarks: "" });

  // lock
  const [locked, setLocked] = useState(false);
  const [lockUser, setLockUser] = useState("");
  const [lockPass, setLockPass] = useState("");
  const [lockError, setLockError] = useState<string | null>(null);

  // cash
  const [cashTendered, setCashTendered] = useState<string>("");

  // checkout
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<{ number: string; change: number; receipt: ReceiptData } | null>(null);

  // POM warning
  const [pomWarningDrug, setPomWarningDrug] = useState<Drug | null>(null);

  // toast
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "warn" | "err" } | null>(null);
  const notify = useCallback((msg: string, kind: "ok" | "warn" | "err" = "ok") => {
    setToast({ msg, kind });
    window.setTimeout(() => setToast((t) => (t?.msg === msg ? null : t)), 2800);
  }, []);

  const {
    items, customer, doctor, paymentMode, notes, billDiscount, selectedId, heldBills,
    setCustomer, setDoctor, setPaymentMode, setNotes, setBillDiscount, select, selectNext,
    addItem, updateQuantity, updateDiscount, removeItem, clearCart, holdBill, recallBill, deleteHeld,
    subtotal, totalDiscount, total,
  } = useCartStore();

  const selectedItem = items.find((i) => i.drug.id === selectedId) ?? null;

  // ── drug search ────────────────────────────────────────────────────────────

  const searchDrugs = useCallback(async (q: string) => {
    setDrugQuery(q);
    if (q.length < 2) { setDrugResults([]); return; }
    setSearching(true);
    try {
      setDrugResults(await drugService.search(q));
    } catch { setDrugResults([]); }
    finally { setSearching(false); }
  }, []);

  function handleKbKey(key: string) {
    if (key === "SHIFT" || key === "CTRL" || key === "ALT") return;
    if (key === "ENTER") { void handleSearchEnter(); return; }
    const newQuery =
      key === "⌫"    ? drugQuery.slice(0, -1) :
      key === "SPACE" ? drugQuery + " " :
      drugQuery + key;
    searchDrugs(newQuery);
    searchRef.current?.focus();
  }

  // Barcode scanners type the code then send Enter: add an exact item-code match straight away.
  async function handleSearchEnter() {
    const q = drugQuery.trim();
    if (!q) return;
    let list = drugResults;
    if (!list.length || searching) {
      try { list = await drugService.search(q); setDrugResults(list); } catch { list = []; }
    }
    const exact = list.find((d) => d.item_code.toLowerCase() === q.toLowerCase());
    const pick = exact ?? (list.length === 1 ? list[0] : null);
    if (pick) handleAddDrug(pick);
    else if (!list.length) notify(`No item matches "${q}"`, "warn");
  }

  // ── customer / doctor ──────────────────────────────────────────────────────

  async function searchCustomers(q: string) {
    setCustomerQuery(q);
    if (q.length < 2) { setCustomerResults([]); return; }
    try { setCustomerResults(await customerService.search(q)); }
    catch { setCustomerResults([]); }
  }

  async function searchDoctors(q: string) {
    setDoctorQuery(q);
    if (q.length < 2) { setDoctorResults([]); return; }
    try { setDoctorResults(await doctorService.search(q)); }
    catch { setDoctorResults([]); }
  }

  function selectCustomer(c: Customer) {
    setCustomer(c);
    closeModal();
    setCustomerResults([]);
    setCustomerQuery("");
  }

  function selectDoctor(d: Doctor) {
    setDoctor(d);
    closeModal();
    setDoctorResults([]);
    setDoctorQuery("");
  }

  // ── cart ───────────────────────────────────────────────────────────────────

  function canAdd(drug: Drug): boolean {
    if (expiryWarning(drug.expiry_date) === "danger") {
      notify(`${drug.brand_name} batch is EXPIRED — cannot dispense`, "err");
      return false;
    }
    const inCart = items.find((i) => i.drug.id === drug.id)?.quantity ?? 0;
    if (drug.quantity <= inCart) {
      notify(drug.quantity === 0 ? `${drug.brand_name} is out of stock` : `Only ${drug.quantity} in stock`, "err");
      return false;
    }
    return true;
  }

  function handleAddDrug(drug: Drug) {
    if (!canAdd(drug)) return;
    // Show POM advisory if no doctor linked — but don't block
    if (drug.is_prescription_only && !doctor) {
      setPomWarningDrug(drug);
      return;
    }
    addItem(drug);
    setDrugQuery("");
    setDrugResults([]);
    searchRef.current?.focus();
  }

  function addPomAnyway() {
    if (pomWarningDrug) {
      addItem(pomWarningDrug);
      setPomWarningDrug(null);
      setDrugQuery("");
      setDrugResults([]);
      searchRef.current?.focus();
    }
  }

  const netTotal = total();
  const lineDiscTotal = totalDiscount() - billDiscount;
  const tendered = parseFloat(cashTendered) || 0;
  const change = tendered - netTotal;
  const hasPom = items.some(i => i.drug.is_prescription_only);
  const isRxSale = !!doctor || hasPom;
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  function handleNumpad(key: string) {
    if (key === "⌫") {
      setCashTendered(prev => prev.slice(0, -1));
    } else if (key === ".") {
      setCashTendered(prev => prev.includes(".") ? prev : prev + ".");
    } else {
      setCashTendered(prev => (prev === "0" ? key : prev + key));
    }
  }

  function buildReceipt(title: string, extra: Partial<ReceiptData> = {}): ReceiptData {
    return {
      title,
      date: formatDateTime(new Date().toISOString()),
      cashier: user?.name,
      customer,
      doctor,
      lines: cartToLines(items),
      subtotal: subtotal(),
      discount: totalDiscount(),
      total: netTotal,
      notes: notes || undefined,
      ...extra,
    };
  }

  async function handleCheckout() {
    if (items.length === 0) return;
    if (paymentMode === "cash" && tendered > 0 && tendered < netTotal) {
      setCheckoutError(`Cash tendered (Rs. ${tendered.toFixed(2)}) is less than the net payable.`);
      return;
    }
    setCheckoutError(null);
    setSubmitting(true);
    try {
      const sub = subtotal();
      const invoice = await invoiceService.create({
        customer_id: customer?.id,
        doctor_id: doctor?.id,
        items: items.map((i) => ({
          drug_id: i.drug.id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount_rate: i.discount_rate,
          discount_amount: +(i.unit_price * i.quantity - i.line_total).toFixed(2),
          line_total: +i.line_total.toFixed(2),
        })),
        subtotal: +sub.toFixed(2),
        discount_amount: +(sub - netTotal).toFixed(2),
        tax_rate: 0,
        tax_amount: 0,
        total_amount: +netTotal.toFixed(2),
        payment_mode: apiPayMode(paymentMode),
        notes: notes || undefined,
      });
      const paidCash = paymentMode === "cash" ? (tendered || netTotal) : 0;
      const receipt = buildReceipt("TAX INVOICE", {
        number: invoice.invoice_number,
        paymentMode: PAY_LABEL[paymentMode],
        tendered: paymentMode === "cash" ? paidCash : undefined,
        change: paymentMode === "cash" ? paidCash - netTotal : undefined,
      });
      saveLastReceipt(receipt);
      try { localStorage.setItem(LAST_INVOICE_KEY, String(invoice.id)); } catch { /* ignore */ }
      setLastSale({ number: invoice.invoice_number, change: paidCash - netTotal, receipt });
      clearCart();
      setDrugResults([]);
      setDrugQuery("");
      setCashTendered("");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setCheckoutError(msg ?? "Checkout failed. Please check stock levels and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── function key actions ───────────────────────────────────────────────────

  function needSelected(): boolean {
    if (!selectedItem) { notify("Select a line in the tray first", "warn"); return false; }
    return true;
  }

  function runFn(action: FnAction) {
    setModalError(null);
    switch (action) {
      case "patient":    setModal("customer"); break;
      case "prescriber": setModal("doctor"); break;
      case "search":     searchRef.current?.focus(); break;
      case "priceCheck": setPcQuery(""); setPcResults([]); setModal("priceCheck"); break;
      case "qty":
        if (needSelected()) { setInputVal(String(selectedItem!.quantity)); setModal("qty"); }
        break;
      case "lineDisc":
        if (needSelected()) { setInputVal(String(selectedItem!.discount_rate || "")); setModal("lineDisc"); }
        break;
      case "voidLine":
        if (needSelected()) { removeItem(selectedItem!.drug.id); notify(`Removed ${selectedItem!.drug.brand_name}`); }
        break;
      case "hold":
        if (!items.length) { notify("Nothing to hold — the tray is empty", "warn"); break; }
        setInputVal(customer?.name ?? ""); setModal("hold");
        break;
      case "recall":     setModal("recall"); break;
      case "billDisc":
        if (!items.length) { notify("Add items before applying a bill discount", "warn"); break; }
        setDiscMode("amt"); setInputVal(billDiscount ? String(billDiscount) : ""); setModal("billDisc");
        break;
      case "note":       setInputVal(notes); setModal("note"); break;
      case "newSale":
        if (items.length) setModal("confirmNew");
        else { clearCart(); setCashTendered(""); }
        break;
    }
  }

  function applyQty() {
    const q = Math.floor(Number(inputVal));
    if (!selectedItem || inputVal === "" || !Number.isFinite(q) || q < 0) { setModalError("Enter a valid quantity"); return; }
    if (q > selectedItem.drug.quantity) { setModalError(`Only ${selectedItem.drug.quantity} in stock`); return; }
    updateQuantity(selectedItem.drug.id, q);
    closeModal();
  }

  async function openSales(mode: "view" | "void" | "return") {
    setSalesMode(mode);
    setActiveInvoice(null);
    setModalError(null);
    setVoidReason("");
    setModal("sales");
    setSalesLoading(true);
    try { setSales(await invoiceService.list({ from: startOfToday() })); }
    catch { setSales([]); setModalError("Could not load today's sales."); }
    finally { setSalesLoading(false); }
  }

  async function pickInvoice(inv: Invoice) {
    setModalError(null);
    try {
      const full = await invoiceService.getById(inv.id);
      setActiveInvoice(full);
      if (salesMode === "return") {
        setReturnQty({});
        setReturnReason("damaged");
        setReturnNote("");
        setModal("return");
      }
    } catch { setModalError("Could not load invoice details."); }
  }

  function printInvoice(inv: Invoice, title = "TAX INVOICE (COPY)") {
    printHtml(renderReceipt({
      title,
      number: inv.invoice_number,
      date: formatDateTime(inv.created_at),
      customer: inv.customer ?? null,
      lines: invoiceToLines(inv, (id) => inv.items.find((i) => i.drug_id === id)?.drug?.brand_name ?? `Item #${id}`),
      subtotal: inv.subtotal,
      discount: inv.discount_amount,
      total: inv.total_amount,
      paymentMode: PAY_LABEL[inv.payment_mode] ?? String(inv.payment_mode),
      notes: inv.notes ?? undefined,
    }));
  }

  async function addInvoiceToCart(invoiceId: number) {
    try {
      const inv = await invoiceService.getById(invoiceId);
      let added = 0;
      for (const it of inv.items) {
        if (!it.drug) continue;
        const fresh = await drugService.getById(it.drug_id);
        if (expiryWarning(fresh.expiry_date) === "danger" || fresh.quantity <= 0) continue;
        addItem(fresh, Math.min(it.quantity, fresh.quantity));
        added++;
      }
      if (inv.customer && !customer) setCustomer(inv.customer);
      notify(added ? `Added ${added} item(s) from ${inv.invoice_number}` : "No items could be re-added (stock/expiry)", added ? "ok" : "warn");
      closeModal();
    } catch { notify("Could not load that sale", "err"); }
  }

  async function runAction(action: ActAction) {
    setModalError(null);
    switch (action) {
      case "sales":  void openSales("view"); break;
      case "void":   void openSales("void"); break;
      case "return": void openSales("return"); break;
      case "reprint": {
        const r = loadLastReceipt();
        if (r) printHtml(renderReceipt({ ...r, title: `${r.title} (REPRINT)` }));
        else notify("No previous receipt on this terminal", "warn");
        break;
      }
      case "repeat": {
        let id: string | null = null;
        try { id = localStorage.getItem(LAST_INVOICE_KEY); } catch { /* ignore */ }
        if (id) void addInvoiceToCart(Number(id));
        else notify("No previous sale on this terminal", "warn");
        break;
      }
      case "quote":
        if (!items.length) { notify("Add items to print a quotation", "warn"); break; }
        printHtml(renderReceipt(buildReceipt("QUOTATION", { footer: "Prices valid today only. This is not a tax invoice." })));
        break;
      case "newPatient":
        setNp({ name: "", contact_number: "", gender: "", dob: "", clinical_remarks: "" });
        setModal("newPatient");
        break;
      case "history":
        if (!customer) { notify("Link a patient first (F4)", "warn"); break; }
        setHistory([]);
        setModal("history");
        try { setHistory(await invoiceService.getByCustomer(customer.id)); }
        catch { setModalError("Could not load purchase history."); }
        break;
      case "xreport": void openXReport(); break;
      case "lock":
        setLockUser(user?.username ?? "");
        setLockPass("");
        setLockError(null);
        setLocked(true);
        break;
      case "fullscreen":
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => notify("Full screen not allowed here", "warn"));
        break;
      case "help": setModal("help"); break;
    }
  }

  async function openXReport() {
    setModal("xreport");
    setSalesLoading(true);
    try { setSales(await invoiceService.list({ from: startOfToday() })); }
    catch { setSales([]); setModalError("Could not load today's sales."); }
    finally { setSalesLoading(false); }
  }

  const xr = (() => {
    const done = sales.filter((s) => s.status !== "cancelled");
    const byMode: Record<string, { n: number; amt: number }> = {};
    for (const s of done) {
      const k = PAY_LABEL[s.payment_mode] ?? String(s.payment_mode);
      byMode[k] = byMode[k] ?? { n: 0, amt: 0 };
      byMode[k].n++;
      byMode[k].amt += s.total_amount;
    }
    return {
      count: done.length,
      voided: sales.length - done.length,
      gross: done.reduce((a, s) => a + s.subtotal, 0),
      disc: done.reduce((a, s) => a + s.discount_amount, 0),
      net: done.reduce((a, s) => a + s.total_amount, 0),
      byMode,
    };
  })();

  function printXReport() {
    const rows = Object.entries(xr.byMode).map(([k, v]) => `<tr><td>${k} (${v.n})</td><td class="r">${v.amt.toFixed(2)}</td></tr>`).join("");
    printHtml(`<!doctype html><html><head><meta charset="utf-8"><style>
      @page{size:80mm auto;margin:4mm} body{font-family:Consolas,monospace;font-size:11px;width:72mm;margin:0 auto}
      h1{font-size:14px;text-align:center;margin:0} table{width:100%} .r{text-align:right} hr{border:0;border-top:1px dashed #000}
      </style></head><body><h1>E-Pharmacy</h1><div style="text-align:center">X-REPORT (DAY SUMMARY)</div>
      <div style="text-align:center">${formatDateTime(new Date().toISOString())}${user ? ` · ${user.name}` : ""}</div><hr>
      <table><tr><td>Invoices</td><td class="r">${xr.count}</td></tr><tr><td>Voided</td><td class="r">${xr.voided}</td></tr>
      <tr><td>Gross sales</td><td class="r">${xr.gross.toFixed(2)}</td></tr><tr><td>Discounts</td><td class="r">-${xr.disc.toFixed(2)}</td></tr>
      <tr><td><b>Net sales</b></td><td class="r"><b>${xr.net.toFixed(2)}</b></td></tr></table><hr><table>${rows}</table></body></html>`);
  }

  async function submitVoid() {
    if (!activeInvoice) return;
    if (voidReason.trim().length < 3) { setModalError("Enter a reason (min 3 characters)."); return; }
    setModalBusy(true);
    try {
      await invoiceService.cancel(activeInvoice.id, voidReason.trim());
      notify(`${activeInvoice.invoice_number} voided — stock restored`);
      setActiveInvoice(null);
      setVoidReason("");
      setSales(await invoiceService.list({ from: startOfToday() }));
    } catch (err: unknown) {
      setModalError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Void failed.");
    } finally { setModalBusy(false); }
  }

  async function submitReturn() {
    if (!activeInvoice) return;
    const lines = activeInvoice.items.filter((i) => (returnQty[i.id] ?? 0) > 0);
    if (!lines.length) { setModalError("Enter a return quantity for at least one item."); return; }
    setModalBusy(true);
    try {
      for (const l of lines) {
        const q = returnQty[l.id];
        await invoiceService.createReturn({
          invoice_id: activeInvoice.id,
          drug_id: l.drug_id,
          quantity: q,
          refund_amount: +((l.line_total / l.quantity) * q).toFixed(2),
          reason: returnReason,
          notes: returnNote || undefined,
        });
      }
      notify(`Return recorded for ${activeInvoice.invoice_number} — pending manager approval`);
      closeModal();
    } catch (err: unknown) {
      setModalError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Return failed.");
    } finally { setModalBusy(false); }
  }

  async function submitNewPatient() {
    if (np.name.trim().length < 2 || np.contact_number.trim().length < 7) {
      setModalError("Name and a valid contact number are required.");
      return;
    }
    setModalBusy(true);
    try {
      const c = await customerService.create({
        name: np.name.trim(),
        contact_number: np.contact_number.trim(),
        gender: np.gender || undefined,
        dob: np.dob || undefined,
        clinical_remarks: np.clinical_remarks.trim() || undefined,
      });
      setCustomer(c);
      notify(`Patient ${c.name} registered and linked`);
      closeModal();
    } catch (err: unknown) {
      setModalError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Could not register patient.");
    } finally { setModalBusy(false); }
  }

  async function unlock() {
    if (!lockUser || !lockPass) { setLockError("Enter username and password"); return; }
    try {
      await api.post("/auth/login", { username: lockUser, password: lockPass });
      setLocked(false);
      setLockPass("");
      searchRef.current?.focus();
    } catch { setLockError("Invalid credentials"); }
  }

  async function searchPriceCheck(q: string) {
    setPcQuery(q);
    if (q.length < 2) { setPcResults([]); return; }
    try { setPcResults(await drugService.search(q)); } catch { setPcResults([]); }
  }

  // ── keyboard shortcuts (handler kept in a ref so it always sees fresh state) ─

  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    if (locked) return;
    const fnMap: Record<string, FnAction> = {
      F1: "search", F2: "priceCheck", F4: "patient", F5: "prescriber",
      F6: "hold", F7: "recall", F8: "qty", F9: "lineDisc", F10: "billDisc",
    };
    if (modal || pomWarningDrug || lastSale) return;
    if (fnMap[e.key]) { e.preventDefault(); runFn(fnMap[e.key]); return; }
    if (e.key === "F3") { e.preventDefault(); void runAction("reprint"); return; }
    if (e.key === "F12") { e.preventDefault(); if (items.length > 0 && !submitting) void handleCheckout(); return; }
    if (e.altKey && e.key.toLowerCase() === "n") { e.preventDefault(); runFn("note"); return; }
    if (e.ctrlKey && e.key === "Delete") { e.preventDefault(); runFn("newSale"); return; }
    const searchEmpty = !drugQuery;
    if (e.key === "Delete" && (searchEmpty || !isTyping(document.activeElement))) { e.preventDefault(); runFn("voidLine"); return; }
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && searchEmpty) {
      e.preventDefault(); selectNext(e.key === "ArrowDown" ? 1 : -1); return;
    }
    if (e.key === "?" && !isTyping(document.activeElement)) { e.preventDefault(); setModal("help"); }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      {/* ══ LEFT COLUMN (top bars + search + tray) ════════════════════════════ */}
      <div className={styles.leftCol}>

      {/* Error banner */}
      {checkoutError && (
        <div className={styles.errorBanner}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {checkoutError}
          <button className={styles.errorDismiss} onClick={() => setCheckoutError(null)}>✕</button>
        </div>
      )}

      {/* ══ MAIN AREA (search + tray) ═════════════════════════════════════════ */}
      <div className={styles.mainLeft}>

        {/* ── search + tray ───────────────────────────────────────────────── */}
        <div className={styles.left}>

          {/* Drug search */}
          <div className={styles.searchRow}>
            <div className={styles.searchWrap}>
              <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={searchRef}
                className={styles.searchInput}
                placeholder="Scan Barcode or type Brand / Generic / Strength… (F1)"
                value={drugQuery}
                onChange={(e) => searchDrugs(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleSearchEnter(); } }}
                autoFocus
              />
              {drugQuery && (
                <button className={styles.searchClear} onClick={() => { setDrugQuery(""); setDrugResults([]); }}>✕</button>
              )}
            </div>
          </div>

          {/* Linked context: patient / prescriber / held bills / note */}
          <div className={styles.contextRow}>
            <button className={`${styles.ctxChip} ${customer ? styles.ctxChipOn : ""}`} onClick={() => setModal("customer")}>
              <span className={styles.ctxLabel}>Patient</span>
              <span className={styles.ctxValue}>{customer ? customer.name : "Walk-in"}</span>
              {customer?.clinical_remarks && <span className={styles.ctxAlert} title={customer.clinical_remarks}>⚠ {customer.clinical_remarks}</span>}
              {customer && <span className={styles.ctxX} onClick={(e) => { e.stopPropagation(); setCustomer(null); }}>✕</span>}
            </button>
            <button className={`${styles.ctxChip} ${doctor ? styles.ctxChipOn : ""}`} onClick={() => setModal("doctor")}>
              <span className={styles.ctxLabel}>Prescriber</span>
              <span className={styles.ctxValue}>{doctor ? `Dr. ${doctor.name}` : "None (OTC)"}</span>
              {doctor && <span className={styles.ctxX} onClick={(e) => { e.stopPropagation(); setDoctor(null); }}>✕</span>}
            </button>
            {notes && (
              <button className={`${styles.ctxChip} ${styles.ctxChipOn}`} onClick={() => runFn("note")} title={notes}>
                <span className={styles.ctxLabel}>Note</span>
                <span className={styles.ctxValue}>{notes}</span>
              </button>
            )}
            {heldBills.length > 0 && (
              <button className={`${styles.ctxChip} ${styles.ctxChipHeld}`} onClick={() => setModal("recall")}>
                <span className={styles.ctxLabel}>On hold</span>
                <span className={styles.ctxValue}>{heldBills.length} bill{heldBills.length > 1 ? "s" : ""}</span>
              </button>
            )}
          </div>

          {/* Drug results dropdown */}
          {drugQuery.length >= 2 && (
            <div className={styles.drugDropdown}>
              {searching && <div className={styles.dropdownMsg}>Searching…</div>}
              {!searching && drugResults.length === 0 && (
                <div className={styles.dropdownMsg}>No drugs found for "{drugQuery}"</div>
              )}
              {drugResults.map((drug) => (
                <div key={drug.id} className={styles.drugRow} onClick={() => handleAddDrug(drug)}>
                  <div className={styles.drugRowLeft}>
                    <div className={styles.drugName}>
                      {drug.brand_name}
                      {drug.is_prescription_only && <span className={styles.pomTag}>POM</span>}
                      {drug.is_high_alert && <span className={styles.alertTag}>HIGH ALERT</span>}
                      {isColdChain(drug) && <span className={styles.coldTag}>2–8°C</span>}
                      {expiryWarning(drug.expiry_date) === "danger" && <span className={styles.alertTag}>EXPIRED</span>}
                    </div>
                    <div className={styles.drugGeneric}>{drug.generic_name}{drug.strength ? ` · ${drug.strength}` : ""} · {drug.dosage_form}</div>
                  </div>
                  <div className={styles.drugRowRight}>
                    <div className={styles.drugPrice}>{formatCurrency(drug.unit_price)}</div>
                    <div className={styles.drugStock} style={{ color: drug.quantity <= drug.reorder_level ? "var(--color-danger)" : undefined }}>
                      Stock: {drug.quantity}
                    </div>
                    {drug.quantity === 0 && <div className={styles.outOfStock}>OUT OF STOCK</div>}
                    {drug.batch_number && <div className={styles.batchTag}>{drug.batch_number}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Dispensing Tray */}
          <div className={styles.tray}>
            <div className={styles.trayHeader}>
              <div className={styles.trayTitle}>
                {isRxSale ? "PRESCRIPTION DISPENSING TRAY" : "SALES TRAY"}
                {items.length > 0 && <span className={styles.trayCount}>{items.length} Item{items.length !== 1 ? "s" : ""}</span>}
                {!isRxSale && items.length > 0 && (
                  <span className={styles.otcChip}>OTC</span>
                )}
              </div>
              <div className={styles.trayNote}>FEFO · First Expired, First Out · ↑↓ select line</div>
            </div>

            <div className={styles.trayScroll}>
              <table className={styles.trayTable}>
                <thead>
                  <tr>
                    <th className={styles.thNum}>#</th>
                    <th className={styles.thItem}>ITEM &amp; STRENGTH</th>
                    <th className={styles.thBatch}>BATCH / EXPIRY</th>
                    <th className={styles.thUnit}>FORM</th>
                    <th className={styles.thQty}>QTY</th>
                    <th className={styles.thPrice}>UNIT PRICE</th>
                    <th className={styles.thDisc}>DISC %</th>
                    <th className={styles.thTotal}>LINE TOTAL</th>
                    <th className={styles.thAct}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                      const warn = expiryWarning(item.drug.expiry_date);
                      return (
                        <tr
                          key={item.drug.id}
                          className={`${styles.trayRow} ${item.drug.id === selectedId ? styles.trayRowSelected : ""}`}
                          onClick={() => select(item.drug.id)}
                        >
                          <td className={styles.tdNum}>{idx + 1}</td>
                          <td className={styles.tdItem}>
                            <div className={styles.itemName}>{item.drug.brand_name}</div>
                            <div className={styles.itemSub}>{item.drug.generic_name}{item.drug.strength ? ` · ${item.drug.strength}` : ""}</div>
                            <div className={styles.itemBadges}>
                              {item.drug.is_prescription_only && <Badge variant="warning">POM</Badge>}
                              {item.drug.is_high_alert && <Badge variant="danger">High Alert</Badge>}
                              {item.drug.is_narcotic && <Badge variant="danger">Narcotic</Badge>}
                              {isColdChain(item.drug) && <Badge variant="info">2–8°C</Badge>}
                            </div>
                          </td>
                          <td className={styles.tdBatch}>
                            {item.drug.batch_number && (
                              <div className={styles.batchNum}>{item.drug.batch_number}</div>
                            )}
                            {item.drug.expiry_date && (
                              <div className={styles.expiryDate} style={{ color: warn === "danger" ? "var(--color-danger)" : warn === "warning" ? "var(--color-warning)" : undefined }}>
                                Exp: {formatDate(item.drug.expiry_date)}
                              </div>
                            )}
                          </td>
                          <td className={styles.tdUnit}>{item.drug.dosage_form}</td>
                          <td className={styles.tdQty}>
                            <div className={styles.qtyControl}>
                              <button className={styles.qtyBtn} onClick={() => updateQuantity(item.drug.id, item.quantity - 1)}>−</button>
                              <span className={styles.qtyVal}>{item.quantity}</span>
                              <button
                                className={styles.qtyBtn}
                                onClick={() => updateQuantity(item.drug.id, item.quantity + 1)}
                                disabled={item.quantity >= item.drug.quantity}
                              >+</button>
                            </div>
                          </td>
                          <td className={styles.tdPrice}>{formatCurrency(item.unit_price)}</td>
                          <td className={styles.tdDisc}>
                            <input
                              className={styles.discInput}
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              value={item.discount_rate}
                              onChange={(e) => updateDiscount(item.drug.id, parseFloat(e.target.value) || 0)}
                            />
                            <span className={styles.discPct}>%</span>
                          </td>
                          <td className={styles.tdTotal}>{formatCurrency(item.line_total)}</td>
                          <td className={styles.tdAct}>
                            <button className={styles.removeBtn} onClick={(e) => { e.stopPropagation(); removeItem(item.drug.id); }} title="Remove item">✕</button>
                          </td>
                        </tr>
                      );
                  })}
                </tbody>
              </table>
              {items.length === 0 && (
                <div className={styles.trayEmpty}>
                  Scan a barcode or search to start a sale
                  <span className={styles.trayEmptyHint}>F1 search · F2 price check · F7 recall held bill · ? shortcuts</span>
                </div>
              )}
            </div>
          </div>

          {/* ── On-screen keyboard ──────────────────────────────────────── */}
          <div className={styles.keyboardBar}>

            {/* QWERTY side — LEFT */}
            <div className={styles.qwertySection}>
              {[
                ['Q','W','E','R','T','Y','U','I','O','P'],
                ['A','S','D','F','G','H','J','K','L'],
                ['SHIFT','Z','X','C','V','B','N','M','⌫'],
                ['CTRL','ALT','SPACE','ENTER'],
              ].map((row, ri) => (
                <div key={ri} className={styles.kbRow}>
                  {row.map((k) => (
                    <button
                      key={k}
                      className={[
                        styles.kbKey,
                        k === 'SPACE'  ? styles.kbSpace     : '',
                        k === '⌫'     ? styles.kbBackspace  : '',
                        k === 'SHIFT'  ? styles.kbMod       : '',
                        k === 'CTRL'   ? styles.kbMod       : '',
                        k === 'ALT'    ? styles.kbMod       : '',
                        k === 'ENTER'  ? styles.kbEnter     : '',
                      ].join(' ')}
                      onMouseDown={(e) => { e.preventDefault(); handleKbKey(k); }}
                    >
                      {k === 'SPACE' ? '' : k}
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Function keys side (12 slots, 3×4) — RIGHT */}
            <div className={styles.fnSection}>
              {FN_BUTTONS.map((btn) => {
                const needsLine = btn.action === "qty" || btn.action === "lineDisc" || btn.action === "voidLine";
                const needsItems = btn.action === "hold" || btn.action === "billDisc";
                const disabled = (needsLine && !selectedItem) || (needsItems && !items.length);
                return (
                  <button
                    key={btn.action}
                    className={`${styles.fnKey} ${styles[`fnKey_${btn.color}`]}`}
                    disabled={disabled}
                    onMouseDown={(e) => { e.preventDefault(); runFn(btn.action); }}
                  >
                    <span className={styles.fnKeyLabel}>
                      {btn.label}
                      {btn.action === "recall" && heldBills.length > 0 && <span className={styles.fnBadge}>{heldBills.length}</span>}
                    </span>
                    <span className={styles.fnKeySub}>{btn.sub}</span>
                  </button>
                );
              })}
            </div>

          </div>

        </div>
      </div>{/* end mainLeft */}
      </div>{/* end leftCol */}

        {/* ── Right: billing panel ─────────────────────────────────────────── */}
        <div className={styles.billing}>

          {/* ── Net total strip ──────────────────────────────────────────── */}
          <div className={styles.netStrip}>
            <div className={styles.netStripLeft}>
              <span className={styles.netStripLabel}>NET PAYABLE</span>
              <span className={styles.netStripSub}>
                {customer ? `${customer.name} · ${customer.loyalty_points} pts` : "Walk-in"}
              </span>
            </div>
            <span className={styles.netStripAmount}>{formatCurrency(netTotal)}</span>
          </div>

          {/* ── Bill breakdown ───────────────────────────────────────────── */}
          <div className={styles.billSummary}>
            <div><span>Items / Qty</span><span>{items.length} / {itemCount}</span></div>
            <div><span>Sub total</span><span>{formatCurrency(subtotal())}</span></div>
            {lineDiscTotal > 0.004 && <div><span>Line discounts</span><span className={styles.billNeg}>−{formatCurrency(lineDiscTotal)}</span></div>}
            {billDiscount > 0 && (
              <div>
                <span>Bill discount <button className={styles.billX} onClick={() => setBillDiscount(0)} title="Remove bill discount">✕</button></span>
                <span className={styles.billNeg}>−{formatCurrency(billDiscount)}</span>
              </div>
            )}
          </div>

          {/* ── Action buttons grid (3 × 4) ──────────────────────────────── */}
          <div className={styles.actionGrid}>
            {ACTION_BUTTONS.map((btn) => (
              <button key={btn.action} className={styles.actionBtn} onClick={() => void runAction(btn.action)}>
                <span className={styles.actionBtnLabel}>{btn.label}</span>
                {btn.sub && <span className={styles.actionBtnSub}>{btn.sub}</span>}
              </button>
            ))}
          </div>

          {/* ── Numpad + display ─────────────────────────────────────────── */}
          <div className={styles.numpadSection}>

            {/* Payment mode tabs */}
            <div className={styles.payModeTabs}>
              {(["cash", "card", "qr"] as PaymentMode[]).map((mode) => (
                <button
                  key={mode}
                  className={`${styles.payModeTab} ${paymentMode === mode ? styles.payModeTabActive : ""}`}
                  onClick={() => setPaymentMode(mode)}
                >
                  {mode === "cash" ? "Cash" : mode === "card" ? "Card" : "LankaQR"}
                </button>
              ))}
            </div>

            {/* Amount display */}
            <div className={styles.numpadDisplay}>
              <span className={styles.numpadDisplayLabel}>
                {paymentMode === "cash" ? "CASH TENDERED" : paymentMode === "card" ? "CARD AMOUNT" : "QR AMOUNT"}
              </span>
              <span className={styles.numpadDisplayValue}>
                Rs.&nbsp;{cashTendered || "0"}
              </span>
              {paymentMode === "cash" && tendered > 0 && (
                <span className={`${styles.numpadChange} ${change < 0 ? styles.numpadChangeNeg : ""}`}>
                  {change >= 0 ? `Change  Rs. ${change.toFixed(2)}` : "⚠ Insufficient"}
                </span>
              )}
            </div>

            {/* Numpad keys */}
            <div className={styles.numpad}>
              {["7","8","9","4","5","6","1","2","3",".","0","⌫"].map((k) => (
                <button
                  key={k}
                  className={`${styles.numpadKey} ${k === "⌫" ? styles.numpadBackspace : ""}`}
                  onClick={() => handleNumpad(k)}
                >
                  {k}
                </button>
              ))}
            </div>

            {/* Quick presets */}
            <div className={styles.numpadPresets}>
              <button className={styles.presetChip} onClick={() => setCashTendered(netTotal.toFixed(2))}>Exact</button>
              {[500, 1000, 2000, 5000].map((v) => (
                <button key={v} className={styles.presetChip} onClick={() => setCashTendered((Math.ceil(netTotal / v) * v).toFixed(2))}>
                  {v >= 1000 ? `${v/1000}K` : v}
                </button>
              ))}
            </div>
          </div>

          {/* ── Checkout ─────────────────────────────────────────────────── */}
          <div className={styles.checkoutSection}>
            <button
              className={styles.checkoutBtn}
              disabled={items.length === 0 || submitting}
              onClick={handleCheckout}
            >
              {submitting ? "Processing…" : `Complete Sale (F12) · ${formatCurrency(netTotal)}`}
            </button>
            {items.length > 0 && (
              <button className={styles.clearBtn} onClick={() => { clearCart(); setCheckoutError(null); }}>Void / Clear All</button>
            )}
          </div>
        </div>

      {/* ══ MODALS ═════════════════════════════════════════════════════════════ */}

      {/* Customer search modal */}
      <Modal open={modal === "customer"} onClose={closeModal} title="Select Patient (optional)" size="sm">
        <div className={styles.modalHint}>Leave empty to proceed as walk-in customer.</div>
        <div className={styles.modalSearch}>
          <input
            className={styles.modalSearchInput}
            placeholder="Search by name or phone…"
            value={customerQuery}
            onChange={(e) => searchCustomers(e.target.value)}
            autoFocus
          />
        </div>
        {customerResults.map((c) => (
          <div key={c.id} className={styles.entityRow} onClick={() => selectCustomer(c)}>
            <div className={styles.entityName}>{c.name}</div>
            <div className={styles.entitySub}>{c.contact_number} · {c.loyalty_points} loyalty pts{c.clinical_remarks ? ` · ⚠ ${c.clinical_remarks}` : ""}</div>
          </div>
        ))}
        {customerQuery.length >= 2 && customerResults.length === 0 && (
          <div className={styles.modalEmpty}>No patients found</div>
        )}
        <div className={styles.modalFooter}>
          <Button variant="secondary" onClick={() => void runAction("newPatient")}>+ Register New Patient</Button>
          <Button variant="secondary" onClick={() => { setCustomer(null); closeModal(); }}>Continue as Walk-in</Button>
        </div>
      </Modal>

      {/* Doctor search modal */}
      <Modal open={modal === "doctor"} onClose={closeModal} title="Link Prescriber (optional)" size="sm">
        <div className={styles.modalHint}>Required only for POM / prescription medicines.</div>
        <div className={styles.modalSearch}>
          <input
            className={styles.modalSearchInput}
            placeholder="Search by name or SLMC number…"
            value={doctorQuery}
            onChange={(e) => searchDoctors(e.target.value)}
            autoFocus
          />
        </div>
        {doctorResults.map((d) => (
          <div key={d.id} className={styles.entityRow} onClick={() => selectDoctor(d)}>
            <div className={styles.entityName}>Dr. {d.name}{d.slmc_registration_number && <span className={styles.slmcInline}>SLMC: {d.slmc_registration_number}</span>}</div>
            <div className={styles.entitySub}>{[d.specialization, d.hospital].filter(Boolean).join(" · ")}</div>
          </div>
        ))}
        {doctorQuery.length >= 2 && doctorResults.length === 0 && (
          <div className={styles.modalEmpty}>No prescribers found</div>
        )}
        <div className={styles.modalFooter}>
          <Button variant="secondary" onClick={() => { setDoctor(null); closeModal(); }}>Skip — OTC Sale</Button>
        </div>
      </Modal>

      {/* Price check */}
      <Modal open={modal === "priceCheck"} onClose={closeModal} title="Price Check (F2)" size="md">
        <div className={styles.modalHint}>Look up price, stock and expiry without adding to the bill.</div>
        <div className={styles.modalSearch}>
          <input className={styles.modalSearchInput} placeholder="Brand, generic or item code…" value={pcQuery} onChange={(e) => searchPriceCheck(e.target.value)} autoFocus />
        </div>
        {pcResults.map((d) => {
          const w = expiryWarning(d.expiry_date);
          return (
            <div key={d.id} className={styles.pcRow}>
              <div className={styles.pcMain}>
                <div className={styles.entityName}>
                  {d.brand_name}
                  {d.is_prescription_only && <span className={styles.pomTag}>POM</span>}
                  {d.is_narcotic && <span className={styles.alertTag}>NARCOTIC</span>}
                </div>
                <div className={styles.entitySub}>{d.generic_name}{d.strength ? ` · ${d.strength}` : ""} · {d.dosage_form} · Code {d.item_code}</div>
                <div className={styles.entitySub}>
                  Batch {d.batch_number ?? "—"} ·{" "}
                  <span style={{ color: w === "danger" ? "var(--color-danger)" : w === "warning" ? "var(--color-warning)" : undefined }}>
                    Exp {d.expiry_date ? formatDate(d.expiry_date) : "—"}
                  </span>
                  {d.storage_requirements ? ` · ${d.storage_requirements}` : ""}
                </div>
              </div>
              <div className={styles.pcSide}>
                <div className={styles.pcPrice}>{formatCurrency(d.unit_price)}</div>
                <div className={styles.entitySub} style={{ color: d.quantity <= d.reorder_level ? "var(--color-danger)" : undefined }}>Stock {d.quantity}</div>
                <Button variant="secondary" onClick={() => { closeModal(); handleAddDrug(d); }}>Add</Button>
              </div>
            </div>
          );
        })}
        {pcQuery.length >= 2 && pcResults.length === 0 && <div className={styles.modalEmpty}>No items found</div>}
      </Modal>

      {/* Change quantity */}
      <Modal open={modal === "qty"} onClose={closeModal} title={`Change Quantity — ${selectedItem?.drug.brand_name ?? ""}`} size="sm"
        footer={<>
          <Button variant="secondary" onClick={closeModal}>Cancel</Button>
          <Button onClick={applyQty}>Apply</Button>
        </>}>
        <input className={styles.bigInput} type="number" min={0} value={inputVal} onChange={(e) => { setInputVal(e.target.value); setModalError(null); }} autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") applyQty(); }} />
        <div className={styles.quickRow}>
          {[1, 2, 3, 5, 10, 20, 30, 60].map((n) => <button key={n} className={styles.quickChip} onClick={() => setInputVal(String(n))}>{n}</button>)}
        </div>
        <div className={styles.entitySub}>Available stock: {selectedItem?.drug.quantity ?? 0} · Enter 0 to remove the line</div>
        {modalError && <div className={styles.modalErr}>{modalError}</div>}
      </Modal>

      {/* Line discount */}
      <Modal open={modal === "lineDisc"} onClose={closeModal} title={`Line Discount — ${selectedItem?.drug.brand_name ?? ""}`} size="sm"
        footer={<>
          <Button variant="secondary" onClick={closeModal}>Cancel</Button>
          <Button onClick={() => {
            const r = Number(inputVal || 0);
            if (!selectedItem || !Number.isFinite(r) || r < 0 || r > 100) { setModalError("Enter 0–100 %"); return; }
            updateDiscount(selectedItem.drug.id, r);
            closeModal();
          }}>Apply</Button>
        </>}>
        <div className={styles.inputWithUnit}>
          <input className={styles.bigInput} type="number" min={0} max={100} step={0.5} value={inputVal} onChange={(e) => { setInputVal(e.target.value); setModalError(null); }} autoFocus />
          <span>%</span>
        </div>
        <div className={styles.quickRow}>
          {[0, 2.5, 5, 10, 15, 20].map((n) => <button key={n} className={styles.quickChip} onClick={() => setInputVal(String(n))}>{n}%</button>)}
        </div>
        {modalError && <div className={styles.modalErr}>{modalError}</div>}
      </Modal>

      {/* Bill discount */}
      <Modal open={modal === "billDisc"} onClose={closeModal} title="Bill Discount (F10)" size="sm"
        footer={<>
          {billDiscount > 0 && <Button variant="secondary" onClick={() => { setBillDiscount(0); closeModal(); }}>Remove</Button>}
          <Button variant="secondary" onClick={closeModal}>Cancel</Button>
          <Button onClick={() => {
            const v = Number(inputVal || 0);
            const base = items.reduce((s, i) => s + i.line_total, 0);
            if (!Number.isFinite(v) || v < 0) { setModalError("Enter a valid value"); return; }
            if (discMode === "pct" && v > 100) { setModalError("Percentage cannot exceed 100"); return; }
            const amt = discMode === "pct" ? (base * v) / 100 : v;
            if (amt > base) { setModalError("Discount exceeds bill value"); return; }
            setBillDiscount(+amt.toFixed(2));
            closeModal();
          }}>Apply</Button>
        </>}>
        <div className={styles.segment}>
          <button className={discMode === "amt" ? styles.segOn : ""} onClick={() => setDiscMode("amt")}>Rs. amount</button>
          <button className={discMode === "pct" ? styles.segOn : ""} onClick={() => setDiscMode("pct")}>Percent %</button>
        </div>
        <div className={styles.inputWithUnit}>
          <input className={styles.bigInput} type="number" min={0} step={discMode === "pct" ? 0.5 : 1} value={inputVal} onChange={(e) => { setInputVal(e.target.value); setModalError(null); }} autoFocus />
          <span>{discMode === "pct" ? "%" : "Rs."}</span>
        </div>
        <div className={styles.entitySub}>Applied after line discounts. Bill value: {formatCurrency(items.reduce((s, i) => s + i.line_total, 0))}</div>
        {modalError && <div className={styles.modalErr}>{modalError}</div>}
      </Modal>

      {/* Bill note */}
      <Modal open={modal === "note"} onClose={closeModal} title="Bill Note (Alt+N)" size="sm"
        footer={<>
          <Button variant="secondary" onClick={closeModal}>Cancel</Button>
          <Button onClick={() => { setNotes(inputVal.trim()); closeModal(); }}>Save</Button>
        </>}>
        <textarea className={styles.noteArea} rows={4} maxLength={300} value={inputVal} onChange={(e) => setInputVal(e.target.value)} autoFocus
          placeholder="e.g. Counselled on dosage; patient to return for balance quantity…" />
        <div className={styles.entitySub}>Printed on the receipt and saved with the invoice.</div>
      </Modal>

      {/* Hold bill */}
      <Modal open={modal === "hold"} onClose={closeModal} title="Hold Bill (F6)" size="sm"
        footer={<>
          <Button variant="secondary" onClick={closeModal}>Cancel</Button>
          <Button onClick={() => { holdBill(inputVal.trim()); setCashTendered(""); notify("Bill put on hold"); closeModal(); }}>Hold</Button>
        </>}>
        <div className={styles.modalHint}>Park this bill and serve the next customer. Recall it any time with F7.</div>
        <input className={styles.modalSearchInput} placeholder="Label (optional) — e.g. patient name, waiting for Rx" value={inputVal} onChange={(e) => setInputVal(e.target.value)} autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") { holdBill(inputVal.trim()); setCashTendered(""); notify("Bill put on hold"); closeModal(); } }} />
        <div className={styles.entitySub} style={{ marginTop: 8 }}>{items.length} line(s) · {formatCurrency(netTotal)}</div>
      </Modal>

      {/* Recall bill */}
      <Modal open={modal === "recall"} onClose={closeModal} title="Recall Held Bill (F7)" size="md">
        {heldBills.length === 0 && <div className={styles.modalEmpty}>No bills on hold</div>}
        {items.length > 0 && heldBills.length > 0 && (
          <div className={styles.modalHint}>The current tray is not empty — hold or clear it before recalling another bill.</div>
        )}
        {heldBills.map((b) => (
          <div key={b.id} className={styles.heldRow}>
            <div className={styles.pcMain}>
              <div className={styles.entityName}>{b.label}</div>
              <div className={styles.entitySub}>
                {formatDateTime(b.held_at)} · {b.items.length} line(s) · {formatCurrency(Math.max(0, b.items.reduce((s, i) => s + i.line_total, 0) - b.bill_discount))}
                {b.doctor ? ` · Dr. ${b.doctor.name}` : ""}
              </div>
              <div className={styles.entitySub}>{b.items.map((i) => `${i.drug.brand_name} ×${i.quantity}`).join(", ")}</div>
            </div>
            <div className={styles.heldActions}>
              <Button disabled={items.length > 0} onClick={() => { recallBill(b.id); notify(`Recalled "${b.label}"`); closeModal(); }}>Recall</Button>
              <Button variant="secondary" onClick={() => deleteHeld(b.id)}>Discard</Button>
            </div>
          </div>
        ))}
      </Modal>

      {/* Recent sales / void picker */}
      <Modal open={modal === "sales"} onClose={closeModal}
        title={salesMode === "void" ? "Void Invoice — select today's sale" : salesMode === "return" ? "Sales Return — select invoice" : "Today's Sales"} size="lg">
        {salesLoading && <div className={styles.modalEmpty}>Loading…</div>}
        {!salesLoading && sales.length === 0 && <div className={styles.modalEmpty}>No sales recorded today</div>}
        {modalError && <div className={styles.modalErr}>{modalError}</div>}
        {!salesLoading && sales.length > 0 && (
          <table className={styles.salesTable}>
            <thead><tr><th>Invoice</th><th>Time</th><th>Patient</th><th>Mode</th><th className={styles.r}>Total</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className={activeInvoice?.id === s.id ? styles.salesRowOn : ""}>
                  <td>{s.invoice_number}</td>
                  <td>{new Date(s.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</td>
                  <td>{s.customer?.name ?? "Walk-in"}</td>
                  <td>{PAY_LABEL[s.payment_mode] ?? s.payment_mode}</td>
                  <td className={styles.r}>{formatCurrency(s.total_amount)}</td>
                  <td>{s.status === "cancelled" ? <Badge variant="danger">Voided</Badge> : <Badge variant="success">Paid</Badge>}</td>
                  <td className={styles.salesActs}>
                    <button className={styles.linkBtn} onClick={async () => { try { printInvoice(await invoiceService.getById(s.id)); } catch { notify("Could not load invoice", "err"); } }}>Print</button>
                    {s.status !== "cancelled" && salesMode !== "view" && (
                      <button className={styles.linkBtn} onClick={() => void pickInvoice(s)}>{salesMode === "void" ? "Void" : "Return"}</button>
                    )}
                    {salesMode === "view" && <button className={styles.linkBtn} onClick={() => void addInvoiceToCart(s.id)}>Repeat</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {salesMode === "void" && activeInvoice && (
          <div className={styles.voidBox}>
            <div className={styles.entityName}>Void {activeInvoice.invoice_number} · {formatCurrency(activeInvoice.total_amount)}</div>
            <div className={styles.entitySub}>Stock for all {activeInvoice.items.length} line(s) will be returned to inventory. This cannot be undone.</div>
            <input className={styles.modalSearchInput} placeholder="Reason for void (required)" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} autoFocus />
            <div className={styles.modalFooter}>
              <Button variant="secondary" onClick={() => setActiveInvoice(null)}>Back</Button>
              <Button variant="danger" disabled={modalBusy} onClick={() => void submitVoid()}>{modalBusy ? "Voiding…" : "Confirm Void"}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Sales return lines */}
      <Modal open={modal === "return"} onClose={closeModal} title={`Sales Return — ${activeInvoice?.invoice_number ?? ""}`} size="lg"
        footer={<>
          <Button variant="secondary" onClick={() => setModal("sales")}>Back</Button>
          <Button disabled={modalBusy} onClick={() => void submitReturn()}>{modalBusy ? "Saving…" : "Record Return"}</Button>
        </>}>
        <div className={styles.modalHint}>Returns are recorded as pending; stock is restored when a manager approves them in the ERP.</div>
        <table className={styles.salesTable}>
          <thead><tr><th>Item</th><th className={styles.r}>Sold</th><th className={styles.r}>Unit (net)</th><th className={styles.r}>Return qty</th><th className={styles.r}>Refund</th></tr></thead>
          <tbody>
            {activeInvoice?.items.map((l) => {
              const unitNet = l.line_total / l.quantity;
              const q = returnQty[l.id] ?? 0;
              return (
                <tr key={l.id}>
                  <td>{l.drug?.brand_name ?? `Item #${l.drug_id}`}</td>
                  <td className={styles.r}>{l.quantity}</td>
                  <td className={styles.r}>{formatCurrency(unitNet)}</td>
                  <td className={styles.r}>
                    <input className={styles.discInput} type="number" min={0} max={l.quantity} value={q || ""}
                      onChange={(e) => setReturnQty((p) => ({ ...p, [l.id]: Math.min(l.quantity, Math.max(0, Math.floor(Number(e.target.value) || 0))) }))} />
                  </td>
                  <td className={styles.r}>{formatCurrency(unitNet * q)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className={styles.returnMeta}>
          <select className={styles.modalSearchInput} value={returnReason} onChange={(e) => setReturnReason(e.target.value as SalesReturnReason)}>
            {RETURN_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <input className={styles.modalSearchInput} placeholder="Notes (optional)" value={returnNote} onChange={(e) => setReturnNote(e.target.value)} />
        </div>
        <div className={styles.entityName} style={{ justifyContent: "flex-end" }}>
          Total refund: {formatCurrency(activeInvoice?.items.reduce((s, l) => s + (l.line_total / l.quantity) * (returnQty[l.id] ?? 0), 0) ?? 0)}
        </div>
        {modalError && <div className={styles.modalErr}>{modalError}</div>}
      </Modal>

      {/* X-report */}
      <Modal open={modal === "xreport"} onClose={closeModal} title="Day Summary (X-Report)" size="sm"
        footer={<><Button variant="secondary" onClick={closeModal}>Close</Button><Button disabled={salesLoading} onClick={printXReport}>Print</Button></>}>
        {salesLoading ? <div className={styles.modalEmpty}>Loading…</div> : (
          <div className={styles.billSummary} style={{ border: 0, padding: 0 }}>
            <div><span>Invoices</span><span>{xr.count}</span></div>
            <div><span>Voided</span><span>{xr.voided}</span></div>
            <div><span>Gross sales</span><span>{formatCurrency(xr.gross)}</span></div>
            <div><span>Discounts</span><span className={styles.billNeg}>−{formatCurrency(xr.disc)}</span></div>
            <div className={styles.billTotalRow}><span>Net sales</span><span>{formatCurrency(xr.net)}</span></div>
            {Object.entries(xr.byMode).map(([k, v]) => <div key={k}><span>{k} ({v.n})</span><span>{formatCurrency(v.amt)}</span></div>)}
          </div>
        )}
        {modalError && <div className={styles.modalErr}>{modalError}</div>}
      </Modal>

      {/* New patient */}
      <Modal open={modal === "newPatient"} onClose={closeModal} title="Register New Patient" size="sm"
        footer={<><Button variant="secondary" onClick={closeModal}>Cancel</Button><Button disabled={modalBusy} onClick={() => void submitNewPatient()}>{modalBusy ? "Saving…" : "Register & Link"}</Button></>}>
        <div className={styles.formGrid}>
          <label>Full name *<input className={styles.modalSearchInput} value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} autoFocus /></label>
          <label>Contact number *<input className={styles.modalSearchInput} inputMode="tel" value={np.contact_number} onChange={(e) => setNp({ ...np, contact_number: e.target.value })} /></label>
          <label>Gender
            <select className={styles.modalSearchInput} value={np.gender} onChange={(e) => setNp({ ...np, gender: e.target.value as Gender | "" })}>
              <option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
            </select>
          </label>
          <label>Date of birth<input className={styles.modalSearchInput} type="date" value={np.dob} onChange={(e) => setNp({ ...np, dob: e.target.value })} /></label>
          <label className={styles.formWide}>Allergies / clinical remarks<input className={styles.modalSearchInput} placeholder="e.g. Penicillin allergy" value={np.clinical_remarks} onChange={(e) => setNp({ ...np, clinical_remarks: e.target.value })} /></label>
        </div>
        {modalError && <div className={styles.modalErr}>{modalError}</div>}
      </Modal>

      {/* Patient history */}
      <Modal open={modal === "history"} onClose={closeModal} title={`Purchase History — ${customer?.name ?? ""}`} size="lg">
        {customer?.clinical_remarks && <div className={styles.modalErr}>⚠ {customer.clinical_remarks}</div>}
        {history.length === 0 && !modalError && <div className={styles.modalEmpty}>No previous purchases</div>}
        {modalError && <div className={styles.modalErr}>{modalError}</div>}
        {history.length > 0 && (
          <table className={styles.salesTable}>
            <thead><tr><th>Date</th><th>Invoice</th><th className={styles.r}>Lines</th><th className={styles.r}>Total</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{formatDateTime(h.created_at)}</td>
                  <td>{h.invoice_number}</td>
                  <td className={styles.r}>{h.items.length}</td>
                  <td className={styles.r}>{formatCurrency(h.total_amount)}</td>
                  <td>{h.status === "cancelled" ? <Badge variant="danger">Voided</Badge> : <Badge variant="success">Paid</Badge>}</td>
                  <td className={styles.salesActs}>
                    {h.status !== "cancelled" && <button className={styles.linkBtn} onClick={() => void addInvoiceToCart(h.id)}>Repeat</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>

      {/* Shortcuts help */}
      <Modal open={modal === "help"} onClose={closeModal} title="Keyboard Shortcuts" size="md">
        <div className={styles.helpGrid}>
          {[
            ["F1", "Drug search"], ["F2", "Price check"], ["F3", "Reprint last receipt"], ["F4", "Link patient"],
            ["F5", "Link prescriber"], ["F6", "Hold bill"], ["F7", "Recall held bill"], ["F8", "Change qty (selected line)"],
            ["F9", "Line discount"], ["F10", "Bill discount"], ["F11", "Full screen"], ["F12", "Complete sale"],
            ["↑ / ↓", "Select tray line"], ["DEL", "Void selected line"], ["ALT+N", "Bill note"], ["CTRL+DEL", "New sale"],
            ["ENTER", "Add scanned / single match"], ["ESC", "Close dialog"], ["?", "This help"],
          ].map(([k, v]) => (
            <div key={k} className={styles.helpRow}><kbd>{k}</kbd><span>{v}</span></div>
          ))}
        </div>
      </Modal>

      {/* Confirm new sale */}
      <Modal open={modal === "confirmNew"} onClose={closeModal} title="Start New Sale?" size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => { closeModal(); runFn("hold"); }}>Hold Instead</Button>
          <Button variant="danger" onClick={() => { clearCart(); setCashTendered(""); setCheckoutError(null); closeModal(); }}>Discard Bill</Button>
        </>}>
        <div className={styles.pomMsg}>The current bill has {items.length} line(s) worth {formatCurrency(netTotal)}. Discard it or put it on hold?</div>
      </Modal>

      {/* POM advisory modal */}
      <Modal open={!!pomWarningDrug} onClose={() => setPomWarningDrug(null)} title="Prescription-Only Medicine" size="sm">
        <div className={styles.pomBody}>
          <div className={styles.pomIcon}>⚠</div>
          <div className={styles.pomDrug}>{pomWarningDrug?.brand_name}</div>
          <div className={styles.pomMsg}>
            This is a <strong>Prescription-Only Medicine (POM)</strong>. Dispensing without a valid prescription may be a regulatory offence.
          </div>
          <div className={styles.pomMsg} style={{ marginTop: 4 }}>
            Link a prescriber (F5) before dispensing, or confirm you have sighted a paper prescription.
          </div>
        </div>
        <div className={styles.pomActions}>
          <Button variant="secondary" onClick={() => { setPomWarningDrug(null); setModal("doctor"); }}>Link Prescriber First</Button>
          <Button variant="primary" onClick={addPomAnyway}>I Have Sighted Rx — Add Anyway</Button>
        </div>
      </Modal>

      {/* Success modal */}
      <Modal
        open={!!lastSale}
        onClose={() => { setLastSale(null); searchRef.current?.focus(); }}
        title="Sale Completed"
        size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => lastSale && printHtml(renderReceipt(lastSale.receipt))}>Print Receipt</Button>
          <Button onClick={() => { setLastSale(null); searchRef.current?.focus(); }}>New Sale (F1)</Button>
        </>}
      >
        <div className={styles.successBody}>
          <div className={styles.successIcon}>✓</div>
          <div className={styles.successTitle}>Invoice #{lastSale?.number}</div>
          <div className={styles.successSub}>Sale recorded successfully.</div>
          {lastSale && lastSale.change > 0 && <div className={styles.successChange}>Change due: {formatCurrency(lastSale.change)}</div>}
        </div>
      </Modal>

      {/* Toast */}
      {toast && <div className={`${styles.toast} ${styles[`toast_${toast.kind}`]}`}>{toast.msg}</div>}

      {/* Lock screen */}
      {locked && (
        <div className={styles.lockOverlay}>
          <div className={styles.lockCard}>
            <div className={styles.lockTitle}>Terminal Locked</div>
            <div className={styles.entitySub}>The current bill is kept. Sign in to continue.</div>
            <input className={styles.modalSearchInput} placeholder="Username" value={lockUser} onChange={(e) => setLockUser(e.target.value)} />
            <input className={styles.modalSearchInput} type="password" placeholder="Password" value={lockPass} autoFocus
              onChange={(e) => { setLockPass(e.target.value); setLockError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") void unlock(); }} />
            {lockError && <div className={styles.modalErr}>{lockError}</div>}
            <Button onClick={() => void unlock()}>Unlock</Button>
          </div>
        </div>
      )}
    </div>
  );
}
