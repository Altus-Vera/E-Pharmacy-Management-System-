import { create } from "zustand";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  setAuth: (user: User) => void;
  clearAuth: () => void;
}

function loadUser(): User | null {
  try { return JSON.parse(sessionStorage.getItem("auth_user") ?? "null"); } catch { return null; }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: loadUser(),

  setAuth: (user) => {
    sessionStorage.setItem("auth_user", JSON.stringify(user));
    set({ user });
  },

  clearAuth: () => {
    sessionStorage.removeItem("auth_user");
    set({ user: null });
  },
}));
