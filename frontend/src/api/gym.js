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

  updateReservationStatus: (classId, reservationId, status) =>
    apiFetch(`/gym/classes/${classId}/reservations/${reservationId}/status`, {
      method: "PATCH",
      body: { status },
    }),

  listMyReservations: () =>
    apiFetch("/gym/classes/me/reservations"),

  // Tipos de clase
  listClassTypes: (params = {}) => apiFetch(`/gym/class-types${buildQuery(params)}`),

  createClassType: (payload) =>
    apiFetch("/gym/class-types", { method: "POST", body: payload }),

  updateClassType: (id, payload) =>
    apiFetch(`/gym/class-types/${id}`, { method: "PUT", body: payload }),

  deleteClassType: (id) =>
    apiFetch(`/gym/class-types/${id}`, { method: "DELETE" }),
};
