import api from "./api";
import type { PurchaseOrder, PurchaseOrderCreate, PurchaseOrderStatus } from "../types";

export const purchaseOrderService = {
  async getAll(): Promise<PurchaseOrder[]> {
    return (await api.get<PurchaseOrder[]>("/purchase-orders")).data;
  },
  /** Orders still awaiting goods (draft, submitted or partially received). */
  async getPending(): Promise<PurchaseOrder[]> {
    const all = await purchaseOrderService.getAll();
    return all.filter((p) => ["draft", "submitted", "partially_received"].includes(p.status));
  },
  async getById(id: number): Promise<PurchaseOrder> {
    return (await api.get<PurchaseOrder>(`/purchase-orders/${id}`)).data;
  },
  async create(data: PurchaseOrderCreate): Promise<PurchaseOrder> {
    return (await api.post<PurchaseOrder>("/purchase-orders", data)).data;
  },
  async updateStatus(id: number, status: PurchaseOrderStatus): Promise<PurchaseOrder> {
    // backend enum parse ignores case but not underscores
    return (await api.patch<PurchaseOrder>(`/purchase-orders/${id}/status`, { status: status.replace(/_/g, "") })).data;
  },
};
