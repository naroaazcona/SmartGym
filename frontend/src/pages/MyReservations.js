import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { authService } from "../services/authService.js";
import { navigate } from "../router.js";
import { gymService } from "../services/gymService.js";
import { trainingService } from "../services/trainingService.js";

export async function MyReservationsPage() {
  if (!authStore.token) {
    navigate("/login");
    return "";
  }

  const me = authStore.me;
  const displayName = me?.profile?.firstName || me?.name || me?.email || "Socio";

  const fmt = (iso) =>
    new Date(iso).toLocaleString("es-ES", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  const fmtDate = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleString("es-ES", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const renderList = (items) =>
    items.length
      ? items.map((r) => `
          <li class="row">
            <div>
              <div style="font-weight:1000;">${r.class_type_name || "Clase"}</div>
              <div class="dim">${fmt(r.starts_at)} · ${r.location || "Centro"}</div>
              ${r.description ? `<div class="dim">${r.description}</div>` : ""}
              <div class="dim">Reserva #${r.reservation_id} · Estado: ${r.status}</div>
            </div>
            <span class="pill">${r.capacity ? `${r.booked_count || 0}/${r.capacity}` : ""}</span>
          </li>`).join("")
      : `<li style="list-style:none; padding:0;">
          <div class="empty-state">
            <div class="empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff5b2e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            </div>
            <p class="empty-title">Sin reservas aquí</p>
            <p class="empty-sub">Explora las clases disponibles y reserva tu próxima sesión.</p>
            <a class="btn btn-primary" href="#/member" style="margin-top:8px; font-size:13px;">Ver clases</a>
          </div>
        </li>`;

  const renderSavedPlan = (doc) => {
    if (!doc) {
      return `
        <div style="padding:20px; text-align:center; color:var(--muted);">
          <div style="font-size:32px; margin-bottom:8px;">🤖</div>
          <div style="font-weight:700; margin-bottom:4px;">Sin plan guardado</div>
          <p class="sub" style="margin:0;">Genera y guarda un plan desde el <a href="#/member" style="color:var(--accent); font-weight:700;">Dashboard</a>.</p>
        </div>`;
    }

    const rec = doc.recommendation || doc;
    const sessions = Array.isArray(rec.split) ? rec.split : [];
    const notes = rec.notes || "";
    const savedAt = doc.savedAt || doc.createdAt || "";
    const level = doc.level || doc.profile?.experience_level || "";
    const goal = doc.profile?.goal || "";

    const dayCards = sessions.map((session) => {
      const exercises = Array.isArray(session.exercises) ? session.exercises : [];
      return `
        <div style="padding:14px; border-radius:12px; background:var(--surface-1, #fff); border:1px solid var(--border); display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <div>
              <div class="kicker">${session.day || "Día"}</div>
              <div style="font-weight:900; font-size:15px;">${session.focus || "Sesión"}</div>
            </div>
            ${session.duration_min ? `<span class="badge green">${session.duration_min} min</span>` : ""}
          </div>
          ${exercises.length ? `
            <ul style="margin:0; padding-left:18px; display:flex; flex-direction:column; gap:4px;">
              ${exercises.map(ex => `<li class="dim" style="font-size:13px;">${ex}</li>`).join("")}
            </ul>` : ""}
        </div>`;
    }).join("");

    return `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
          ${level ? `<span class="badge">${level}</span>` : ""}
          ${goal ? `<span class="badge blue">${goal}</span>` : ""}
          ${savedAt ? `<span class="dim" style="font-size:12px;">Guardado: ${fmtDate(savedAt)}</span>` : ""}
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:10px;">
          ${dayCards || "<p class='sub'>Sin sesiones en este plan.</p>"}
        </div>
        ${notes ? `<p class="sub" style="margin:0; padding:12px; background:rgba(40,205,180,.08); border-radius:8px; border-left:3px solid rgba(40,205,180,.6);">💡 ${notes}</p>` : ""}
        <a class="btn btn-ghost" href="#/member" style="align-self:flex-start;">Actualizar plan IA →</a>
      </div>`;
  };

  const skeletonRow = `
    <li class="row">
      <div style="display:flex; flex-direction:column; gap:6px;">
        <div style="height:14px; width:160px; border-radius:6px; background:var(--border); animation:pulse 1.4s infinite;"></div>
        <div style="height:12px; width:220px; border-radius:6px; background:var(--border); animation:pulse 1.4s infinite;"></div>
      </div>
    </li>`;

  // ── Devolvemos el HTML del esqueleto INMEDIATAMENTE ──
  setTimeout(() => {
    authService.loadSession()
      .then((freshMe) => {
        const titleEl = document.querySelector("#mis-reservas-user");
        if (!titleEl || !freshMe) return;
        titleEl.textContent = freshMe?.profile?.firstName || freshMe?.name || freshMe?.email || "Socio";
      })
      .catch(() => {});

    const upcomingEl  = document.querySelector("#reservas-upcoming");
    const pastEl      = document.querySelector("#reservas-past");
    const planEl      = document.querySelector("#reservas-plan");

    const loadData = async () => {
      try {
        const [reservations, savedPlan] = await Promise.all([
          gymService.listMyReservations().catch(() => []),
          trainingService.getSavedRecommendation().catch(() => null),
        ]);

        const active = reservations.filter(
          (r) => String(r.status).toLowerCase() !== "cancelled"
        );
        const now = new Date();
        const upcoming = [];
        const past = [];
        for (const r of active) {
          const start = new Date(r.starts_at || r.starts_at_ts || r.created_at);
          (start >= now ? upcoming : past).push(r);
        }

        if (upcomingEl) upcomingEl.innerHTML = renderList(upcoming);
        if (pastEl)     pastEl.innerHTML     = renderList(past);
        if (planEl)     planEl.innerHTML     = renderSavedPlan(savedPlan);
      } catch (err) {
        console.error("Error cargando reservas:", err);
        if (upcomingEl) upcomingEl.innerHTML = "<li class='row'><span>Error al cargar.</span></li>";
        if (pastEl)     pastEl.innerHTML     = "<li class='row'><span>Error al cargar.</span></li>";
      }
    };

    const refreshSavedPlan = async () => {
      if (!planEl) return;
      const savedPlan = await trainingService.getSavedRecommendation().catch(() => null);
      planEl.innerHTML = renderSavedPlan(savedPlan);
    };

    const onPlanSaved = () => {
      refreshSavedPlan();
    };

    const onStorage = (event) => {
      if (event.key === "smartgym_saved_recommendation_updated_at") {
        refreshSavedPlan();
      }
    };

    window.addEventListener("smartgym:recommendation-saved", onPlanSaved);
    window.addEventListener("storage", onStorage);

    const cleanup = () => {
      window.removeEventListener("smartgym:recommendation-saved", onPlanSaved);
      window.removeEventListener("storage", onStorage);
    };

    window.addEventListener("hashchange", cleanup, { once: true });
    loadData();
  }, 0);

  return `
    <div class="screen">
      ${Navbar()}
      <main class="container">
        <section class="hero">
          <div class="card" style="display:flex; flex-direction:column; gap:16px;">
            <div class="kicker">MIS RESERVAS</div>
            <h2 class="h2" id="mis-reservas-user">${displayName}</h2>
            <p class="sub">Tus próximas clases, tu histórico y tu plan de entrenamiento guardado.</p>

            <div class="card" style="background: var(--surface-2); border-color: var(--border); box-shadow:none;">
              <div class="kicker">Próximas</div>
              <ul class="list" style="margin-top:8px;" id="reservas-upcoming">
                ${skeletonRow}${skeletonRow}
              </ul>
            </div>

            <div class="card" style="background: var(--surface-2); border-color: var(--border); box-shadow:none;">
              <div class="kicker">Anteriores</div>
              <ul class="list" style="margin-top:8px;" id="reservas-past">
                ${skeletonRow}${skeletonRow}
              </ul>
            </div>

            <div class="card" style="background: var(--surface-2); border-color: var(--border); box-shadow:none;">
              <div style="margin-bottom:12px;">
                <div class="kicker">Plan de entrenamiento IA</div>
                <div class="dim" style="font-size:13px;">Tu último plan guardado desde el Dashboard</div>
              </div>
              <div id="reservas-plan">
                <div style="padding:20px; text-align:center; color:var(--muted);">
                  <div style="height:12px; width:180px; border-radius:6px; background:var(--border); animation:pulse 1.4s infinite; margin:0 auto;"></div>
                </div>
              </div>
            </div>

          </div>
        </section>
      </main>
    </div>
  `;
}