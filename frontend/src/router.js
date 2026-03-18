import { authStore } from "./state/authStore.js";

const routes = new Map();

// Rutas que requieren login
const AUTH_REQUIRED_ROUTES = ["/onboarding", "/perfil", "/member", "/mis-reservas", "/trainer", "/admin"];

export function registerRoute(path, handler) {
  routes.set(path, handler);
}

export function navigate(path) {
  location.hash = path.startsWith("#") ? path : `#${path}`;
}

export async function renderRoute() {
  const app = document.querySelector("#app");
  if (!app) return;

  const scrollY = window.scrollY; // guarda el scroll actual

  const fullHash = (location.hash || "#/").slice(1);
  const [path] = fullHash.split("?");

  if (AUTH_REQUIRED_ROUTES.includes(path) && !authStore.token) {
    navigate("/login");
    return;
  }

  const handler = routes.get(path) || routes.get("/404");
  const html = await handler();
  app.innerHTML = html ?? "";

  window.scrollTo(0, scrollY); // restaura el scroll
}

window.addEventListener("hashchange", renderRoute);
window.addEventListener("DOMContentLoaded", renderRoute);
