const routes = new Map();

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

  const path = (location.hash || "#/").slice(1);
  const handler = routes.get(path) || routes.get("/404");

  const html = await handler();
  app.innerHTML = html ?? "";

  window.scrollTo(0, scrollY); // restaura el scroll
}


window.addEventListener("hashchange", renderRoute);
window.addEventListener("DOMContentLoaded", renderRoute);
