import api from "./api";

export interface PurchaseInvoice {
  id: number;
  invoice_number: string;
  supplier_id: number;
  supplier?: { id: number; name: string } | null;
  goods_receipt_id: number | null;
  invoice_date: string;
  total_amount: number;
  is_paid: boolean;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseInvoiceCreate {
  invoice_number: string;
  supplier_id: number;
  goods_receipt_id?: number | null;
  invoice_date: string;
  total_amount: number;
  notes?: string;
}

export const purchaseInvoiceService = {
  getAll: () => api.get<PurchaseInvoice[]>("/purchase-invoices").then(r => r.data),
  create: (data: PurchaseInvoiceCreate) => api.post<PurchaseInvoice>("/purchase-invoices", data).then(r => r.data),
  markPaid: (id: number) => api.patch<PurchaseInvoice>(`/purchase-invoices/${id}/pay`).then(r => r.data),
};
