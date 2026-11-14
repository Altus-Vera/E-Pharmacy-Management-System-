import { create } from "zustand";
import type { CartItem, Customer, Doctor, Drug, PaymentMode } from "../types";

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

interface CartState {
  items: CartItem[];
  customer: Customer | null;
  doctor: Doctor | null;
  paymentMode: PaymentMode;
  notes: string;
  billDiscount: number;
  selectedId: number | null;
  heldBills: HeldBill[];

  setCustomer: (customer: Customer | null) => void;
  setDoctor: (doctor: Doctor | null) => void;
  setPaymentMode: (mode: PaymentMode) => void;
  setNotes: (notes: string) => void;
  setBillDiscount: (amount: number) => void;
  select: (drugId: number | null) => void;
  selectNext: (dir: 1 | -1) => void;
  addItem: (drug: Drug, quantity?: number) => void;
  updateQuantity: (drugId: number, quantity: number) => void;
  updateDiscount: (drugId: number, discountRate: number) => void;
  removeItem: (drugId: number) => void;
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
    const idx = items.findIndex((i) => i.drug.id === selectedId);
    const next = idx === -1 ? (dir === 1 ? 0 : items.length - 1) : Math.min(Math.max(idx + dir, 0), items.length - 1);
    set({ selectedId: items[next].drug.id });
  },

  addItem: (drug, quantity = 1) => {
    const items = get().items;
    const existing = items.find((i) => i.drug.id === drug.id);
    if (existing) {
      set({
        selectedId: drug.id,
        items: items.map((i) =>
          i.drug.id === drug.id
            ? {
                ...i,
                quantity: i.quantity + quantity,
                line_total: calcLineTotal(i.unit_price, i.quantity + quantity, i.discount_rate),
              }
            : i
        ),
      });
    } else {
      const discountRate = drug.discount ?? 0;
      set({
        selectedId: drug.id,
        items: [
          ...items,
          {
            drug,
            quantity,
            unit_price: drug.unit_price,
            discount_rate: discountRate,
            line_total: calcLineTotal(drug.unit_price, quantity, discountRate),
          },
        ],
      });
    }
  },

  updateQuantity: (drugId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(drugId);
      return;
    }
    set({
      items: get().items.map((i) =>
        i.drug.id === drugId
          ? { ...i, quantity, line_total: calcLineTotal(i.unit_price, quantity, i.discount_rate) }
          : i
      ),
    });
  },

  updateDiscount: (drugId, discountRate) => {
    const rate = Math.min(Math.max(0, discountRate), 100);
    set({
      items: get().items.map((i) =>
        i.drug.id === drugId
          ? { ...i, discount_rate: rate, line_total: calcLineTotal(i.unit_price, i.quantity, rate) }
          : i
      ),
    });
  },

  removeItem: (drugId) => {
    const items = get().items;
    const idx = items.findIndex((i) => i.drug.id === drugId);
    const rest = items.filter((i) => i.drug.id !== drugId);
    const nextSel = rest.length ? rest[Math.min(idx, rest.length - 1)].drug.id : null;
    set({ items: rest, selectedId: get().selectedId === drugId ? nextSel : get().selectedId });
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
    set({
      heldBills,
      items: bill.items,
      customer: bill.customer,
      doctor: bill.doctor,
      notes: bill.notes,
      billDiscount: bill.bill_discount,
      selectedId: bill.items[0]?.drug.id ?? null,
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
