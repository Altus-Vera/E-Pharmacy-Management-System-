import api from "./api";

export interface StockLocation {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockLocationCreate {
  name: string;
  description?: string;
}

export const stockLocationService = {
  getAll: () => api.get<StockLocation[]>("/stock-locations").then(r => r.data),
  create: (data: StockLocationCreate) => api.post<StockLocation>("/stock-locations", data).then(r => r.data),
  update: (id: number, data: Partial<StockLocationCreate & { is_active: boolean }>) =>
    api.patch<StockLocation>(`/stock-locations/${id}`, data).then(r => r.data),
};
