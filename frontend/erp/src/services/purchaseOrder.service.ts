import api from "./api";
import type { PurchaseOrder, PurchaseOrderCreate } from "../types";

export const purchaseOrderService = {
  async getAll(): Promise<PurchaseOrder[]> {
    const res = await api.get<PurchaseOrder[]>("/purchase-orders");
    return res.data;
  },

  async getPending(): Promise<PurchaseOrder[]> {
    const res = await api.get<PurchaseOrder[]>("/purchase-orders/pending");
    return res.data;
  },

  async getById(id: number): Promise<PurchaseOrder> {
    const res = await api.get<PurchaseOrder>(`/purchase-orders/${id}`);
    return res.data;
  },

  async create(data: PurchaseOrderCreate): Promise<PurchaseOrder> {
    const res = await api.post<PurchaseOrder>("/purchase-orders", data);
    return res.data;
  },

  async updateStatus(id: number, status: string): Promise<PurchaseOrder> {
    const res = await api.patch<PurchaseOrder>(`/purchase-orders/${id}`, { status });
    return res.data;
  },
};
