import { CONFIG } from "../config.js";
import { authStore } from "../state/authStore.js";
import { navigate } from "../router.js";

export async function apiFetch(path, { method = "GET", headers = {}, body } = {}) {
  const url = `${CONFIG.API_BASE}${path}`;

  const finalHeaders = { ...headers };
  if (!(body instanceof FormData)) finalHeaders["Content-Type"] = "application/json";
  if (authStore.token) finalHeaders["Authorization"] = `Bearer ${authStore.token}`;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    });
  } catch (networkErr) {
    // Error de red (servidor caído, sin conexión, CORS)
    throw new TypeError("No hay conexión con el servidor. Comprueba que el servicio está activo.");
  }

  const text = await res.text();
  const data = text
    ? (() => {
        try {
          return JSON.parse(text);
        } catch {
          return { raw: text };
        }
      })()
    : null;

  // Solo invalidamos sesión automáticamente cuando el backend indica token inválido.
  if (res.status === 401 || res.status === 403) {
    const authMessage = String(data?.message || data?.error || "").toLowerCase();
    const hasTokenError =
      authMessage.includes("token") ||
      authMessage.includes("sesion") ||
      authMessage.includes("sesión") ||
      authMessage.includes("expirad");

    if (hasTokenError) {
      authStore.logout();
      navigate("/login");
      throw new Error("Tu sesión ha expirado. Por favor inicia sesión de nuevo.");
    }
  }

  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Error ${res.status}`);
  }

  return data;
}