import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { authService } from "../services/authService.js";
import { navigate } from "../router.js";

export async function MemberDashboard() {
  const me = await authService.loadSession().catch(() => authStore.me);
  if (!authStore.token || !me) {
    navigate("/login");
    return "";
  }
  if (me.role && me.role !== "member") {
    navigate("/");
    return "";
  }

  const name =
    me?.profile?.firstName ||
    me?.firstName ||
    me?.name ||
    me?.email ||
    "Socio";

  const featuredClasses = [
    {
      title: "Fuerza & Core",
      time: "Hoy · 18:00 · Sala 2",
      capacity: 20,
      booked: 18,
      description: "Circuito full-body con barra y trabajo de core para estabilidad.",
    },
    {
      title: "HIIT Neon",
      time: "Hoy · 19:00 · Zona cardio",
      capacity: 16,
      booked: 15,
      description: "Intervalos cortos y explosivos. Ideal para quemar y subir pulsaciones.",
    },
    {
      title: "Mobility Reset",
      time: "Mañana · 08:00 · Sala 1",
      capacity: 14,
      booked: 10,
      description: "Movilidad articular y estiramientos guiados para desbloquear tu semana.",
    },
  ];

  const classCards = featuredClasses
    .map((item) => {
      const occupancy = Math.min(
        100,
        Math.round((item.booked / item.capacity) * 100)
      );
      const full = item.booked >= item.capacity;
      const statusLabel = full
        ? "Completa"
        : `Quedan ${item.capacity - item.booked} plazas`;
      const statusClass = full ? "badge red" : "badge green";

      return `
        <div class="card" style="display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
            <div>
              <div style="font-weight:1000; font-size:18px;">${item.title}</div>
              <div class="dim">${item.time}</div>
            </div>
            <span class="${statusClass}">${statusLabel}</span>
          </div>
          <p class="sub" style="margin:4px 0;">${item.description}</p>
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <span class="pill">
              <span class="dot ${full ? "off" : ""}"></span>
              Aforo ${item.booked}/${item.capacity} (${occupancy}%)
            </span>
            <button class="btn btn-primary" disabled>Reservar</button>
            <button class="btn btn-ghost" disabled>Detalles</button>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="bg-blobs"></div>

    <div class="screen">
      ${Navbar()}
      <main class="container">
        <section class="hero">
          <div class="card" style="display:flex; flex-direction:column; gap:16px;">
            <div class="kicker">ÁREA SOCIO</div>
            <h2 class="h2">Hola, ${name}</h2>
            <p class="sub">Tu resumen rápido de clases, aforo y acciones directas.</p>

            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:12px;">
              <div class="card" style="background: var(--surface-2); border-color: var(--border); box-shadow:none;">
                <div class="kicker">Próxima clase</div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                  <div>
                    <div style="font-weight:1000; font-size:18px;">Fuerza & Core</div>
                    <div class="dim">Hoy · 18:00 · Sala 2</div>
                  </div>
                  <span class="badge">Reservada</span>
                </div>
                <div class="mtop" style="display:flex; gap:10px; flex-wrap:wrap;">
                  <button class="btn btn-primary" disabled>Check-in</button>
                  <button class="btn btn-ghost" disabled>Cancelar</button>
                </div>
                <div class="footer">Conecta aquí el endpoint de reservas para activar botones.</div>
              </div>

              <div class="card" style="background: var(--surface-2); border-color: var(--border); box-shadow:none;">
                <div class="kicker">Aforo en vivo</div>
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
            </div>

            <div class="card" style="background: var(--surface-2); border-color: var(--border); box-shadow:none;">
              <div class="kicker">Clases destacadas</div>
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:12px; margin-top:10px;">
                ${classCards}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}
