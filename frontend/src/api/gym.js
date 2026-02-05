import { apiFetch } from "./client.js";

const buildQuery = (params = {}) => {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return entries.length ? `?${entries.join("&")}` : "";
};

export const gymApi = {
  // Clases
  listClasses: (params = {}) =>
    apiFetch(`/gym/classes${buildQuery(params)}`),

  getClass: (id) => apiFetch(`/gym/classes/${id}`),

  createClass: (payload) =>
    apiFetch("/gym/classes", { method: "POST", body: payload }),

  updateClass: (id, payload) =>
    apiFetch(`/gym/classes/${id}`, { method: "PUT", body: payload }),

  deleteClass: (id) => apiFetch(`/gym/classes/${id}`, { method: "DELETE" }),

  reserveClass: (id) =>
    apiFetch(`/gym/classes/${id}/reserve`, { method: "POST" }),

  cancelReservation: (id) =>
    apiFetch(`/gym/classes/${id}/cancel`, { method: "POST" }),

  listReservations: (id) =>
    apiFetch(`/gym/classes/${id}/reservations`),

  listMyReservations: () =>
    apiFetch("/gym/classes/me/reservations"),

  // Tipos de clase
  listClassTypes: () => apiFetch("/gym/class-types"),

  createClassType: (payload) =>
    apiFetch("/gym/class-types", { method: "POST", body: payload }),
};
