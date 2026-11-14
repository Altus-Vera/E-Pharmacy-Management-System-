import api from "./api";

export interface StockViewItem {
  id: number;
  item_code: string;
  brand_name: string;
  generic_name: string;
  dosage_form: string;
  strength: string | null;
  quantity: number;
  reorder_level: number;
  low_stock_threshold: number;
  unit_price: number;
  expiry_date: string | null;
  batch_number: string | null;
  supplier_id: number | null;
  is_active: boolean;
}

export interface StockMovement {
  id: number;
  drug_id: number;
  movement_type: string;
  quantity: number;
  unit_cost: number | null;
  notes: string | null;
  performed_by_user_id: number | null;
  created_at: string;
}

export const stockService = {
  getStockView: (skip = 0, limit = 200) =>
    api.get<StockViewItem[]>("/stock/view", { params: { skip, limit } }).then(r => r.data),
  adjust: (drug_id: number, quantity_change: number, notes?: string) =>
    api.post<StockMovement>("/stock/adjust", { drug_id, quantity_change, notes }).then(r => r.data),
  getMovements: (drug_id: number) =>
    api.get<StockMovement[]>(`/stock/movements/${drug_id}`).then(r => r.data),
};
