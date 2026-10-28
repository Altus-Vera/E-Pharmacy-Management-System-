import api from "./api";
import type { Supplier, SupplierCreate } from "../types";

export const supplierService = {
  async getAll(): Promise<Supplier[]> {
    const res = await api.get<Supplier[]>("/suppliers");
    return res.data;
  },

  async getById(id: number): Promise<Supplier> {
    const res = await api.get<Supplier>(`/suppliers/${id}`);
    return res.data;
  },

  async create(data: SupplierCreate): Promise<Supplier> {
    const res = await api.post<Supplier>("/suppliers", data);
    return res.data;
  },

  async update(id: number, data: Partial<SupplierCreate>): Promise<Supplier> {
    const res = await api.patch<Supplier>(`/suppliers/${id}`, data);
    return res.data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/suppliers/${id}`);
  },
};
