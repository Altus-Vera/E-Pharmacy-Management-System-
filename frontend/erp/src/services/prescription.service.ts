import api from "./api";
import type { Prescription } from "../types";

export const prescriptionService = {
  async getAll(skip = 0, limit = 300): Promise<Prescription[]> {
    const res = await api.get<Prescription[]>("/prescriptions", { params: { skip, limit } });
    return res.data;
  },

  async getByCustomer(customerId: number): Promise<Prescription[]> {
    const res = await api.get<Prescription[]>("/prescriptions", { params: { customerId } });
    return res.data;
  },

  async update(id: number, data: { is_active?: boolean }): Promise<Prescription> {
    const res = await api.patch<Prescription>(`/prescriptions/${id}`, data);
    return res.data;
  },

  async uploadScan(id: number, file: File): Promise<Prescription> {
    const form = new FormData();
    form.append("file", file);
    const res = await api.post<Prescription>(`/prescriptions/${id}/scan`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
};
