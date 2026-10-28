import api from "./api";
import type { Drug } from "../types";

export const drugService = {
  async search(q: string): Promise<Drug[]> {
    const res = await api.get<Drug[]>("/drugs/search", { params: { q } });
    return res.data;
  },

  async getById(id: number): Promise<Drug> {
    const res = await api.get<Drug>(`/drugs/${id}`);
    return res.data;
  },
};
