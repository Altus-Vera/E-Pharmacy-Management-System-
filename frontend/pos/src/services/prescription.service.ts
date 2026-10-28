import api from "./api";
import type { Prescription, PrescriptionCreate } from "../types";

export const prescriptionService = {
  async getByCustomer(customerId: number): Promise<Prescription[]> {
    const res = await api.get<Prescription[]>(`/prescriptions/customer/${customerId}`);
    return res.data;
  },

  async getById(id: number): Promise<Prescription> {
    const res = await api.get<Prescription>(`/prescriptions/${id}`);
    return res.data;
  },

  async create(data: PrescriptionCreate): Promise<Prescription> {
    const res = await api.post<Prescription>("/prescriptions", data);
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
