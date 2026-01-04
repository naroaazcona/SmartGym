import { CONFIG } from "../config.js";
import { authStore } from "../state/authStore.js";

export async function apiFetch(path, { method="GET", headers={}, body } = {}) {
  const url = `${CONFIG.API_BASE}${path}`;

  const finalHeaders = { ...headers };
  if (!(body instanceof FormData)) finalHeaders["Content-Type"] = "application/json";
  if (authStore.token) finalHeaders["Authorization"] = `Bearer ${authStore.token}`;

  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body
      ? (body instanceof FormData ? body : JSON.stringify(body))
      : undefined,
  });

  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return { raw: text }; } })() : null;

  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Error ${res.status}`);
  }
  return data;
}
