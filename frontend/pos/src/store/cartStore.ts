import { create } from "zustand";
import type { CartItem, Customer, Doctor, Drug, DrugBatch, PaymentMode } from "../types";

export interface HeldBill {
  id: string;
  held_at: string;
  label: string;
  items: CartItem[];
  customer: Customer | null;
  doctor: Doctor | null;
  notes: string;
  bill_discount: number;
}

const HELD_KEY = "pos_held_bills";

function readHeld(): HeldBill[] {
  try {
    return JSON.parse(localStorage.getItem(HELD_KEY) ?? "[]") as HeldBill[];
  } catch {
    return [];
  }
}

function writeHeld(bills: HeldBill[]) {
  try {
    localStorage.setItem(HELD_KEY, JSON.stringify(bills));
  } catch {
    /* storage unavailable — held bills stay in memory only */
  }
}

/** A cart line is one drug from one batch: `${drugId}:${batchId}` (batch 0 = drug without batch data). */
export const lineKey = (drugId: number, batchId?: number | null) => `${drugId}:${batchId ?? 0}`;

/** Sellable batches, oldest received first (FIFO). The API already filters and orders them. */
export function sellableBatches(drug: Drug): DrugBatch[] {
  return (drug.batches ?? []).filter((b) => b.quantity_remaining > 0);
}

/** Units of this drug that can still be sold. */
export function sellableQty(drug: Drug): number {
  return drug.batches ? sellableBatches(drug).reduce((s, b) => s + b.quantity_remaining, 0) : drug.quantity;
}

interface CartState {
  items: CartItem[];
  customer: Customer | null;
  doctor: Doctor | null;
  paymentMode: PaymentMode;
  notes: string;
  billDiscount: number;
  selectedId: string | null;
  heldBills: HeldBill[];

  setCustomer: (customer: Customer | null) => void;
  setDoctor: (doctor: Doctor | null) => void;
  setPaymentMode: (mode: PaymentMode) => void;
  setNotes: (notes: string) => void;
  setBillDiscount: (amount: number) => void;
  select: (key: string | null) => void;
  selectNext: (dir: 1 | -1) => void;
  /** Adds units FIFO: fills the oldest batch first, then opens a new line for the next batch (which may have its own price). Returns units added. */
  addItem: (drug: Drug, quantity?: number) => number;
  updateQuantity: (key: string, quantity: number) => void;
  updateDiscount: (key: string, discountRate: number) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  holdBill: (label: string) => void;
  recallBill: (id: string) => void;
  deleteHeld: (id: string) => void;

  subtotal: () => number;
  totalDiscount: () => number;
  total: () => number;
}

function calcLineTotal(unitPrice: number, quantity: number, discountRate: number): number {
  const gross = unitPrice * quantity;
  return gross - (gross * discountRate) / 100;
}

