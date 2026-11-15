import { create } from "zustand";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

function loadUser(): User | null {
  try { return JSON.parse(localStorage.getItem("auth_user") ?? "null"); } catch { return null; }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: loadUser(),
  token: localStorage.getItem("access_token"),

  setAuth: (user, token) => {
    localStorage.setItem("access_token", token);
    localStorage.setItem("auth_user", JSON.stringify(user));
    set({ user, token });
  },

  clearAuth: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("auth_user");
    set({ user: null, token: null });
  },
}));
