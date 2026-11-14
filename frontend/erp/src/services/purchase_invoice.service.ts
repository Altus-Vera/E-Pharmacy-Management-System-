import api from "./api";

export type PurchaseInvoiceStatus = "unpaid" | "partially_paid" | "paid" | "overdue";

export interface PurchaseInvoice {
  id: number;
  invoice_number: string;
  supplier_id: number;
  purchase_order_id: number | null;
  grn_id: number | null;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  status: PurchaseInvoiceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseInvoiceCreate {
  supplier_id: number;
  purchase_order_id?: number;
  grn_id?: number;
  invoice_date: string;
  due_date?: string;
  subtotal: number;
  tax_amount?: number;
  discount_amount?: number;
  total_amount: number;
  notes?: string;
}

export const purchaseInvoiceService = {
  getAll: () => api.get<PurchaseInvoice[]>("/purchase-invoices").then(r => r.data),
  getById: (id: number) => api.get<PurchaseInvoice>(`/purchase-invoices/${id}`).then(r => r.data),
  create: (data: PurchaseInvoiceCreate) => api.post<PurchaseInvoice>("/purchase-invoices", data).then(r => r.data),
  recordPayment: (id: number, paid_amount: number) =>
    api.patch<PurchaseInvoice>(`/purchase-invoices/${id}`, { paid_amount }).then(r => r.data),
};
