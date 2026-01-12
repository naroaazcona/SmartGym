import { apiFetch } from "./client.js";

export const gymApi = {
  createClass: (payload) =>
    apiFetch("/gym/classes", { method: "POST", body: payload }),
};
