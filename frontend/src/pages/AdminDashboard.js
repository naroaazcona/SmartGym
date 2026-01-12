import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { authService } from "../services/authService.js";
import { navigate } from "../router.js";

export async function AdminDashboard() {
  const me = await authService.loadSession().catch(() => authStore.me);
  if (!authStore.token || !me) {
    navigate("/login");
    return "";
  }
  if (me.role && me.role !== "admin") {
    navigate("/");
    return "";
  }

  const name = me?.profile?.firstName || me?.name || me?.email || "Admin";

  return `
    <!-- Fondo animado -->
    <div class="bg-blobs"></div>

    <!-- Contenido -->
    <div class="screen">
      ${Navbar()}
      <main class="container">
        <section class="hero">
          <div class="card">
            <div class="kicker">ADMIN CONSOLE</div>
            <h2 class="h2">${name} · control total 🧠</h2>
            <p class="sub">Gestiona usuarios, clases, aforos y métricas. (Maqueta visual: conecta con backend cuando quieras.)</p>

            <div class="grid">
              <div class="card" style="grid-column: span 4;">
                <div class="kicker">Usuarios</div>
                <div class="stat">
                  <div class="num">128</div>
                  <div class="lbl">socios activos</div>
                </div>
                <div class="mtop" style="display:flex; gap:10px; flex-wrap:wrap;">
                  <button class="btn btn-primary" disabled>Alta</button>
                  <button class="btn btn-ghost" disabled>Roles</button>
                </div>
              </div>

              <div class="card" style="grid-column: span 4;">
                <div class="kicker">Clases</div>
                <div class="stat">
                  <div class="num">34</div>
                  <div class="lbl">programadas semana</div>
                </div>
                <div class="mtop" style="display:flex; gap:10px; flex-wrap:wrap;">
                  <button class="btn btn-primary" disabled>Nueva</button>
                  <button class="btn btn-ghost" disabled>Calendario</button>
                </div>
              </div>

              <div class="card" style="grid-column: span 4;">
                <div class="kicker">Alertas</div>
                <ul class="list">
                  <li class="row"><span>⛔ Clase llena (18:00)</span><span class="badge">acción</span></li>
                  <li class="row"><span>⚠️ Incidencias</span><span class="badge">2</span></li>
                </ul>
              </div>

              <div class="card" style="grid-column: span 12;">
                <div class="kicker">Vista rápida</div>
                <ul class="list">
                  <li class="row">
                    <div>
                      <div style="font-weight:1000;">Ocupación por franja</div>
                      <div class="dim">Mañana 41% · Tarde 76% · Noche 58%</div>
                    </div>
                    <span class="badge">📈</span>
                  </li>
                  <li class="row">
                    <div>
                      <div style="font-weight:1000;">Asistencia media</div>
                      <div class="dim">Últimos 7 días: 83%</div>
                    </div>
                    <span class="badge">✅</span>
                  </li>
                  <li class="row">
                    <div>
                      <div style="font-weight:1000;">Lista de espera</div>
                      <div class="dim">Total: 19 personas</div>
                    </div>
                    <span class="badge">⏳</span>
                  </li>
                </ul>
                <div class="footer">
                  Sugerencia: este panel puede consumir endpoints de <code>src/api/gym.js</code> y dibujar tablas/estadísticas.
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}
