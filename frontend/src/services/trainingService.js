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
};
