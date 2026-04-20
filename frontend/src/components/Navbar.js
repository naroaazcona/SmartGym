import { authStore } from "../state/authStore.js";
import { authService } from "../services/authService.js";
import { navigate } from "../router.js";

export function Navbar() {
  const role = authStore.role;
  const isOnline = Boolean(authStore.token);
  const isTrainer = role === "trainer";
  const isAdmin = role === "admin";
  const trainerName = authStore.me?.profile?.firstName || authStore.me?.name || "";
  const trainerNameClean = String(trainerName).trim();
  const trainerStartsWithRole = /^entrenador\b/i.test(trainerNameClean);
  const trainerTabLabel = trainerNameClean
    ? trainerStartsWithRole
      ? trainerNameClean
      : `Entrenador ${trainerNameClean}`
    : "Entrenador";

  // delegacion segura
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
              <span class="name">Smart<span class="accent">Gym</span></span>
            </div>
          </a>

          <div class="navlinks">
            ${!isTrainer && !isAdmin ? `<a class="linkbtn" href="#/">Inicio</a>` : ``}
            ${!isOnline ? `<a class="linkbtn" href="#/login">Acceder</a>` : ``}
            ${role === "member" ? `<a class="linkbtn" href="#/member">Clases</a>` : ``}
            ${role === "member" ? `<a class="linkbtn" href="#/member-ia">Entrenamientos y Dieta</a>` : ``}
            ${role === "member" ? `<a class="linkbtn" href="#/mis-reservas">Mis reservas</a>` : ``}
            ${role === "trainer" ? `<a class="linkbtn" href="#/trainer">${trainerTabLabel}</a>` : ``}
            ${role === "trainer" ? `<a class="linkbtn" href="#/trainer-usuarios">Usuarios</a>` : ``}
            ${role === "admin" ? `<a class="linkbtn" href="#/admin">Admin</a>` : ``}
            ${role === "admin" ? `<a class="linkbtn" href="#/admin-usuarios">Usuarios</a>` : ``}
            ${role === "admin" ? `<a class="linkbtn" href="#/admin-tipos">Tipos clase</a>` : ``}
            ${role === "admin" ? `<a class="linkbtn" href="#/admin-entrenadores">Entrenadores</a>` : ``}
            ${isOnline ? `<button class="linkbtn" id="logout-btn">Salir</button>` : ``}
            ${isOnline && !isTrainer && !isAdmin ? `<a class="avatar-btn" href="#/perfil" title="Mi perfil" aria-label="Mi perfil">&#128100;</a>` : ``}
          </div>
        </div>
      </div>
    </div>
  `;
}
