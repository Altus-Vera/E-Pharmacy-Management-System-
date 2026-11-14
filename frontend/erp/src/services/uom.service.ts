import api from "./api";

export interface UnitOfMeasure {
  id: number;
  name: string;
  abbreviation: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UomCreate {
  name: string;
  abbreviation: string;
}

export const uomService = {
  getAll: () => api.get<UnitOfMeasure[]>("/uom").then(r => r.data),
  create: (data: UomCreate) => api.post<UnitOfMeasure>("/uom", data).then(r => r.data),
  update: (id: number, data: Partial<UomCreate & { is_active: boolean }>) =>
    api.patch<UnitOfMeasure>(`/uom/${id}`, data).then(r => r.data),
};
