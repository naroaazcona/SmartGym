import { apiFetch } from "./client.js";

const buildQuery = (params = {}) => {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return entries.length ? `?${entries.join("&")}` : "";
};

export const trainingApi = {
  getMyRecommendation: (params = {}) =>
    apiFetch(`/training/recommendations/me/generate${buildQuery(params)}`),
  getSavedRecommendation: (params = {}) =>
    apiFetch(`/training/recommendations/me/saved${buildQuery(params)}`),
  saveMyRecommendation: (payload = {}) =>
    apiFetch("/training/recommendations/me", { method: "POST", body: payload }),
  savePreferences: (preferences = {}) =>
    apiFetch("/training/preferences/me", { method: "POST", body: { preferences } }),
  getPreferences: () =>
    apiFetch("/training/preferences/me"),
  getMyLogs: (page = 1, limit = 20) =>
    apiFetch(`/training/logs/me?page=${page}&limit=${limit}`),
  createLog: (payload = {}) =>
    apiFetch("/training/logs", { method: "POST", body: payload }),
  getCoachMembersOverview: (params = {}) =>
    apiFetch(`/training/coach/members-overview${buildQuery(params)}`),
};
