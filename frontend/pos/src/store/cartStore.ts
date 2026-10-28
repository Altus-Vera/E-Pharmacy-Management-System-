import { create } from "zustand";
import type { CartItem, Customer, Drug, PaymentMode } from "../types";

interface CartState {
  items: CartItem[];
  customer: Customer | null;
  paymentMode: PaymentMode;
  notes: string;

  setCustomer: (customer: Customer | null) => void;
  setPaymentMode: (mode: PaymentMode) => void;
  setNotes: (notes: string) => void;
  addItem: (drug: Drug, quantity?: number) => void;
  updateQuantity: (drugId: number, quantity: number) => void;
  updateDiscount: (drugId: number, discountRate: number) => void;
  removeItem: (drugId: number) => void;
  clearCart: () => void;

  subtotal: () => number;
  total: () => number;
}

function calcLineTotal(unitPrice: number, quantity: number, discountRate: number): number {
  const gross = unitPrice * quantity;
  return gross - (gross * discountRate) / 100;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  customer: null,
  paymentMode: "cash",
  notes: "",

  setCustomer: (customer) => set({ customer }),
  setPaymentMode: (paymentMode) => set({ paymentMode }),
  setNotes: (notes) => set({ notes }),

  addItem: (drug, quantity = 1) => {
    const items = get().items;
    const existing = items.find((i) => i.drug.id === drug.id);
    if (existing) {
      set({
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
    set({
      items: get().items.map((i) =>
        i.drug.id === drugId
          ? { ...i, discount_rate: discountRate, line_total: calcLineTotal(i.unit_price, i.quantity, discountRate) }
          : i
      ),
    });
  },

  removeItem: (drugId) => {
    set({ items: get().items.filter((i) => i.drug.id !== drugId) });
  },

  clearCart: () => set({ items: [], customer: null, paymentMode: "cash", notes: "" }),

  subtotal: () => get().items.reduce((sum, i) => sum + i.line_total, 0),
  total: () => get().subtotal(),
}));
