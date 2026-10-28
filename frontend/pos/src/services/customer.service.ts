import api from "./api";
import type { Customer, CustomerCreate } from "../types";

export const customerService = {
  async search(q: string): Promise<Customer[]> {
    const res = await api.get<Customer[]>("/customers/search", { params: { q } });
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
};
