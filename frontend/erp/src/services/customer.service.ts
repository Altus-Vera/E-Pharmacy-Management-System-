import api from "./api";
import type { Customer, CustomerCreate, CustomerInvoiceSummary } from "../types";

export const customerService = {
  async getAll(skip = 0, limit = 200): Promise<Customer[]> {
    const res = await api.get<Customer[]>("/customers", { params: { skip, limit } });
    return res.data;
  },

  async search(q: string): Promise<Customer[]> {
    const res = await api.get<Customer[]>("/customers", { params: { search: q } });
    return res.data;
  },

  async getById(id: number): Promise<Customer> {
    const res = await api.get<Customer>(`/customers/${id}`);
    return res.data;
  },

  async create(data: CustomerCreate): Promise<Customer> {
    const res = await api.post<Customer>("/customers", data);
    return res.data;
  },

  async update(id: number, data: Partial<CustomerCreate>): Promise<Customer> {
    const res = await api.patch<Customer>(`/customers/${id}`, data);
    return res.data;
  },

  async getInvoices(customerId: number): Promise<CustomerInvoiceSummary[]> {
    const res = await api.get<CustomerInvoiceSummary[]>("/invoices", { params: { customerId } });
    return res.data;
  },
};
