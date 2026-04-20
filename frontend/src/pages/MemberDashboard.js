import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { authService } from "../services/authService.js";
import { navigate, showToast } from "../router.js";
import { gymService } from "../services/gymService.js";
import {
  asDate,
  escapeHtml,
  formatClassDate,
  getDemandMeta,
  isToday,
  isWithinNextDays,
  normalizeText,
} from "./memberHelpers.js";

const heroImages = {
  crossfit: "https://images.unsplash.com/photo-1558611848-73f7eb4001a1?auto=format&fit=crop&w=1400&q=80",
  hiit: "https://images.unsplash.com/photo-1554284126-aa88f22d8b74?auto=format&fit=crop&w=1400&q=80",
  mobility: "https://images.unsplash.com/photo-1546484959-f9a9c6c4b4c1?auto=format&fit=crop&w=1400&q=80",
  spinning: "https://images.unsplash.com/photo-1546484475-7e0b1cd5a33e?auto=format&fit=crop&w=1400&q=80",
  cycling: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=1400&q=80",
  strength: "https://images.unsplash.com/photo-1483721310020-03333e577078?auto=format&fit=crop&w=1400&q=80",
};

const imgForType = (type) => heroImages[normalizeText(type)] || heroImages.strength;

const renderEmptyState = () => `
  <div class="empty-state" style="grid-column:1/-1">
    <div class="empty-icon">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff5b2e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/><path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/><path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z"/><path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"/></svg>
    </div>
    <p class="empty-title">No hay clases disponibles</p>
    <p class="empty-sub">El equipo no ha programado clases próximas. Vuelve más tarde o contacta con recepción.</p>
  </div>
`;

const renderClassSkeleton = () =>
  Array.from({ length: 3 }, () => `
    <div class="skeleton-card">
      <div class="skeleton skeleton-thumb"></div>
      <div class="skeleton skeleton-badge"></div>
      <div class="skeleton skeleton-line med"></div>
      <div class="skeleton skeleton-line short"></div>
      <div class="skeleton skeleton-line full"></div>
    </div>`).join("");

const sortClassesByDate = (items = []) =>
  items
    .slice()
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

const ACTIVE_RESERVATION_STATUSES = new Set(["booked", "present", "late", "absent", "no_show"]);

const getActiveReservationClassIds = (reservations = []) =>
  new Set(
    (Array.isArray(reservations) ? reservations : [])
      .filter((item) => ACTIVE_RESERVATION_STATUSES.has(normalizeText(item?.status)))
      .map((item) => Number(item?.class_id ?? item?.classId))
      .filter((id) => Number.isFinite(id) && id > 0)
  );

