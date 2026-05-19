import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { authService } from "../services/authService.js";
import { navigate, showToast } from "../router.js";
import { gymService } from "../services/gymService.js";
import { trainingService } from "../services/trainingService.js";
import { formatLogDate, repairText, toLocalDateTimeValue } from "./memberHelpers.js";

export async function MyReservationsPage() {
  if (!authStore.token) {
    navigate("/login");
    return "";
  }

  const me = authStore.me;
  const displayName = me?.profile?.firstName || me?.name || me?.email || "Socio";

  const fmt = (iso) =>
    new Date(iso).toLocaleString("es-ES", {
      weekday: "short", day: "2-digit", month: "short",
      hour: "2-digit", minute: "2-digit",
    });

  const renderList = (items, canCancel = false) =>
    items.length
      ? items.map((r) => `
          <li class="row" style="align-items:center; justify-content:space-between; gap:12px;">
            <div style="flex:1; min-width:0;">
              <div style="font-weight:600;">${repairText(r.class_type_name || "Clase")}</div>
              <div class="dim">${fmt(r.starts_at)} · ${repairText(r.location || "Centro")}</div>
              ${r.description ? `<div class="dim">${repairText(r.description)}</div>` : ""}
              <div class="dim">Reserva #${r.reservation_id} · Estado: ${repairText(r.status)}</div>
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
              <span class="pill">${r.capacity ? `${r.booked_count || 0}/${r.capacity}` : ""}</span>
              ${canCancel ? `<button
                class="btn btn-ghost"
                data-action="cancel-reservation"
                data-class-id="${r.class_id}"
                data-reservation-id="${r.reservation_id}"
                style="font-size:13px; padding:6px 12px; color:#e53e3e; border-color:#e53e3e;"
              >Cancelar</button>` : ""}
            </div>
          </li>`).join("")
      : `<li style="list-style:none; padding:0;">
          <div class="empty-state">
            <div class="empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            </div>
            <p class="empty-title">Sin reservas aquí</p>
            <p class="empty-sub">Explora las clases disponibles y reserva tu próxima sesión.</p>
            <a class="btn btn-primary" href="#/member" style="margin-top:8px; font-size:13px;">Ver clases</a>
          </div>
        </li>`;

  const renderLogs = (logs) =>
    logs.length
      ? `<ul class="list" style="margin:0;">${logs.map((log) => `
          <li class="row" style="align-items:flex-start; justify-content:space-between; gap:12px;">
            <div style="flex:1; min-width:0;">
              <div style="font-weight:600;">${repairText(log.title || "Entrenamiento")}</div>
              <div class="dim">${formatLogDate(log.date || log.createdAt)}</div>
              ${log.notes ? `<div class="dim" style="margin-top:4px;">${repairText(log.notes)}</div>` : ""}
              ${log.description ? `<div class="dim" style="margin-top:4px;">${repairText(log.description)}</div>` : ""}
            </div>
            ${log.duration_min ? `<span class="badge">${log.duration_min} min</span>` : ""}
          </li>`).join("")}</ul>`
      : `<div class="empty-state">
          <p class="empty-title">Sin entrenamientos registrados</p>
          <p class="empty-sub">Guarda una idea rápida o regístralo manualmente.</p>
        </div>`;

  const skeletonRow = `
    <li class="row">
      <div style="display:flex; flex-direction:column; gap:6px;">
        <div style="height:14px; width:160px; border-radius:6px; background:var(--border); animation:pulse 1.4s infinite;"></div>
        <div style="height:12px; width:220px; border-radius:6px; background:var(--border); animation:pulse 1.4s infinite;"></div>
      </div>
    </li>`;

  setTimeout(() => {
    authService.loadSession().catch(() => {});

    const upcomingEl = document.querySelector("#reservas-upcoming");
    const pastEl     = document.querySelector("#reservas-past");
    const logListEl  = document.querySelector("#reservas-log-list");
    const logCountEl = document.querySelector("#reservas-log-count");
    const logMoreBtn = document.querySelector("#reservas-log-more");
    const logFormEl  = document.querySelector("#reservas-log-form");
    const logStatusEl = document.querySelector("#reservas-log-status");

    let currentLogPage = 1;
    let currentLogTotalPages = 1;
    let currentLogTotal = 0;
    let currentLogs = [];

    const setLogStatus = (txt, isError = false) => {
      if (!logStatusEl) return;
      logStatusEl.textContent = txt;
      logStatusEl.style.color = isError ? "#b42318" : "var(--muted)";
    };

    const paintLogs = () => {
      if (logListEl)  logListEl.innerHTML = renderLogs(currentLogs);
      if (logCountEl) logCountEl.textContent = `${currentLogs.length}/${currentLogTotal} entrenamientos`;
      if (logMoreBtn) {
        const hasMore = currentLogPage < currentLogTotalPages;
        logMoreBtn.style.display = hasMore ? "inline-flex" : "none";
        logMoreBtn.disabled = false;
        logMoreBtn.textContent = "Cargar más";
      }
    };

    const loadLogs = async ({ page = 1, append = false } = {}) => {
      try {
        const res = await trainingService.getMyLogs(page, 10);
        const logs = res?.logs || [];
        const pagination = res?.pagination || {};
        currentLogPage = Number(pagination.page || page);
        currentLogTotalPages = Number(pagination.totalPages || 1);
        currentLogTotal = Number(pagination.total || logs.length);
        currentLogs = append ? currentLogs.concat(logs) : logs;
        paintLogs();
        setLogStatus(`Mostrando ${currentLogs.length} de ${currentLogTotal} entrenamientos.`);
      } catch (err) {
        setLogStatus(err.message || "No se pudo cargar el historial.", true);
      }
    };

    const loadReservations = async () => {
      try {
        const reservations = await gymService.listMyReservations().catch(() => []);
        const active = reservations.filter((r) => String(r.status).toLowerCase() !== "cancelled");
        const now = new Date();
        const upcoming = [], past = [];
        for (const r of active) {
          (new Date(r.starts_at || r.created_at) >= now ? upcoming : past).push(r);
        }
        if (upcomingEl) upcomingEl.innerHTML = renderList(upcoming, true);
        if (pastEl)     pastEl.innerHTML     = renderList(past, false);

        upcomingEl?.addEventListener("click", async (e) => {
          const btn = e.target.closest("[data-action='cancel-reservation']");
          if (!btn) return;
          const classId = Number(btn.dataset.classId);
          if (!confirm("¿Seguro que quieres cancelar esta reserva?")) return;
          btn.disabled = true;
          btn.textContent = "Cancelando...";
          try {
            await gymService.cancelReservation(classId);
            await loadReservations();
          } catch (err) {
            btn.disabled = false;
            btn.textContent = "Cancelar";
            alert(err.message || "No se pudo cancelar la reserva.");
          }
        });
      } catch {
        if (upcomingEl) upcomingEl.innerHTML = "<li class='row'><span>Error al cargar.</span></li>";
        if (pastEl)     pastEl.innerHTML     = "<li class='row'><span>Error al cargar.</span></li>";
      }
    };

    // Formulario para registrar entrenamiento manual
    const logTitleEl    = document.querySelector("#reservas-log-title");
    const logDateEl     = document.querySelector("#reservas-log-date");
    const logDurationEl = document.querySelector("#reservas-log-duration");
    const logNotesEl    = document.querySelector("#reservas-log-notes");
    const logSaveBtn    = document.querySelector("#reservas-log-save");

    if (logDateEl && !logDateEl.value) {
      logDateEl.value = toLocalDateTimeValue(new Date());
    }

    logFormEl?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = String(logTitleEl?.value || "").trim();
      if (!title) { setLogStatus("El título es obligatorio.", true); return; }

      const payload = { title };
      const rawDate = String(logDateEl?.value || "").trim();
      if (rawDate) {
        const parsed = new Date(rawDate);
        if (!Number.isNaN(parsed.getTime())) payload.date = parsed.toISOString();
      }
      const dur = Number(logDurationEl?.value || 0);
      if (Number.isFinite(dur) && dur > 0) payload.duration_min = Math.round(dur);
      const notes = String(logNotesEl?.value || "").trim();
      if (notes) payload.notes = notes;

      if (logSaveBtn) { logSaveBtn.disabled = true; logSaveBtn.textContent = "Guardando..."; }
      setLogStatus("Registrando...");
      try {
        await trainingService.createLog(payload);
        logFormEl.reset();
        if (logDateEl) logDateEl.value = toLocalDateTimeValue(new Date());
        await loadLogs({ page: 1 });
        showToast("Entrenamiento registrado.", "success");
      } catch (err) {
        setLogStatus(err.message || "No se pudo registrar.", true);
        showToast(err.message || "Error al registrar.", "error");
      } finally {
        if (logSaveBtn) { logSaveBtn.disabled = false; logSaveBtn.textContent = "Registrar"; }
      }
    });

    logMoreBtn?.addEventListener("click", async () => {
      if (currentLogPage >= currentLogTotalPages) return;
      logMoreBtn.disabled = true;
      logMoreBtn.textContent = "Cargando...";
      await loadLogs({ page: currentLogPage + 1, append: true });
    });

    loadReservations();
    loadLogs({ page: 1 });
  }, 0);

  return `
    <div class="screen">
      ${Navbar()}
      <main class="container">
        <section class="hero">
          <div class="card" style="display:flex; flex-direction:column; gap:16px;">
            <div class="kicker">MIS RESERVAS</div>
            <h2 class="h2">Hola, ${displayName}</h2>
            <p class="sub">Tus próximas clases, historial de reservas y entrenamientos.</p>

            <div class="card" style="background:var(--surface-2); border-color:var(--border); box-shadow:none;">
              <div class="kicker">Próximas</div>
              <ul class="list" style="margin-top:8px;" id="reservas-upcoming">
                ${skeletonRow}${skeletonRow}
              </ul>
            </div>

            <div class="card" style="background:var(--surface-2); border-color:var(--border); box-shadow:none;">
              <div class="kicker">Anteriores</div>
              <ul class="list" style="margin-top:8px;" id="reservas-past">
                ${skeletonRow}${skeletonRow}
              </ul>
            </div>

            <div class="card" style="background:var(--surface-2); border-color:var(--border); box-shadow:none; display:flex; flex-direction:column; gap:14px;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                <div>
                  <div class="kicker">Historial de entrenamientos</div>
                  <div class="dim" id="reservas-log-status">Cargando...</div>
                </div>
                <div class="dim" id="reservas-log-count"></div>
              </div>

              <form id="reservas-log-form" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; align-items:end;">
                <label style="display:flex; flex-direction:column; gap:6px;">
                  <span class="field-label">Entrenamiento</span>
                  <input id="reservas-log-title" type="text" required maxlength="120" placeholder="Ej: Fuerza tren superior" />
                </label>
                <label style="display:flex; flex-direction:column; gap:6px;">
                  <span class="field-label">Fecha y hora</span>
                  <input id="reservas-log-date" type="datetime-local" />
                </label>
                <label style="display:flex; flex-direction:column; gap:6px;">
                  <span class="field-label">Duración (min)</span>
                  <input id="reservas-log-duration" type="number" min="1" max="480" step="1" placeholder="45" />
                </label>
                <label style="display:flex; flex-direction:column; gap:6px; grid-column:1/-1;">
                  <span class="field-label">Notas (opcional)</span>
                  <textarea id="reservas-log-notes" rows="2" maxlength="400" placeholder="Sensaciones, carga usada, etc."></textarea>
                </label>
                <div style="display:flex; justify-content:flex-end; grid-column:1/-1;">
                  <button class="btn btn-primary" id="reservas-log-save" type="submit">Registrar</button>
                </div>
              </form>

              <div id="reservas-log-list">${skeletonRow}</div>

              <div style="display:flex; justify-content:center;">
                <button class="btn btn-ghost" id="reservas-log-more" type="button" style="display:none;">Cargar más</button>
              </div>
            </div>

          </div>
        </section>
      </main>
    </div>
  `;
}
