import api from "./api";

export interface GrnItem {
  id: number;
  drug_id: number;
  quantity_received: number;
  unit_cost: number;
  batch_number: string | null;
  expiry_date: string | null;
  selling_price: number | null;
  drug_batch_id: number | null;
  is_free_goods: boolean;
}

export interface GoodsReceipt {
  id: number;
  grn_number: string;
  purchase_order_id: number | null;
  supplier_id: number;
  received_date: string;
  notes: string | null;
  received_by_user_id: number | null;
  items: GrnItem[];
  created_at: string;
  updated_at: string;
}

export interface GrnItemCreate {
  drug_id: number;
  quantity_received: number;
  unit_cost: number;
  batch_number?: string;
  expiry_date?: string;
  manufactured_date?: string;
  /** Selling price for this new stock; it becomes its own batch, sold after older batches (FIFO). */
  selling_price?: number;
  /** Optional full-pack price for this batch (default = units per pack × unit price). */
  pack_selling_price?: number;
  is_free_goods?: boolean;
  /** UI only: the drug's current selling price, for comparison */
  current_price?: number;
}

export interface GrnCreate {
  supplier_id: number;
  purchase_order_id?: number;
  received_date: string;
  notes?: string;
  items: GrnItemCreate[];
}

export const grnService = {
  getAll: (skip = 0, limit = 100) =>
    api.get<GoodsReceipt[]>("/grn", { params: { skip, limit } }).then(r => r.data),
  getById: (id: number) => api.get<GoodsReceipt>(`/grn/${id}`).then(r => r.data),
  create: (data: GrnCreate) => api.post<GoodsReceipt>("/grn", data).then(r => r.data),
};
