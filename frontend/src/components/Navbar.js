import { authStore } from "../state/authStore.js";
import { authService } from "../services/authService.js";
import { navigate } from "../router.js";

export function Navbar() {
  const role = authStore.role;
  const isOnline = Boolean(authStore.token);

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
          <a class="brand" href="#/">
            <div class="logo">SG</div>
            <div class="brand-title">
              <span class="name">SmartGym</span>
            </div>
          </a>

          <div class="navlinks">
            <a class="linkbtn" href="#/">Inicio</a>
            ${!isOnline ? `<a class="linkbtn" href="#/login">Acceder</a>` : ``}
            ${role === "member" ? `<a class="linkbtn" href="#/member">Reservas</a>` : ``}
            ${role === "member" ? `<a class="linkbtn" href="#/mis-reservas">Mis reservas</a>` : ``}
            ${role === "trainer" ? `<a class="linkbtn" href="#/trainer">Entrenador</a>` : ``}
            ${role === "admin" ? `<a class="linkbtn" href="#/admin">Admin</a>` : ``}
            ${isOnline ? `<button class="linkbtn" id="logout-btn">Salir</button>` : ``}
            ${isOnline ? `<a class="avatar-btn" href="#/perfil" title="Mi perfil" aria-label="Mi perfil">&#128100;</a>` : ``}
          </div>
        </div>
      </div>
    </div>
  `;
}
