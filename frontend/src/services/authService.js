import { authApi } from "../api/auth.js";
import { authStore } from "../state/authStore.js";

function mergeProfile(profile) {
  if (!profile) return authStore.me || null;
  const current = authStore.me || {};
  return {
    ...current,
    profile: {
      ...(current.profile || {}),
      ...profile,
    },
  };
}

export const authService = {
  async loadSession() {
    if (!authStore.token) return null;
    try {
      const me = await authApi.me();
      authStore.setMe(me);
      return me;
    } catch {
      // Si la API falla temporalmente (500/red), conservamos la sesión local.
      // En errores reales de auth (401/403), apiFetch ya limpia la sesión.
      return authStore.token ? authStore.me : null;
    }
  },

  async login(email, password) {
    const res = await authApi.login(email, password);
    const token = res?.token || res?.accessToken;
    if (!token) throw new Error("Token no recibido del servicio de autenticacion");

    authStore.setToken(token);
    const me = res?.user || (await authApi.me());
    authStore.setMe(me);
    return me;
  },

  async startPasswordRecovery(email, phone) {
    return authApi.startPasswordRecovery(email, phone);
  },

  async verifyPasswordRecovery(requestId, code) {
    return authApi.verifyPasswordRecovery(requestId, code);
  },

  async resetPasswordRecovery(requestId, resetToken, newPassword) {
    return authApi.resetPasswordRecovery(requestId, resetToken, newPassword);
  },

  async register(payload) {
    const res = await authApi.register(payload);
    const token = res?.token || res?.accessToken || null;
    if (token) authStore.setToken(token);

    const me = res?.user || (token ? await authApi.me() : null);
    if (me) authStore.setMe(me);

    return { ...res, user: me || res?.user || null };
  },

  async logout() {
    try {
      await authApi.logout();
    } catch {
      /* no-op: aunque falle, limpiamos la sesion local */
    }
    authStore.logout();
  },

  async updateProfile(payload) {
    const res = await authApi.updateProfile(payload);
    const me = mergeProfile(res?.profile || res?.user?.profile || res);
    if (me) authStore.setMe(me);
    return me;
  },

  async createStaff(payload) {
    return authApi.createStaff(payload);
  },

  async listByRole(role) {
    const res = await authApi.listByRole(role);
    return res?.users || [];
  },

  async cancelSubscription() {
    return authApi.cancelSubscription();
  },

  async health() {
    return authApi.health();
  },
};