import api from "./api";
import type { Supplier, SupplierCreate } from "../types";

export const supplierService = {
  async getAll(): Promise<Supplier[]> {
    return (await api.get<Supplier[]>("/suppliers")).data;
  },
  async create(data: SupplierCreate): Promise<Supplier> {
    return (await api.post<Supplier>("/suppliers", data)).data;
  },
  async update(id: number, data: SupplierCreate): Promise<Supplier> {
    return (await api.patch<Supplier>(`/suppliers/${id}`, data)).data;
  },
};
