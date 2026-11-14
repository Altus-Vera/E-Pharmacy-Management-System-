import api from "./api";
import type { Invoice, InvoiceCreate, SalesReturnCreate } from "../types";

export const invoiceService = {
  async create(data: InvoiceCreate): Promise<Invoice> {
    const res = await api.post<Invoice>("/invoices", data);
    return res.data;
  },

  async list(params: { customerId?: number; from?: string; to?: string; status?: string } = {}): Promise<Invoice[]> {
    const res = await api.get<Invoice[]>("/invoices", { params });
    return res.data;
  },

  async getById(id: number): Promise<Invoice> {
    const res = await api.get<Invoice>(`/invoices/${id}`);
    return res.data;
  },

  async getByCustomer(customerId: number): Promise<Invoice[]> {
    const res = await api.get<Invoice[]>("/invoices", { params: { customerId } });
    return res.data;
  },

  async cancel(id: number, reason: string): Promise<Invoice> {
    const res = await api.post<Invoice>(`/invoices/${id}/cancel`, { reason });
    return res.data;
  },

  async createReturn(data: SalesReturnCreate): Promise<unknown> {
    // .NET parses the enum case-insensitively but without underscores (WrongItem)
    const res = await api.post("/sales-returns", { ...data, reason: data.reason.replace(/_/g, "") });
    return res.data;
  },
};
