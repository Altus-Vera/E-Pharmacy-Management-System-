import api from "./api";
import type { Doctor, DoctorCreate } from "../types";

export const doctorService = {
  async search(q: string): Promise<Doctor[]> {
    const res = await api.get<Doctor[]>("/doctors", { params: { search: q } });
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
};
