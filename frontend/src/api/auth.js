import { apiFetch } from "./client.js";

export const authApi = {
  login: (email, password) =>
    apiFetch("/auth/login", { method: "POST", body: { email, password } }),

  register: (payload) =>
    apiFetch("/auth/register", { method: "POST", body: payload }),

  me: async () => {
    const res = await apiFetch("/auth/profile");
    return res?.user ?? res;
  },

  logout: () => apiFetch("/auth/logout", { method: "POST" }),

  updateProfile: (payload) =>
    apiFetch("/auth/profile", { method: "PUT", body: payload }),

  createStaff: (payload) =>
    apiFetch("/auth/staff", { method: "POST", body: payload }),

  health: () => apiFetch("/auth/health"),
};
