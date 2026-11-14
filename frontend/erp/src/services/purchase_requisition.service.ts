import api from "./api";

export type RequisitionStatus = "draft" | "submitted" | "approved" | "rejected" | "ordered";

export interface RequisitionItem {
  id: number;
  drug_id: number;
  quantity_needed: number;
  notes: string | null;
}

export interface PurchaseRequisition {
  id: number;
  req_number: string;
  request_date: string;
  required_by_date: string | null;
  status: RequisitionStatus;
  notes: string | null;
  requested_by_user_id: number | null;
  approved_by_user_id: number | null;
  purchase_order_id: number | null;
  items: RequisitionItem[];
  created_at: string;
  updated_at: string;
}

export interface RequisitionItemCreate {
  drug_id: number;
  quantity_needed: number;
  notes?: string;
}

export interface RequisitionCreate {
  request_date: string;
  required_by_date?: string;
  notes?: string;
  items: RequisitionItemCreate[];
}

export const purchaseRequisitionService = {
  getAll: () => api.get<PurchaseRequisition[]>("/purchase-requisitions").then(r => r.data),
  getById: (id: number) => api.get<PurchaseRequisition>(`/purchase-requisitions/${id}`).then(r => r.data),
  create: (data: RequisitionCreate) => api.post<PurchaseRequisition>("/purchase-requisitions", data).then(r => r.data),
  updateStatus: (id: number, status: RequisitionStatus) =>
    api.patch<PurchaseRequisition>(`/purchase-requisitions/${id}`, { status }).then(r => r.data),
};
