import api from "./api";
import type { Drug } from "../types";

export type StockViewItem = Drug;

export interface StockMovement {
  id: number;
  drug_id: number;
  movement_type: string;
  quantity: number;
  unit_cost: number | null;
  reference_type: string;
  reference_id: number | null;
  notes: string | null;
  performed_by_user_id: number | null;
  created_at: string;
}

export const stockService = {
  getStockView: () => api.get<Drug[]>("/drugs").then(r => r.data),
  /** Positive change = increase, negative = decrease. Reason is required. */
  adjust: (drug_id: number, quantity_change: number, reason: string) =>
    api.post("/stock-adjustments", {
      drug_id,
      quantity: Math.abs(quantity_change),
      adjustment_type: quantity_change >= 0 ? "increase" : "decrease",
      reason: reason || "Manual adjustment",
    }).then(r => r.data),
  getMovements: (drug_id: number) =>
    api.get<StockMovement[]>("/stock-movements", { params: { drugId: drug_id } }).then(r => r.data),
};
