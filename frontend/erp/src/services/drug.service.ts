import api from "./api";
import type { Drug, DrugCreate } from "../types";

export const drugService = {
  async getAll(skip = 0, limit = 100): Promise<Drug[]> {
    const res = await api.get<Drug[]>("/drugs", { params: { skip, limit } });
    return res.data;
  },

  async search(q: string): Promise<Drug[]> {
    const res = await api.get<Drug[]>("/drugs", { params: { search: q } });
    return res.data;
  },

  async getLowStock(): Promise<Drug[]> {
    const res = await api.get<Drug[]>("/drugs", { params: { lowStock: true } });
    return res.data;
  },

  async getExpiringSoon(): Promise<Drug[]> {
    const res = await api.get<Drug[]>("/drugs", { params: { expiringSoon: true } });
    return res.data;
  },

  async getById(id: number): Promise<Drug> {
    const res = await api.get<Drug>(`/drugs/${id}`);
    return res.data;
  },

  async create(data: DrugCreate): Promise<Drug> {
    const res = await api.post<Drug>("/drugs", data);
    return res.data;
  },

  async update(id: number, data: Partial<DrugCreate>): Promise<Drug> {
    const res = await api.patch<Drug>(`/drugs/${id}`, data);
    return res.data;
  },
};
