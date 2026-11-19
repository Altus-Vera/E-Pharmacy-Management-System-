import { create } from "zustand";
import api from "../services/api";
import { STORE } from "../utils/receipt";

export interface ShiftTotals {
  sales_count: number;
  gross_sales: number;
  discount_total: number;
  net_sales: number;
  cash_sales: number;
  card_sales: number;
  other_sales: number;
  void_count: number;
  void_total: number;
  return_count: number;
  return_total: number;
  items_sold: number;
  opening_cash: number;
  expected_cash: number;
  first_invoice?: string | null;
  last_invoice?: string | null;
  last_sale_at?: string | null;
}

export interface Shift {
  id: number;
  shift_number: string;
  user_id: number;
  cashier_name: string;
  cashier_username: string;
  terminal: string | null;
  status: "open" | "closed";
  live: boolean;
  opened_at: string;
  closed_at: string | null;
  closed_by_name: string | null;
  duration_minutes: number;
  opening_cash: number;
  opening_notes: string | null;
  counted_cash: number | null;
  closing_notes: string | null;
  totals: ShiftTotals;
  cash_difference: number | null;
  top_items: { name: string; quantity: number; amount: number }[] | null;
}

interface ShiftState {
  /** undefined = not checked yet, null = no open shift */
  shift: Shift | null | undefined;
  load: () => Promise<Shift | null>;
  start: (openingCash: number, notes?: string) => Promise<Shift>;
  end: (countedCash: number, notes?: string) => Promise<Shift>;
  reset: () => void;
}

export const useShiftStore = create<ShiftState>((set, get) => ({
  shift: undefined,
  load: async () => {
    const s = (await api.get<{ shift: Shift | null }>("/shifts/current")).data.shift;
    set({ shift: s });
    return s;
  },
  start: async (opening_cash, notes) => {
    const s = (await api.post<Shift>("/shifts/start", { opening_cash, notes, terminal: STORE.terminal })).data;
    set({ shift: s });
    return s;
  },
  end: async (counted_cash, notes) => {
    const cur = get().shift;
    if (!cur) throw new Error("No open shift");
    const s = (await api.post<Shift>(`/shifts/${cur.id}/end`, { counted_cash, notes })).data;
    set({ shift: null });
    return s;
  },
  reset: () => set({ shift: undefined }),
}));
