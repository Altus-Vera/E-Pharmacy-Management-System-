import { create } from "zustand";
import type { CalcResult, CartItem, Customer, Doctor, Drug, DrugBatch, PaymentMode, SaleUnit } from "../types";

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

// ── sale units & selling rules (mirror of the API's Dispensing service) ──────

/** A cart line is one drug, from one batch, in one sale unit. */
export const lineKey = (drugId: number, batchId?: number | null, unit: SaleUnit = "unit") => `${drugId}:${batchId ?? 0}:${unit}`;

export const baseUnit = (d: Drug) => d.base_unit || "unit";
export const sellMode = (d: Drug) => d.sell_mode ?? "loose";

export function unitsPer(d: Drug, u: SaleUnit): number {
  if (u === "strip") return Math.max(d.units_per_strip ?? 1, 1);
  if (u === "pack") return Math.max(d.pack_size ?? 1, 1);
  return 1;
}

/** Price of one sale unit from a batch (a pack may carry its own cheaper price). */
export function priceFor(d: Drug, b: DrugBatch | null, u: SaleUnit): number {
  const unit = b ? b.selling_price : d.unit_price;
  if (u === "pack") return b?.pack_selling_price ?? unit * unitsPer(d, "pack");
  if (u === "strip") return unit * unitsPer(d, "strip");
  return unit;
}

/** Sale units the counter may use for this drug. */
export function allowedUnits(d: Drug): SaleUnit[] {
  const mode = sellMode(d);
  const out: SaleUnit[] = [];
  const hasStrip = (d.units_per_strip ?? 0) > 1;
  const hasPack = (d.pack_size ?? 0) > 1;
  if (mode === "loose" || ((mode === "pack" && !hasPack) || (mode === "strip" && !hasStrip))) out.push("unit");
  if (hasStrip && mode !== "pack") out.push("strip");
  if (hasPack) out.push("pack");
  return out.length ? out : ["unit"];
}

/** Sale unit a drug is added in by default. */
export function defaultUnit(d: Drug): SaleUnit {
  const mode = sellMode(d);
  if (mode === "strip" && (d.units_per_strip ?? 0) > 1) return "strip";
  if (mode === "pack" && (d.pack_size ?? 0) > 1) return "pack";
  return "unit";
}

export function unitLabel(d: Drug, u: SaleUnit, qty?: number): string {
  const bu = baseUnit(d);
  const n = qty ?? 1;
  const pl = (w: string) => (n === 1 ? w : w + "s");
  if (u === "strip") return `${qty !== undefined ? n + " " : ""}${pl("strip")} × ${unitsPer(d, u)}`;
  if (u === "pack") return unitsPer(d, u) > 1 ? `${qty !== undefined ? n + " " : ""}${pl("pack")} × ${unitsPer(d, u)}` : `${qty !== undefined ? n + " " : ""}${pl(bu)}`;
  return `${qty !== undefined ? n + " " : ""}${pl(bu)}`;
}

/** Name for unit pickers: "Loose · tablet", "Card · 10 tablets", "Pack · 100 tablets". */
export function unitChoice(d: Drug, u: SaleUnit): string {
  const bu = baseUnit(d), n = unitsPer(d, u);
  if (u === "strip") return `Card · ${n} ${bu}s`;
  if (u === "pack") return n > 1 ? `Pack · ${n} ${bu}s` : `Pack · ${bu}`;
  return `Loose · ${bu}`;
}

/** Sellable batches, oldest received first (FIFO). The API already filters and orders them. */
export function sellableBatches(drug: Drug): DrugBatch[] {
  return (drug.batches ?? []).filter((b) => b.quantity_remaining > 0);
}

