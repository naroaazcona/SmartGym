import { authStore } from "./state/authStore.js";

const routes = new Map();

// Rutas que requieren login
const AUTH_REQUIRED_ROUTES = [
  "/onboarding",
  "/perfil",
  "/member",
  "/member-ia",
  "/mis-reservas",
  "/trainer",
  "/trainer-usuarios",
  "/admin",
  "/admin-usuarios",
  "/admin-tipos",
  "/admin-entrenadores",
];

export function registerRoute(path, handler) {
  routes.set(path, handler);
}

export function navigate(path) {
  location.hash = path.startsWith("#") ? path : `#${path}`;
}

/* ── Network error banner ── */
function ensureNetBanner() {
  if (document.getElementById("sg-net-banner")) return;
  const el = document.createElement("div");
  el.id = "sg-net-banner";
  el.innerHTML = `
    <span class="net-dot"></span>
    <span id="sg-net-msg">Sin conexión con el servidor</span>
    <button id="sg-net-retry">Reintentar</button>
  `;
  document.body.appendChild(el);
  document.getElementById("sg-net-retry").addEventListener("click", () => {
    hideNetBanner();
    renderRoute();
  });
}
function showNetBanner(msg) {
  ensureNetBanner();
  document.getElementById("sg-net-msg").textContent = msg || "Sin conexión con el servidor";
  document.getElementById("sg-net-banner").classList.add("show");
}
function hideNetBanner() {
  document.getElementById("sg-net-banner")?.classList.remove("show");
}

/* ── Toast helper (exportado para usar en páginas) ── */
function ensureToastStack() {
  if (document.getElementById("sg-toast-stack")) return;
  const el = document.createElement("div");
  el.id = "sg-toast-stack";
  document.body.appendChild(el);
}
export function showToast(msg, type = "info", duration = 3500) {
  ensureToastStack();
  const toast = document.createElement("div");
  toast.className = `sg-toast sg-toast-${type}`;
  toast.textContent = msg;
  document.getElementById("sg-toast-stack").appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("visible"));
  });
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ── Skeleton helpers (exportado para usar en páginas) ── */
export function skeletonCards(count = 3) {
  return Array.from({ length: count }, () => `
    <div class="skeleton-card">
      <div class="skeleton skeleton-thumb"></div>
      <div class="skeleton skeleton-badge"></div>
      <div class="skeleton skeleton-line med"></div>
      <div class="skeleton skeleton-line short"></div>
      <div class="skeleton skeleton-line full"></div>
    </div>
  `).join("");
}

export async function renderRoute() {
  const app = document.querySelector("#app");
  if (!app) return;

  const scrollY = window.scrollY;
  const fullHash = (location.hash || "#/").slice(1);
  const [path] = fullHash.split("?");

  if (AUTH_REQUIRED_ROUTES.includes(path) && !authStore.token) {
    navigate("/login");
    return;
  }

  const handler = routes.get(path) || routes.get("/404");

  try {
    const html = await handler();
    app.innerHTML = html ?? "";
    // Animación de entrada
    const screen = app.querySelector(".screen");
    if (screen) {
      screen.classList.add("page-enter");
    }
    hideNetBanner();
  } catch (err) {
    const isNetwork = err instanceof TypeError && /fetch|network|failed/i.test(err.message);
    if (isNetwork) {
      showNetBanner("Sin conexión con el servidor");
    } else {
      showNetBanner(err?.message || "Error al cargar la página");
    }
  }

  window.scrollTo(0, scrollY);
}

window.addEventListener("hashchange", renderRoute);
window.addEventListener("DOMContentLoaded", renderRoute);
