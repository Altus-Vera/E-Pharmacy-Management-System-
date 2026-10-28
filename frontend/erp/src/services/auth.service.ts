import api from "./api";
import type { LoginRequest, TokenResponse } from "../types";

export const authService = {
  async login(data: LoginRequest): Promise<TokenResponse> {
    const res = await api.post<TokenResponse>("/auth/login", data);
    return res.data;
  },
};
