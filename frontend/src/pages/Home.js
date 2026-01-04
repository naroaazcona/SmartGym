import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { navigate } from "../router.js";

export async function HomePage() {
  setTimeout(() => {
    document.querySelectorAll(".js-go-login").forEach((btn) => {
      btn.addEventListener("click", () => navigate("/login"));
    });
    document.querySelectorAll(".js-go-area").forEach((btn) => {
      btn.addEventListener("click", () => {
        const r = authStore.role;
        if (r === "admin") navigate("/admin");
        else if (r === "trainer") navigate("/trainer");
        else if (r === "member") navigate("/member");
        else navigate("/login");
      });
    });
  }, 0);

  const role = authStore.role ?? "visitante";
  const isOnline = Boolean(authStore.token);
  const greet = authStore.token
    ? `Listo para seguir, <b>${role}</b>.`
    : `Siente el control total del box en una sola vista.`;

  const statusChip = isOnline
    ? `<span class="dot"></span> Online | ${role}`
    : `<span class="dot off"></span> Modo demo`;

  return `
    <div class="bg-blobs"></div>

    <div class="screen home-screen">
      ${Navbar()}

      <main class="home-main">
        <section class="hero-block container">
          <div class="hero-copy">
            <div class="kicker">SmartGym OS</div>
            <h1 class="h1">
              Controla tu box como un <span class="grad">cockpit</span>
            </h1>
            <p class="sub lead">
              Agenda, reservas y aforo en vivo en un mismo lienzo. Cambia de modo recepcion a modo sala sin perder el pulso.
            </p>

            <div class="cta-row">
              <button class="btn btn-primary js-go-area">Entrar ahora</button>
              <button class="btn btn-ghost js-go-login">Acceso seguro</button>
              <span class="pill status-pill">${statusChip}</span>
            </div>

            <div class="metric-row">
              <div class="metric-card">
                <div class="label">Reservas hoy</div>
                <div class="value">126</div>
                <div class="hint">+18 vs ayer</div>
              </div>
              <div class="metric-card">
                <div class="label">Aforo en vivo</div>
                <div class="value">87%</div>
                <div class="hint">Salas en verde</div>
              </div>
              <div class="metric-card">
                <div class="label">Roles activos</div>
                <div class="value">Admin / Coach / Socio</div>
                <div class="hint">UI segun permiso</div>
              </div>
            </div>
          </div>

          <div class="hero-visual">
            <div class="card card-holo">
              <div class="eyebrow">Pasos rapidos</div>
              <ul class="flow">
                <li class="flow-row">Check-in con QR <span>00:08s</span></li>
                <li class="flow-row">Abrir lista de espera <span>Auto</span></li>
                <li class="flow-row">Notificar cancelaciones <span>Push</span></li>
              </ul>

              <div class="live-card">
                <span class="badge live">Live</span>
                <div class="live-track">07:30 HIIT Neon <span>20/24</span></div>
                <div class="live-track">18:00 Fuerza & Core <span>16/16</span></div>
                <div class="live-track">19:30 Mobility Reset <span>13/24</span></div>
              </div>

              <div class="callout">
                <div class="label">Mensaje</div>
                <p class="sub">${greet}</p>
              </div>
            </div>
          </div>
        </section>

        <section class="panel-grid container">
          <div class="panel-card">
            <div class="label">Roles y paneles</div>
            <h3>Camino claro por rol</h3>
            <p class="sub">
              Admin, coach o socio con rutas enfocadas y acciones directas.
            </p>
            <div class="chip-row">
              <span class="chip">Aforo live</span>
              <span class="chip">Reservas 1 click</span>
              <span class="chip">Metricas claras</span>
            </div>
          </div>

          <div class="panel-card">
            <div class="label">Modo energia</div>
            <h3>Acciones en serie</h3>
            <p class="sub">
              Marca asistencia, ajusta plazas y lanza avisos sin salir del tablero.
            </p>
            <ul class="mini-list">
              <li>Cancelaciones limpias</li>
              <li>Listas de espera ordenadas</li>
              <li>Entradas rapidas con QR</li>
            </ul>
          </div>

          <div class="panel-card spotlight">
            <div class="label">Explora</div>
            <h3>Prueba el dashboard</h3>
            <p class="sub">
              Si ya estas logeado entra directo; si no, navega en modo demo y siente el flujo.
            </p>
            <div class="cta-inline">
              <button class="btn btn-primary js-go-area">Ir a mi panel</button>
              <button class="btn btn-ghost js-go-login">Login</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}
