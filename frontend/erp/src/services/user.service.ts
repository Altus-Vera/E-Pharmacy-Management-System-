import api from "./api";
import type { User, UserCreate } from "../types";

export const userService = {
  async getAll(): Promise<User[]> {
    const res = await api.get<User[]>("/users");
    return res.data;
  },

  async getById(id: number): Promise<User> {
    const res = await api.get<User>(`/users/${id}`);
    return res.data;
  },

  async create(data: UserCreate): Promise<User> {
    const res = await api.post<User>("/users", data);
    return res.data;
  },

  async update(id: number, data: Partial<UserCreate>): Promise<User> {
    const res = await api.patch<User>(`/users/${id}`, data);
    return res.data;
  },

  async deactivate(id: number): Promise<User> {
    const res = await api.delete<User>(`/users/${id}`);
    return res.data;
  },
};
