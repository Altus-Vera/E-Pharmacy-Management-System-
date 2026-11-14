import api from "./api";
import type { Doctor, DoctorCreate } from "../types";

export const doctorService = {
  async getAll(skip = 0, limit = 200): Promise<Doctor[]> {
    const res = await api.get<Doctor[]>("/doctors", { params: { skip, limit } });
    return res.data;
  },

  async search(q: string): Promise<Doctor[]> {
    const res = await api.get<Doctor[]>("/doctors/search", { params: { q } });
    return res.data;
  },

  async getById(id: number): Promise<Doctor> {
    const res = await api.get<Doctor>(`/doctors/${id}`);
    return res.data;
  },

  async create(data: DoctorCreate): Promise<Doctor> {
    const res = await api.post<Doctor>("/doctors", data);
    return res.data;
  },

  async update(id: number, data: Partial<DoctorCreate> & { is_active?: boolean }): Promise<Doctor> {
    const res = await api.patch<Doctor>(`/doctors/${id}`, data);
    return res.data;
  },
};
