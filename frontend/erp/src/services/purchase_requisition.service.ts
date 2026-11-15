import api from "./api";

export interface PurchaseRequisition {
  id: number;
  requisition_number: string;
  drug_id: number;
  drug?: { id: number; brand_name: string; item_code: string; quantity: number } | null;
  quantity_requested: number;
  notes: string | null;
  status: string;
  requested_by_user_id: number | null;
  approved_by_user_id: number | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequisitionLine {
  drug_id: number;
  quantity_requested: number;
  notes?: string;
}

export const purchaseRequisitionService = {
  getAll: () => api.get<PurchaseRequisition[]>("/purchase-requisitions").then(r => r.data),
  /** The API stores one drug per requisition, so each line is posted separately. */
  async createMany(lines: RequisitionLine[]): Promise<PurchaseRequisition[]> {
    const out: PurchaseRequisition[] = [];
    for (const l of lines) out.push((await api.post<PurchaseRequisition>("/purchase-requisitions", l)).data);
    return out;
  },
  approve: (id: number) => api.patch<PurchaseRequisition>(`/purchase-requisitions/${id}/approve`).then(r => r.data),
};
