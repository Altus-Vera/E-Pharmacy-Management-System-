import api from "./api";

export type ReturnReason = "wrong_item" | "damaged" | "expired" | "patient_refused" | "other";

export interface SalesReturnItem {
  id: number;
  drug_id: number;
  quantity_returned: number;
  unit_price: number;
  line_total: number;
  restock: boolean;
}

export interface SalesReturn {
  id: number;
  return_number: string;
  invoice_id: number | null;
  customer_id: number | null;
  return_date: string;
  reason: ReturnReason;
  notes: string | null;
  total_refund: number;
  processed_by_user_id: number | null;
  items: SalesReturnItem[];
  created_at: string;
  updated_at: string;
}

export interface SalesReturnItemCreate {
  drug_id: number;
  quantity_returned: number;
  unit_price: number;
  restock?: boolean;
}

export interface SalesReturnCreate {
  invoice_id?: number;
  customer_id?: number;
  return_date: string;
  reason: ReturnReason;
  notes?: string;
  items: SalesReturnItemCreate[];
}

export const salesReturnService = {
  getAll: () => api.get<SalesReturn[]>("/sales-returns").then(r => r.data),
  getById: (id: number) => api.get<SalesReturn>(`/sales-returns/${id}`).then(r => r.data),
  create: (data: SalesReturnCreate) => api.post<SalesReturn>("/sales-returns", data).then(r => r.data),
};
