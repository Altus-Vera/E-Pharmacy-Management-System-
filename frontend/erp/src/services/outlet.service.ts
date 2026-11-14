import api from "./api";

export interface Outlet {
  id: number;
  name: string;
  code: string;
  address: string | null;
  contact_number: string | null;
  manager_name: string | null;
  is_active: boolean;
  is_head_office: boolean;
  created_at: string;
}

export interface OutletCreate {
  name: string;
  code: string;
  address?: string;
  contact_number?: string;
  manager_name?: string;
  is_head_office?: boolean;
}

export type TransferStatus = "pending" | "approved" | "in_transit" | "received" | "cancelled";

export interface StockTransfer {
  id: number;
  transfer_number: string;
  from_outlet_id: number;
  from_outlet_name: string | null;
  to_outlet_id: number;
  to_outlet_name: string | null;
  drug_id: number;
  drug_name: string | null;
  quantity: number;
  notes: string | null;
  status: TransferStatus;
  created_at: string;
  updated_at: string;
}

export interface TransferCreate {
  from_outlet_id: number;
  to_outlet_id: number;
  drug_id: number;
  quantity: number;
  notes?: string;
}

export const outletService = {
  getAll: () => api.get<Outlet[]>("/outlets").then(r => r.data),
  create: (data: OutletCreate) => api.post<Outlet>("/outlets", data).then(r => r.data),
  update: (id: number, data: Partial<OutletCreate & { is_active: boolean }>) =>
    api.patch<Outlet>(`/outlets/${id}`, data).then(r => r.data),
};

export const transferService = {
  getAll: () => api.get<StockTransfer[]>("/stock-transfers").then(r => r.data),
  create: (data: TransferCreate) => api.post<StockTransfer>("/stock-transfers", data).then(r => r.data),
  updateStatus: (id: number, status: TransferStatus) =>
    api.patch<StockTransfer>(`/stock-transfers/${id}/status`, { status }).then(r => r.data),
};