/** FIFO allocation of `quantity` more units of `drug` onto the existing lines. */
function allocate(items: CartItem[], drug: Drug, quantity: number): { items: CartItem[]; added: number; lastKey: string | null } {
  let next = [...items];
  let left = quantity;
  let lastKey: string | null = null;
  const batches = sellableBatches(drug);

  if (!drug.batches || batches.length === 0) {
    // no batch data: single line at the drug price
    if (!drug.batches) {
      const key = lineKey(drug.id);
      const ex = next.find((i) => i.key === key);
      const room = Math.max(drug.quantity - (ex?.quantity ?? 0), 0);
      const add = Math.min(left, room);
      if (add <= 0) return { items, added: 0, lastKey: null };
      if (ex) next = next.map((i) => (i.key === key ? { ...i, quantity: i.quantity + add, line_total: calcLineTotal(i.unit_price, i.quantity + add, i.discount_rate) } : i));
      else next.push({ key, drug, batch: null, quantity: add, unit_price: drug.unit_price, discount_rate: drug.discount ?? 0, line_total: calcLineTotal(drug.unit_price, add, drug.discount ?? 0) });
      return { items: next, added: add, lastKey: key };
    }
    return { items, added: 0, lastKey: null };
  }

  for (const b of batches) {
    if (left <= 0) break;
    const key = lineKey(drug.id, b.id);
    const ex = next.find((i) => i.key === key);
    const room = b.quantity_remaining - (ex?.quantity ?? 0);
    if (room <= 0) continue;
    const add = Math.min(left, room);
    if (ex) {
      next = next.map((i) => (i.key === key ? { ...i, quantity: i.quantity + add, line_total: calcLineTotal(i.unit_price, i.quantity + add, i.discount_rate) } : i));
    } else {
      const disc = next.find((i) => i.drug.id === drug.id)?.discount_rate ?? drug.discount ?? 0;
      next.push({ key, drug, batch: b, quantity: add, unit_price: b.selling_price, discount_rate: disc, line_total: calcLineTotal(b.selling_price, add, disc) });
    }
    left -= add;
    lastKey = key;
  }
  return { items: next, added: quantity - left, lastKey };
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  customer: null,
  doctor: null,
  paymentMode: "cash",
  notes: "",
  billDiscount: 0,
  selectedId: null,
  heldBills: readHeld(),

  setCustomer: (customer) => set({ customer }),
  setDoctor: (doctor) => set({ doctor }),
  setPaymentMode: (paymentMode) => set({ paymentMode }),
  setNotes: (notes) => set({ notes }),
  setBillDiscount: (amount) => {
    const lines = get().items.reduce((s, i) => s + i.line_total, 0);
    set({ billDiscount: Math.min(Math.max(0, amount), lines) });
  },
  select: (selectedId) => set({ selectedId }),
  selectNext: (dir) => {
    const { items, selectedId } = get();
    if (items.length === 0) return;
    const idx = items.findIndex((i) => i.key === selectedId);
    const next = idx === -1 ? (dir === 1 ? 0 : items.length - 1) : Math.min(Math.max(idx + dir, 0), items.length - 1);
    set({ selectedId: items[next].key });
  },

  addItem: (drug, quantity = 1) => {
    const r = allocate(get().items, drug, quantity);
    if (r.added > 0) set({ items: r.items, selectedId: r.lastKey });
    return r.added;
  },

  updateQuantity: (key, quantity) => {
    const line = get().items.find((i) => i.key === key);
    if (!line) return;
    if (quantity <= 0) {
      get().removeItem(key);
      return;
    }
    const cap = line.batch ? line.batch.quantity_remaining : line.drug.quantity;
    const here = Math.min(quantity, cap);
    set({
      items: get().items.map((i) => (i.key === key ? { ...i, quantity: here, line_total: calcLineTotal(i.unit_price, here, i.discount_rate) } : i)),
    });
    // more than this batch holds: the rest comes from the next batch (FIFO), on its own line
    if (quantity > here) get().addItem(line.drug, quantity - here);
  },

  updateDiscount: (key, discountRate) => {
    const rate = Math.min(Math.max(0, discountRate), 100);
    set({
      items: get().items.map((i) => (i.key === key ? { ...i, discount_rate: rate, line_total: calcLineTotal(i.unit_price, i.quantity, rate) } : i)),
    });
  },

  removeItem: (key) => {
    const items = get().items;
    const idx = items.findIndex((i) => i.key === key);
    const rest = items.filter((i) => i.key !== key);
    const nextSel = rest.length ? rest[Math.min(idx, rest.length - 1)].key : null;
    set({ items: rest, selectedId: get().selectedId === key ? nextSel : get().selectedId });
    if (rest.length === 0) set({ billDiscount: 0 });
  },

  clearCart: () =>
    set({ items: [], customer: null, doctor: null, paymentMode: "cash", notes: "", billDiscount: 0, selectedId: null }),

  holdBill: (label) => {
    const s = get();
    if (s.items.length === 0) return;
    const bill: HeldBill = {
      id: `${Date.now()}`,
      held_at: new Date().toISOString(),
      label: label || s.customer?.name || `Bill ${s.heldBills.length + 1}`,
      items: s.items,
      customer: s.customer,
      doctor: s.doctor,
      notes: s.notes,
      bill_discount: s.billDiscount,
    };
    const heldBills = [bill, ...s.heldBills];
    writeHeld(heldBills);
    set({ heldBills });
    s.clearCart();
  },

  recallBill: (id) => {
    const bill = get().heldBills.find((b) => b.id === id);
    if (!bill) return;
    const heldBills = get().heldBills.filter((b) => b.id !== id);
    writeHeld(heldBills);
    // bills held before batch tracking have no key
    const items = bill.items.map((i) => ({ ...i, key: i.key ?? lineKey(i.drug.id, i.batch?.id), batch: i.batch ?? null }));
    set({
      heldBills,
      items,
      customer: bill.customer,
      doctor: bill.doctor,
      notes: bill.notes,
      billDiscount: bill.bill_discount,
      selectedId: items[0]?.key ?? null,
    });
  },

  deleteHeld: (id) => {
    const heldBills = get().heldBills.filter((b) => b.id !== id);
    writeHeld(heldBills);
    set({ heldBills });
  },

  subtotal: () => get().items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),
  totalDiscount: () =>
    get().items.reduce((sum, i) => sum + (i.unit_price * i.quantity * i.discount_rate) / 100, 0) + get().billDiscount,
  total: () => Math.max(0, get().items.reduce((sum, i) => sum + i.line_total, 0) - get().billDiscount),
}));
