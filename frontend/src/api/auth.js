import { apiFetch } from "./client.js";

export const authApi = {
  login: (email, password) =>
    apiFetch("/auth/login", { method: "POST", body: { email, password } }),

  startPasswordRecovery: (email, phone) =>
    apiFetch("/auth/password-recovery/start", {
      method: "POST",
      body: { email, phone },
    }),

  verifyPasswordRecovery: (requestId, code) =>
    apiFetch("/auth/password-recovery/verify", {
      method: "POST",
      body: { requestId, code },
    }),

  resetPasswordRecovery: (requestId, resetToken, newPassword) =>
    apiFetch("/auth/password-recovery/reset", {
      method: "POST",
      body: { requestId, resetToken, newPassword },
    }),

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

  listByRole: (role) =>
    apiFetch(`/auth/users?role=${role}`),

  cancelSubscription: () =>
    apiFetch("/auth/subscription/cancel", { method: "POST" }),

  health: () => apiFetch("/auth/health"),
};