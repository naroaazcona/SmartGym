import { trainingApi } from "../api/training.js";

export const trainingService = {
  async getMyRecommendation(params = {}) {
    const res = await trainingApi.getMyRecommendation(params);
    return {
      recommendation: res?.recommendation || null,
      cached: Boolean(res?.cached),
    };
  },
  
  async getSavedRecommendation() {
    const res = await trainingApi.getSavedRecommendation({ _ts: Date.now() });
    return res?.recommendation || null;
  },

  async saveMyRecommendation(payload = {}) {
    const res = await trainingApi.saveMyRecommendation(payload);
    return {
      message: res?.message || "",
      recommendation: res?.recommendation || null,
    };
  },

  async getMyPreferences() {
    const res = await trainingApi.getPreferences();
    return res?.preferences || null;
  },

  async saveMyPreferences(preferences = {}) {
    const res = await trainingApi.savePreferences(preferences);
    return {
      message: res?.message || "",
      preferences: res?.preferences || null,
    };
  },

  async getMyLogs(page = 1, limit = 20) {
    const res = await trainingApi.getMyLogs(page, limit);
    return {
      logs:       res?.logs || [],
      pagination: res?.pagination || null,
    };
  },

  async createLog(payload = {}) {
    const res = await trainingApi.createLog(payload);
    return {
      message: res?.message || "",
      log:     res?.log || null,
    };
  },

  async getCoachMembersOverview(logsLimit = 6) {
    const limitNum = Number(logsLimit);
    const safeLimit = Number.isFinite(limitNum) && limitNum > 0 ? Math.round(limitNum) : 6;
    const res = await trainingApi.getCoachMembersOverview({ logs_limit: safeLimit });
    return {
      members: Array.isArray(res?.members) ? res.members : [],
      generatedAt: res?.generatedAt || null,
    };
  },
};
