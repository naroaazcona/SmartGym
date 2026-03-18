import { trainingApi } from "../api/training.js";

export const trainingService = {
  async getMyRecommendation(params = {}) {
    const res = await trainingApi.getMyRecommendation(params);
    return {
      recommendation: res?.recommendation || null,
      cached: Boolean(res?.cached),
    };
  },
  async saveMyRecommendation(payload = {}) {
    const res = await trainingApi.saveMyRecommendation(payload);
    return {
      message: res?.message || "",
      recommendation: res?.recommendation || null,
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
};
