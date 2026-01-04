import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { navigate } from "../router.js";

export async function TrainerDashboard() {
  if (!authStore.token) navigate("/login");
  if (authStore.role && authStore.role !== "trainer") navigate("/");

  const name = authStore.me?.name || authStore.me?.email || "Entrenador";

  return `
    <!-- Fondo animado -->
    <div class="bg-blobs"></div>

    <!-- Contenido -->
    <div class="screen">
      ${Navbar()}
      <main class="container">
        <section class="hero">
          <div class="card">
            <div class="kicker">PANEL ENTRENADOR</div>
            <h2 class="h2">${name} · turno de hoy ⚡</h2>
            <p class="sub">Pasa lista, marca asistencia y revisa el aforo. (UI lista para enlazar con endpoints.)</p>

            <div class="grid">
              <div class="card" style="grid-column: span 7;">
                <div class="kicker">Clases del día</div>
                <ul class="list">
                  <li class="row">
                    <div>
                      <div style="font-weight:1000;">18:00 · Fuerza & Core</div>
                      <div class="dim">16 plazas · 16 reservas</div>
                    </div>
                    <button class="btn btn-primary" disabled>Pasar lista</button>
                  </li>
                  <li class="row">
                    <div>
                      <div style="font-weight:1000;">19:30 · Mobility Reset</div>
                      <div class="dim">24 plazas · 13 reservas</div>
                    </div>
                    <button class="btn btn-ghost" disabled>Ver</button>
                  </li>
                </ul>
                <div class="footer">Reemplaza los items por datos reales de <code>src/api/gym.js</code>.</div>
              </div>

              <div class="card" style="grid-column: span 5;">
                <div class="kicker">Acciones rápidas</div>
                <div class="stats">
                  <div class="stat">
                    <div class="num">7</div>
                    <div class="lbl">check-ins pendientes</div>
                  </div>
                  <div class="stat">
                    <div class="num">2</div>
                    <div class="lbl">listas de espera</div>
                  </div>
                </div>
                <div class="mtop" style="display:flex; gap:10px; flex-wrap:wrap;">
                  <button class="btn btn-primary" disabled>Escanear QR</button>
                  <button class="btn btn-ghost" disabled>Incidencia</button>
                </div>
              </div>

              <div class="card" style="grid-column: span 12;">
                <div class="kicker">Notas</div>
                <p class="sub" style="margin-top:6px;">
                  Idea: aquí puedes mostrar asistentes por clase, toggles para presente/ausente, y un resumen al finalizar.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}
