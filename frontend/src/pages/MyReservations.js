import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { authService } from "../services/authService.js";
import { navigate } from "../router.js";
import { gymService } from "../services/gymService.js";

export async function MyReservationsPage() {
  const me = await authService.loadSession().catch(() => authStore.me);
  if (!authStore.token || !me) {
    navigate("/login");
    return "";
  }

  const reservations = (await gymService.listMyReservations().catch(() => []))
    .filter((r) => String(r.status).toLowerCase() !== "cancelled");
  const now = new Date();

  const split = reservations.reduce(
    (acc, r) => {
      const start = new Date(r.starts_at || r.starts_at_ts || r.created_at);
      (start >= now ? acc.upcoming : acc.past).push(r);
      return acc;
    },
    { upcoming: [], past: [] }
  );

  const fmt = (iso) =>
    new Date(iso).toLocaleString("es-ES", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  const renderList = (items) =>
    items.length
      ? items
          .map(
            (r) => `
          <li class="row">
            <div>
              <div style="font-weight:1000;">${r.class_type_name || "Clase"}</div>
              <div class="dim">${fmt(r.starts_at)} · ${r.location || "Centro"}</div>
              ${r.description ? `<div class="dim">${r.description}</div>` : ""}
              <div class="dim">Reserva #${r.reservation_id} · Estado: ${r.status}</div>
            </div>
            <span class="pill">${r.capacity ? `${r.booked_count || 0}/${r.capacity}` : ""}</span>
          </li>`
          )
          .join("")
      : "<li class='row'><span>No hay reservas en esta sección.</span></li>";

  return `
    <div class="screen">
      ${Navbar()}
      <main class="container">
        <section class="hero">
          <div class="card" style="display:flex; flex-direction:column; gap:16px;">
            <div class="kicker">MIS RESERVAS</div>
            <h2 class="h2">${me?.profile?.firstName || me?.name || me?.email}</h2>
            <p class="sub">Tus próximas clases y tu histórico reciente.</p>

            <div class="card" style="background: var(--surface-2); border-color: var(--border); box-shadow:none;">
              <div class="kicker">Próximas</div>
              <ul class="list" style="margin-top:8px;">
                ${renderList(split.upcoming)}
              </ul>
            </div>

            <div class="card" style="background: var(--surface-2); border-color: var(--border); box-shadow:none;">
              <div class="kicker">Anteriores</div>
              <ul class="list" style="margin-top:8px;">
                ${renderList(split.past)}
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}
