import api from "./api";

export type ReturnReason = "damaged" | "expired" | "wrong_item" | "patient_refusal" | "other";
export type ReturnStatus = "pending" | "approved" | "rejected";

export interface SalesReturn {
  id: number;
  return_number: string;
  invoice_id: number;
  invoice?: { id: number; invoice_number: string } | null;
  drug_id: number;
  drug?: { id: number; brand_name: string; item_code: string } | null;
  quantity: number;
  refund_amount: number;
  reason: ReturnReason;
  status: ReturnStatus;
  notes: string | null;
  processed_by_user_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface SalesReturnCreate {
  invoice_id: number;
  drug_id: number;
  quantity: number;
  refund_amount: number;
  reason: ReturnReason;
  notes?: string;
}

export const salesReturnService = {
  getAll: () => api.get<SalesReturn[]>("/sales-returns").then(r => r.data),
  create: (data: SalesReturnCreate) =>
    api.post<SalesReturn>("/sales-returns", { ...data, reason: data.reason.replace(/_/g, "") }).then(r => r.data),
  /** Approving puts the returned quantity back into stock. */
  approve: (id: number) => api.patch<SalesReturn>(`/sales-returns/${id}/approve`).then(r => r.data),
};
