import api from "./api";
import type { Invoice, InvoiceCreate } from "../types";

export const invoiceService = {
  async create(data: InvoiceCreate): Promise<Invoice> {
    const res = await api.post<Invoice>("/invoices", data);
    return res.data;
  },

  async getById(id: number): Promise<Invoice> {
    const res = await api.get<Invoice>(`/invoices/${id}`);
    return res.data;
  },

  async getByCustomer(customerId: number): Promise<Invoice[]> {
    const res = await api.get<Invoice[]>(`/invoices/customer/${customerId}`);
    return res.data;
  },

  async cancel(id: number, reason: string): Promise<Invoice> {
    const res = await api.post<Invoice>(`/invoices/${id}/cancel`, { reason });
    return res.data;
  },
};