/** Base units of this drug that can still be sold. */
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
  /** Adds `quantity` sale units FIFO: fills the oldest batch first, then the next batch (own price) on its own line. Returns units added. */
  addItem: (drug: Drug, quantity?: number, unit?: SaleUnit, batchId?: number) => number;
  updateQuantity: (key: string, quantity: number) => void;
  updateDiscount: (key: string, discountRate: number) => void;
  /** Switch a line to another sale unit (loose ↔ card ↔ pack). Keeps the line's batch; quantity converts where it can (min 1). */
  changeUnit: (key: string, unit: SaleUnit) => void;
  /** Move a line to another batch (price follows the batch). Quantity is capped by what that batch still holds. Returns units moved. */
  changeBatch: (key: string, batchId: number) => number;
  /** Replace a drug's lines with a days-calculator result (quantities, batches, prices, directions). */
  applyCalc: (drug: Drug, calc: CalcResult) => void;
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

/** Base units already on the bill from one batch. */
const usedInBatch = (items: CartItem[], drugId: number, batchId: number, exceptKey?: string) =>
  items.filter((i) => i.drug.id === drugId && i.batch?.id === batchId && i.key !== exceptKey).reduce((s, i) => s + i.quantity * i.units_per, 0);

/** FIFO allocation of `quantity` more sale units of `drug` onto the existing lines. */
function allocate(items: CartItem[], drug: Drug, quantity: number, unit: SaleUnit, batchId?: number): { items: CartItem[]; added: number; lastKey: string | null } {
  let next = [...items];
  let left = quantity;
  let lastKey: string | null = null;
  const per = unitsPer(drug, unit);
  const meta = next.find((i) => i.drug.id === drug.id);
  const disc = meta?.discount_rate ?? drug.discount ?? 0;

  const put = (batch: DrugBatch | null, add: number) => {
    const key = lineKey(drug.id, batch?.id, unit);
    const price = priceFor(drug, batch, unit);
    const ex = next.find((i) => i.key === key);
    if (ex) next = next.map((i) => (i.key === key ? { ...i, quantity: i.quantity + add, line_total: calcLineTotal(i.unit_price, i.quantity + add, i.discount_rate) } : i));
    else next.push({
      key, drug, batch, sale_unit: unit, units_per: per, quantity: add, unit_price: price, discount_rate: disc,
      line_total: calcLineTotal(price, add, disc),
      dose: meta?.dose, frequency_code: meta?.frequency_code, days: meta?.days, directions: meta?.directions,
    });
    lastKey = key;
  };

  if (!drug.batches) {
    // no batch data (older API): single line, capped by total stock
    const used = next.filter((i) => i.drug.id === drug.id).reduce((s, i) => s + i.quantity * i.units_per, 0);
    const add = Math.min(left, Math.floor((drug.quantity - used) / per));
    if (add <= 0) return { items, added: 0, lastKey: null };
    put(null, add);
    return { items: next, added: add, lastKey };
  }

  // a batch the cashier picked goes first; anything it can't hold falls back to FIFO
  const all = sellableBatches(drug);
  const order = batchId ? [...all.filter((b) => b.id === batchId), ...all.filter((b) => b.id !== batchId)] : all;
  for (const b of order) {
    if (left <= 0) break;
    const room = Math.floor((b.quantity_remaining - usedInBatch(next, drug.id, b.id)) / per);
    if (room <= 0) continue;
    const add = Math.min(left, room);
    put(b, add);
    left -= add;
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

  addItem: (drug, quantity = 1, unit, batchId) => {
    const r = allocate(get().items, drug, quantity, unit ?? defaultUnit(drug), batchId);
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
    const cap = line.batch
      ? Math.floor((line.batch.quantity_remaining - usedInBatch(get().items, line.drug.id, line.batch.id, key)) / line.units_per)
      : Math.floor(line.drug.quantity / line.units_per);
    const here = Math.min(quantity, Math.max(cap, 0));
    set({
      items: get().items.map((i) => (i.key === key ? { ...i, quantity: here, line_total: calcLineTotal(i.unit_price, here, i.discount_rate) } : i)),
    });
    // more than this batch holds: the rest comes from the next batch (FIFO), on its own line
    if (quantity > here) get().addItem(line.drug, quantity - here, line.sale_unit);
  },

  updateDiscount: (key, discountRate) => {
    const rate = Math.min(Math.max(0, discountRate), 100);
    set({
      items: get().items.map((i) => (i.key === key ? { ...i, discount_rate: rate, line_total: calcLineTotal(i.unit_price, i.quantity, rate) } : i)),
    });
  },

  changeUnit: (key, unit) => {
    const line = get().items.find((i) => i.key === key);
    if (!line || line.sale_unit === unit) return;
    const per = unitsPer(line.drug, unit);
    const qty = Math.max(1, Math.floor((line.quantity * line.units_per) / per));
    const before = get().items;
    const at = before.findIndex((i) => i.key === key);
    get().removeItem(key);
    if (get().addItem(line.drug, qty, unit, line.batch?.id) === 0) { set({ items: before, selectedId: key }); return; }
    // keep the line where it was on the bill
    const oldKeys = new Set(before.map((i) => i.key));
    const now = get().items, fresh = now.filter((i) => !oldKeys.has(i.key)), rest = now.filter((i) => oldKeys.has(i.key));
    set({ items: [...rest.slice(0, at), ...fresh, ...rest.slice(at)] });
  },

  changeBatch: (key, batchId) => {
    const line = get().items.find((i) => i.key === key);
    if (!line || line.batch?.id === batchId) return 0;
    const target = sellableBatches(line.drug).find((b) => b.id === batchId);
    if (!target) return 0;
    const room = Math.floor((target.quantity_remaining - usedInBatch(get().items, line.drug.id, batchId, key)) / line.units_per);
    const move = Math.min(line.quantity, Math.max(room, 0));
    if (move <= 0) return 0;
    const keep = line.quantity - move;
    // what doesn't fit stays on the old batch line
    set({ items: keep > 0
      ? get().items.map((i) => (i.key === key ? { ...i, quantity: keep, line_total: calcLineTotal(i.unit_price, keep, i.discount_rate) } : i))
      : get().items.filter((i) => i.key !== key) });
    const newKey = lineKey(line.drug.id, batchId, line.sale_unit);
    const price = priceFor(line.drug, target, line.sale_unit);
    const ex = get().items.find((i) => i.key === newKey);
    set({
      items: ex
        ? get().items.map((i) => (i.key === newKey ? { ...i, quantity: i.quantity + move, line_total: calcLineTotal(i.unit_price, i.quantity + move, i.discount_rate) } : i))
        : [...get().items, { ...line, key: newKey, batch: target, unit_price: price, quantity: move, line_total: calcLineTotal(price, move, line.discount_rate) }],
      selectedId: newKey,
    });
    return move;
  },

  applyCalc: (drug, calc) => {
    const keep = get().items.filter((i) => i.drug.id !== drug.id);
    const old = get().items.find((i) => i.drug.id === drug.id);
    const disc = old?.discount_rate ?? drug.discount ?? 0;
    const batches = drug.batches ?? [];
    const lines: CartItem[] = calc.lines.map((l) => ({
      key: lineKey(drug.id, l.drug_batch_id, l.sale_unit),
      drug,
      batch: batches.find((b) => b.id === l.drug_batch_id) ?? {
        id: l.drug_batch_id, drug_id: drug.id, batch_number: l.batch_number, expiry_date: l.expiry_date, manufactured_date: null,
        quantity_received: 0, quantity_remaining: l.quantity * l.units_per_sale_unit, unit_cost: null,
        selling_price: l.sale_unit === "unit" ? l.unit_price : drug.unit_price, received_at: "", source: "",
      },
      sale_unit: l.sale_unit,
      units_per: l.units_per_sale_unit,
      quantity: l.quantity,
      unit_price: l.unit_price,
      discount_rate: disc,
      line_total: calcLineTotal(l.unit_price, l.quantity, disc),
      dose: calc.dose, frequency_code: calc.frequency_code, days: calc.days, directions: calc.directions,
    }));
    set({ items: [...keep, ...lines], selectedId: lines[0]?.key ?? get().selectedId });
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
    // bills held before batch / sale-unit tracking lack these fields
    const items = bill.items.map((i) => {
      const unit = i.sale_unit ?? "unit";
      return { ...i, sale_unit: unit, units_per: i.units_per ?? 1, batch: i.batch ?? null, key: lineKey(i.drug.id, i.batch?.id, unit) };
    });
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
