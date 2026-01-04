import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { navigate } from "../router.js";

export async function MemberDashboard() {
  if (!authStore.token) navigate("/login");
  if (authStore.role && authStore.role !== "member") navigate("/");

  const name = authStore.me?.name || authStore.me?.email || "Socio";

  return `
    <!-- Fondo animado -->
    <div class="bg-blobs"></div>

    <!-- Contenido -->
    <div class="screen">
      ${Navbar()}
      <main class="container">
        <section class="hero">
          <div class="card">
            <div class="kicker">ÁREA SOCIO</div>
            <h2 class="h2">Hola, ${name} 👋</h2>
            <p class="sub">Tu panel rápido: reservas, historial y progreso (UI de ejemplo lista para conectar con el backend).</p>

            <div class="grid">
              <div class="card" style="grid-column: span 6;">
                <div class="kicker">Próxima clase</div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                  <div>
                    <div style="font-weight:1000; font-size:18px;">Fuerza & Core</div>
                    <div class="dim">Hoy · 18:00 · Sala 2</div>
                  </div>
                  <span class="badge">✅ reservada</span>
                </div>
                <div class="mtop" style="display:flex; gap:10px; flex-wrap:wrap;">
                  <button class="btn btn-primary" disabled>Check-in</button>
                  <button class="btn btn-ghost" disabled>Cancelar</button>
                </div>
                <div class="footer">Conecta aquí el endpoint de reservas para activar botones.</div>
              </div>

              <div class="card" style="grid-column: span 6;">
                <div class="kicker">Aforo en tiempo real</div>
                <div class="stats">
                  <div class="stat">
                    <div class="num">63%</div>
                    <div class="lbl">ocupación actual</div>
                  </div>
                  <div class="stat">
                    <div class="num">12</div>
                    <div class="lbl">clases esta semana</div>
                  </div>
                  <div class="stat">
                    <div class="num">4</div>
                    <div class="lbl">reservas activas</div>
                  </div>
                  <div class="stat">
                    <div class="num">9</div>
                    <div class="lbl">asistencias mes</div>
                  </div>
                </div>
              </div>

              <div class="card" style="grid-column: span 12;">
                <div class="kicker">Clases recomendadas</div>
                <ul class="list">
                  <li class="row"><span>🧨 HIIT Neon</span><span class="badge">mañana · 07:30</span></li>
                  <li class="row"><span>🦵 Pierna & Potencia</span><span class="badge">mié · 19:00</span></li>
                  <li class="row"><span>🧘 Mobility Reset</span><span class="badge">vie · 20:00</span></li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}