const renderMemberClassCard = (cls, options = {}) => {
  const isReserved = Boolean(options?.isReserved);
  const feedback = options?.feedback || null;
  const capacity = Number(cls.capacity || 0);
  const booked = Number(cls.booked_count || 0);
  const free = Math.max(capacity - booked, 0);
  const full = capacity > 0 && booked >= capacity;
  const occupancy = capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;
  const demand = getDemandMeta(occupancy);
  const progressColor =
    occupancy >= 85 ? "rgba(255,122,89,.92)" : occupancy >= 60 ? "rgba(253,188,46,.92)" : "rgba(40,205,180,.95)";
  const feedbackColor = feedback?.type === "error" ? "#b42318" : "#087443";

  return `
    <article class="class-card member-class-card ${demand.className}" data-class-id="${cls.id}" data-demand="${demand.key}" style="min-height:250px;">
      <div class="backdrop" style="background-image:url('${imgForType(cls.class_type_name)}')"></div>
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
        <div class="tag ${full ? "red" : "green"}">${escapeHtml(cls.class_type_name || "Clase")}</div>
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <span class="badge">${occupancy}% aforo</span>
          ${isReserved ? `<span class="badge green">Reservada</span>` : ""}
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
        <div>
          <div style="font-weight:1000; font-size:18px;">${escapeHtml(formatClassDate(cls.starts_at))}</div>
          <div class="dim">${escapeHtml(cls.location || "Centro")} · ${
    cls.instructor_name ? `Coach ${escapeHtml(cls.instructor_name)}` : "Coach por asignar"
  }</div>
        </div>
        <span class="pill">${full ? "Completa" : `${free} libres`}</span>
      </div>

      ${cls.description ? `<p class="sub" style="margin:2px 0 0; color:#0b0f19;">${escapeHtml(cls.description)}</p>` : ""}

      <div style="display:flex; flex-direction:column; gap:6px; margin-top:4px;">
        <div style="display:flex; justify-content:space-between; gap:8px; align-items:center;">
          <div class="dim" style="font-weight:800;">Aforo ${booked}/${capacity}</div>
          <span class="member-demand-badge ${demand.className}">${demand.label}</span>
        </div>
        <div style="height:8px; width:100%; border-radius:999px; background:rgba(13,26,45,.12); overflow:hidden;">
          <span style="display:block; height:100%; width:${occupancy}%; background:${progressColor};"></span>
        </div>
      </div>

      <div class="cta-inline" style="margin-top:auto;">
        <button class="btn btn-primary" data-action="reserve" data-id="${cls.id}" ${full || isReserved ? "disabled" : ""}>
          ${isReserved ? "Reservada" : "Reservar"}
        </button>
        <button class="btn btn-ghost" data-action="cancel" data-id="${cls.id}" ${isReserved ? "" : "disabled"}>Cancelar</button>
      </div>
      <div class="dim" id="member-msg-${cls.id}" style="${feedback ? `color:${feedbackColor}; font-weight:700;` : ""}">
        ${feedback ? escapeHtml(feedback.message) : ""}
      </div>
    </article>
  `;
};

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

  const name = me?.profile?.firstName || me?.firstName || me?.name || me?.email || "Socio";
  const [classes, initialReservations] = await Promise.all([
    gymService.listClasses().catch(() => []),
    gymService.listMyReservations().catch(() => []),
  ]);
  const sortedClasses = sortClassesByDate(classes);
  const initialReservedClassIds = getActiveReservationClassIds(initialReservations);
  const initialClassCards = sortedClasses.length
    ? sortedClasses
        .map((cls) =>
          renderMemberClassCard(cls, {
            isReserved: initialReservedClassIds.has(Number(cls.id)),
          })
        )
        .join("")
    : renderEmptyState();

  setTimeout(() => {
    const listEl = document.querySelector("#member-classes");
    const statusEl = document.querySelector("#member-status");
    const refreshBtn = document.querySelector("#member-refresh");
    const searchEl = document.querySelector("#member-search");
    const filterButtons = Array.from(document.querySelectorAll("[data-class-filter]"));
    const visibleCountEl = document.querySelector("#member-visible-count");
    const nextClassEl = document.querySelector("#member-next-class");
    const freeTodayEl = document.querySelector("#member-free-today");

    let currentClasses = sortedClasses.slice();
    let currentReservations = Array.isArray(initialReservations) ? initialReservations.slice() : [];
    let reservedClassIds = getActiveReservationClassIds(currentReservations);
    const actionFeedbackByClassId = new Map();
    let currentFilter = "available";
    let currentSearch = "";

    const setStatus = (txt, isError = false) => {
      if (!statusEl) return;
      statusEl.textContent = txt;
      statusEl.style.color = isError ? "#b42318" : "var(--muted)";
    };

    const applyFilters = (items) =>
      items.filter((cls) => {
        if (!asDate(cls.starts_at)) return false;
        const capacity = Number(cls.capacity || 0);
        const booked = Number(cls.booked_count || 0);
        const hasSpace = booked < capacity;
        const occupancy = capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;

        if (currentFilter === "available" && !hasSpace) return false;
        if (currentFilter === "today" && !isToday(cls.starts_at)) return false;
        if (currentFilter === "week" && !isWithinNextDays(cls.starts_at, 7)) return false;
        if (currentFilter === "high" && occupancy < 85) return false;

        if (!currentSearch) return true;
        const haystack = normalizeText([cls.class_type_name, cls.location, cls.instructor_name, cls.description].join(" "));
        return haystack.includes(currentSearch);
      });

    const updateTopMetrics = (visibleItems) => {
      if (visibleCountEl) visibleCountEl.textContent = `${visibleItems.length} clases`;
      const nextClass = visibleItems[0];
      if (nextClassEl) nextClassEl.textContent = nextClass ? formatClassDate(nextClass.starts_at) : "Sin clases con el filtro";

      if (freeTodayEl) {
        const todaySlots = currentClasses
          .filter((cls) => isToday(cls.starts_at))
          .reduce((acc, cls) => {
            const cap = Number(cls.capacity || 0);
            const booked = Number(cls.booked_count || 0);
            return acc + Math.max(cap - booked, 0);
          }, 0);
        freeTodayEl.textContent = `${todaySlots} plazas`;
      }
    };

    const paintFilterButtons = () => {
      filterButtons.forEach((btn) => {
        const active = btn.dataset.classFilter === currentFilter;
        btn.classList.toggle("active", active);
      });
    };

    const setCardFeedback = (classId, message, type = "success") => {
      actionFeedbackByClassId.set(Number(classId), {
        message: String(message || "").trim() || "Operacion completada.",
        type,
      });
    };

    const animateCards = () => {
      const cards = Array.from(document.querySelectorAll("#member-classes .member-class-card"));
      if (!cards.length) return;
      cards.forEach((card) => card.classList.remove("is-visible"));
      requestAnimationFrame(() => {
        cards.forEach((card, index) => {
          window.setTimeout(() => {
            card.classList.add("is-visible");
          }, Math.min(index * 40, 320));
        });
      });
    };

    const renderClassList = () => {
      if (!listEl) return;
      const visible = applyFilters(currentClasses);
      listEl.innerHTML = visible.length
        ? visible
            .map((cls) =>
              renderMemberClassCard(cls, {
                isReserved: reservedClassIds.has(Number(cls.id)),
                feedback: actionFeedbackByClassId.get(Number(cls.id)),
              })
            )
            .join("")
        : "<p class='sub'>No hay clases con los filtros actuales.</p>";
      updateTopMetrics(visible);
      paintFilterButtons();
      setStatus(`Mostrando ${visible.length} de ${currentClasses.length} clases.`);
      animateCards();
    };

    const loadClasses = async () => {
      setStatus("Cargando clases...");
      if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.textContent = "Actualizando...";
      }
      if (listEl) {
        listEl.innerHTML = renderClassSkeleton();
      }
      try {
        const [data, reservations] = await Promise.all([
          gymService.listClasses(),
          gymService.listMyReservations().catch(() => currentReservations),
        ]);
        currentClasses = sortClassesByDate(data);
        currentReservations = Array.isArray(reservations) ? reservations : [];
        reservedClassIds = getActiveReservationClassIds(currentReservations);
        renderClassList();
      } catch (err) {
        console.error(err);
        setStatus(err.message || "No se pudieron cargar las clases.", true);
      } finally {
        if (refreshBtn) {
          refreshBtn.disabled = false;
          refreshBtn.textContent = "Actualizar clases";
        }
      }
    };

    refreshBtn?.addEventListener("click", () => loadClasses());
    filterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        currentFilter = btn.dataset.classFilter || "available";
        renderClassList();
      });
    });

    searchEl?.addEventListener("input", () => {
      currentSearch = normalizeText(searchEl.value);
      renderClassList();
    });

    listEl?.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      if (!Number.isFinite(id) || id <= 0) return;
      const action = btn.dataset.action;
      const msgEl = document.querySelector(`#member-msg-${id}`);
      const toggle = (isLoading, label) => {
        btn.disabled = isLoading;
        if (!btn.dataset.label) btn.dataset.label = btn.textContent;
        btn.textContent = isLoading ? label : btn.dataset.label;
      };
      const alreadyReserved = reservedClassIds.has(id);
      try {
        if (action === "reserve") {
          if (alreadyReserved) {
            const txt = "Ya tienes esta clase reservada.";
            if (msgEl) msgEl.textContent = txt;
            setCardFeedback(id, txt);
            showToast(txt, "info");
            await loadClasses();
            return;
          }
          toggle(true, "Reservando...");
          await gymService.reserveClass(id);
          setCardFeedback(id, "Reserva confirmada. Te esperamos en clase.");
          showToast("Reserva confirmada.", "success");
        }
        if (action === "cancel") {
          if (!alreadyReserved) {
            const txt = "No hay una reserva activa para esta clase.";
            if (msgEl) msgEl.textContent = txt;
            setCardFeedback(id, txt, "error");
            showToast(txt, "error");
            await loadClasses();
            return;
          }
          toggle(true, "Cancelando...");
          await gymService.cancelReservation(id);
          setCardFeedback(id, "Reserva cancelada.");
          showToast("Reserva cancelada.", "success");
        }
        await loadClasses();
      } catch (err) {
        const errorMessage = err.message || "Error al procesar.";
        if (msgEl) msgEl.textContent = errorMessage;
        setCardFeedback(id, errorMessage, "error");
        showToast(errorMessage, "error");
      } finally {
        toggle(false);
      }
    });

    renderClassList();
  }, 0);

  return `
    <div class="bg-blobs"></div>
    <div class="screen">
      ${Navbar()}
      <main class="container" style="padding-bottom:28px;">
        <section class="hero">
          <div class="card" style="display:flex; flex-direction:column; gap:16px;">
            <div style="display:flex; justify-content:space-between; gap:14px; align-items:flex-start; flex-wrap:wrap;">
              <div>
                <div class="kicker member-hero-kicker">MEMBER AREA</div>
                <h1 class="member-hero-title">Hola, <span>${escapeHtml(name)}</span></h1>
                <p class="sub member-hero-sub">Aquí tienes todas las clases disponibles para reservar.</p>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <a class="btn btn-ghost" href="#/mis-reservas">Mis reservas</a>
                <button class="btn btn-primary" id="member-refresh" type="button">Actualizar clases</button>
              </div>
            </div>

            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              <span class="tab-btn active" style="display:inline-flex; align-items:center;">Clases</span>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px;">
              <div class="card" style="padding:14px; box-shadow:none; background:var(--surface-2); border-color:var(--border);">
                <div class="kicker">Visibles</div>
                <div style="font-size:22px; font-weight:1000;" id="member-visible-count">${sortedClasses.length} clases</div>
              </div>
              <div class="card" style="padding:14px; box-shadow:none; background:var(--surface-2); border-color:var(--border);">
                <div class="kicker">Próxima clase</div>
                <div style="font-size:15px; font-weight:900;" id="member-next-class">${sortedClasses[0] ? escapeHtml(formatClassDate(sortedClasses[0].starts_at)) : "Sin clases"}</div>
              </div>
              <div class="card" style="padding:14px; box-shadow:none; background:var(--surface-2); border-color:var(--border);">
                <div class="kicker">Plazas hoy</div>
                <div style="font-size:22px; font-weight:1000;" id="member-free-today">--</div>
              </div>
            </div>

            <section class="card" style="display:flex; flex-direction:column; gap:12px; background:var(--surface-2); border-color:var(--border); box-shadow:none;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                <div>
                  <div class="kicker">Clases disponibles</div>
                  <div class="dim" id="member-status">Conectado al servicio de clases.</div>
                </div>
                <input id="member-search" type="text" placeholder="Buscar por tipo, coach o sala..." style="max-width:280px; width:100%;" />
              </div>

              <div style="display:flex; flex-wrap:wrap; gap:8px;">
                <button class="tab-btn active" type="button" data-class-filter="available">Con plazas</button>
                <button class="tab-btn" type="button" data-class-filter="today">Hoy</button>
                <button class="tab-btn" type="button" data-class-filter="week">Semana</button>
                <button class="tab-btn" type="button" data-class-filter="high">Alta demanda</button>
                <button class="tab-btn" type="button" data-class-filter="all">Todas</button>
              </div>

              <div class="member-demand-legend">
                <span class="member-demand-badge member-demand-low">Baja demanda</span>
                <span class="member-demand-badge member-demand-medium">Demanda media</span>
                <span class="member-demand-badge member-demand-high">Alta demanda</span>
              </div>

              <div id="member-classes" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:12px;">
                ${initialClassCards}
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  `;
}
