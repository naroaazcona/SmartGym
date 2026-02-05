import { gymApi } from "../api/gym.js";

const nowIso = () => new Date().toISOString();

export const gymService = {
  async listClasses(params = {}) {
    const query = {
      from: params.from || nowIso(),
      to: params.to || undefined,
    };
    const res = await gymApi.listClasses(query);
    return res?.classes || [];
  },

  async getClass(id) {
    const res = await gymApi.getClass(id);
    return res?.class || res;
  },

  async createClass(payload) {
    return gymApi.createClass(payload);
  },

  async updateClass(id, payload) {
    return gymApi.updateClass(id, payload);
  },

  async deleteClass(id) {
    return gymApi.deleteClass(id);
  },

  async reserveClass(id) {
    return gymApi.reserveClass(id);
  },

  async cancelReservation(id) {
    return gymApi.cancelReservation(id);
  },

  async listReservations(id) {
    const res = await gymApi.listReservations(id);
    return res?.reservations || res || [];
  },

  async listMyReservations() {
    const res = await gymApi.listMyReservations();
    return res?.reservations || res || [];
  },

  async listClassTypes() {
    const res = await gymApi.listClassTypes();
    return res?.classTypes || res || [];
  },

  async createClassType(payload) {
    return gymApi.createClassType(payload);
  },
};
