import { authStore } from "../state/authStore.js";
import { authService } from "../services/authService.js";
import { navigate } from "../router.js";

export function Navbar() {
  const role = authStore.role;
  const isOnline = Boolean(authStore.token);

  const session = isOnline ? "Online" : "Offline";
  const dot = isOnline
    ? `<span class="dot"></span>`
    : `<span class="dot off"></span>`;

  const roleLabel = isOnline ? `<b>${role ?? "member"}</b>` : "—";

  // delegación segura
  setTimeout(() => {
    document.querySelector(".navbar")?.addEventListener("click", async (e) => {
      if (e.target?.id === "logout-btn") {
        await authService.logout();
        navigate("/login");
      }
    });
  }, 0);

  return `
    <div class="navbar-wrap">
      <div class="container">
        <div class="navbar">
          <div class="brand">
            <div class="logo">SG</div>
            <div class="brand-title">
              <span class="name">SmartGym</span>
            </div>
          </div>

          <div class="navlinks">
            <span class="pill">${dot} ${session} · ${roleLabel}</span>
            <a class="linkbtn" href="#/">Inicio</a>
            ${!isOnline ? `<a class="linkbtn" href="#/login">Acceder</a>` : ``}
            ${role === "member" ? `<a class="linkbtn" href="#/member">Área socio</a>` : ``}
            ${role === "trainer" ? `<a class="linkbtn" href="#/trainer">Entrenador</a>` : ``}
            ${role === "admin" ? `<a class="linkbtn" href="#/admin">Admin</a>` : ``}
            ${isOnline ? `<button class="linkbtn" id="logout-btn">Salir</button>` : ``}
          </div>
        </div>
      </div>
    </div>
  `;
}
