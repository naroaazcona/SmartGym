import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { authService } from "../services/authService.js";
import { navigate } from "../router.js";
import { gymService } from "../services/gymService.js";
import { trainingService } from "../services/trainingService.js";

export async function TrainerDashboard() {
  const me = await authService.loadSession().catch(() => authStore.me);
  if (!authStore.token || !me) {
    navigate("/login");
    return "";
  }
  if (me.role && me.role !== "trainer") {
    navigate("/");
    return "";
  }

  const name = me?.profile?.firstName || me?.name || me?.email || "Entrenador";
  const trainerTitle = name === "Entrenador" ? "Panel de entrenador" : `Panel de ${name}`;

  const heroImages = {
    crossfit: "https://images.unsplash.com/photo-1558611848-73f7eb4001a1?auto=format&fit=crop&w=1400&q=80",
    hiit: "https://images.unsplash.com/photo-1554284126-aa88f22d8b74?auto=format&fit=crop&w=1400&q=80",
    mobility: "https://images.unsplash.com/photo-1546484959-f9a9c6c4b4c1?auto=format&fit=crop&w=1400&q=80",
    spinning: "https://images.unsplash.com/photo-1546484475-7e0b1cd5a33e?auto=format&fit=crop&w=1400&q=80",
    cycling: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=1400&q=80",
    strength: "https://images.unsplash.com/photo-1483721310020-03333e577078?auto=format&fit=crop&w=1400&q=80",
  };
  const imgForType = (type) => heroImages[String(type || "").toLowerCase()] || heroImages.strength;

  const isMine = (cls) => Number(cls.trainer_user_id) === Number(me.id);

  const pad2 = (value) => String(value).padStart(2, "0");
  const toLocalInputValue = (iso) => {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  };

  const toIsoFromLocalInput = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  };

  const makeTodayRange = () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return {
      mode: "today",
      from: from.toISOString(),
      to: to.toISOString(),
    };
  };

  const makeHistoryRange = () => ({
    mode: "history",
    from: null,
    to: new Date().toISOString(),
  });

  const buildRangeLabel = (range) => {
    if (!range) return "rango actual";
    if (range.mode === "today") return "hoy";
    if (range.mode === "history") return "historial";
    if (!range.from && !range.to) return "sin filtro";

    const fmtDateTime = (iso) => {
      if (!iso) return "";
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return "";
      return date.toLocaleString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    return `${fmtDateTime(range.from) || "inicio"} - ${fmtDateTime(range.to) || "fin"}`;
  };

  const fmtDate = (iso) =>
    new Date(iso).toLocaleString("es-ES", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const formatMemberDate = (value) => {
    if (!value) return "Sin fecha";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Sin fecha";
    return parsed.toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const toListValues = (value) => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || "").trim()).filter(Boolean);
    }
    if (typeof value === "string") {
      return value
        .split(/[;,]+/)
        .map((item) => String(item || "").trim())
        .filter(Boolean);
    }
    return [];
  };

  const summarizePreference = (value, fallback = "Sin definir") => {
    const items = toListValues(value);
    if (items.length) return items.join(", ");
    const text = String(value || "").trim();
    return text || fallback;
  };

  const displayMemberName = (member = {}) => {
    const user = member?.user || {};
    const first = String(user.first_name || "").trim();
    const last = String(user.last_name || "").trim();
    const full = `${first} ${last}`.trim();
    return full || String(user.name || user.email || `Usuario ${user.id || ""}`).trim();
  };

  const renderMemberOverviewCards = (members = []) => {
    if (!members.length) {
      return `
        <div class="empty-state" style="padding:24px 16px;">
          <p class="empty-title">Sin usuarios para mostrar</p>
          <p class="empty-sub">Todavia no hay usuarios registrados.</p>
        </div>
      `;
    }

    return members
      .map((member) => {
        const user = member?.user || {};
        const preferences = member?.preferences || {};
        const logs = Array.isArray(member?.logs) ? member.logs : [];
        const role = String(user.role || "member").toLowerCase();
        const roleLabel = role === "admin" ? "Admin" : role === "trainer" ? "Trainer" : "Member";

        const goal = summarizePreference(preferences.goal, "Sin objetivo");
        const training = summarizePreference(preferences.preferred_training, "Sin preferencia");
        const injuries = summarizePreference(preferences.injuries, "Sin lesiones");
        const equipment = summarizePreference(preferences.available_equipment, "Sin especificar");

        const logsHtml = logs.length
          ? `<ul class="list" style="gap:6px; margin-top:8px;">
              ${logs
                .map((log) => {
                  const title = escapeHtml(log?.title || "Entrenamiento");
                  const dateLabel = escapeHtml(formatMemberDate(log?.date || log?.createdAt));
                  const duration = Number(log?.duration_min || 0);
                  const durationLabel = duration > 0 ? ` - ${duration} min` : "";
                  return `<li class="row" style="padding:8px 10px; font-size:13px;">${title} (${dateLabel}${durationLabel})</li>`;
                })
                .join("")}
            </ul>`
          : `<p class="sub" style="margin:8px 0 0;">Sin ejercicios registrados.</p>`;

        return `
          <article class="card" style="padding:14px; border-radius:14px; box-shadow:none; background:linear-gradient(180deg, rgba(255,255,255,.94), rgba(242,247,255,.95));">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
              <div>
                <div style="font-weight:1000; font-size:16px;">${escapeHtml(displayMemberName(member))}</div>
                <div class="dim">${escapeHtml(user.email || "Sin email")} - ID ${escapeHtml(user.id || "-")}</div>
              </div>
              <span class="badge">${escapeHtml(roleLabel)}</span>
            </div>

            <div class="dim" style="margin-top:6px;">Ultima actividad: ${escapeHtml(formatMemberDate(member?.last_activity_at))}</div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:8px; margin-top:10px;">
              <div class="row" style="padding:8px 10px; align-items:flex-start; flex-direction:column; gap:3px;">
                <span class="kicker">Objetivo</span>
                <span>${escapeHtml(goal)}</span>
              </div>
              <div class="row" style="padding:8px 10px; align-items:flex-start; flex-direction:column; gap:3px;">
                <span class="kicker">Entrenamiento</span>
                <span>${escapeHtml(training)}</span>
              </div>
              <div class="row" style="padding:8px 10px; align-items:flex-start; flex-direction:column; gap:3px;">
                <span class="kicker">Lesiones</span>
                <span>${escapeHtml(injuries)}</span>
              </div>
              <div class="row" style="padding:8px 10px; align-items:flex-start; flex-direction:column; gap:3px;">
                <span class="kicker">Equipamiento</span>
                <span>${escapeHtml(equipment)}</span>
              </div>
            </div>

            <div style="margin-top:10px;">
              <div class="kicker">Ejercicios registrados (${Number(member?.logs_total || logs.length || 0)})</div>
              ${logsHtml}
            </div>
          </article>
        `;
      })
      .join("");
  };

  const renderCard = (cls) => {
    const booked = Number(cls.booked_count || 0);
    const capacity = Number(cls.capacity || 0);
    const free = Math.max(capacity - booked, 0);
    const full = booked >= capacity;
    const isPastClass = new Date(cls.ends_at || cls.starts_at).getTime() < Date.now();
    const badgeClass = isPastClass ? "" : full ? "red" : "green";
    const badgeText = isPastClass ? "Finalizada" : full ? "Completa" : `${free} libres`;

    return `
      <article class="class-card" data-class-id="${cls.id}">
        <div class="backdrop" style="background-image:url('${imgForType(cls.class_type_name)}')"></div>
        <div class="tag ${full ? "red" : "green"}">${cls.class_type_name || "Clase"}</div>
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
          <div>
            <div style="font-weight:1000;">${fmtDate(cls.starts_at)}</div>
            <div class="dim">${capacity} plazas - ${booked} reservas - ${cls.location || "Centro"}</div>
            ${cls.instructor_name ? `<div class="dim">Coach: ${cls.instructor_name}</div>` : ""}
          </div>
          <span class="badge ${badgeClass}">${badgeText}</span>
        </div>
        ${cls.description ? `<p class="sub" style="margin:6px 0; color:#0b0f19;">${cls.description}</p>` : ""}
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
          <button class="btn btn-primary" data-action="reservations" data-id="${cls.id}">Reservas</button>
          <button class="btn btn-ghost" data-action="edit" data-id="${cls.id}">Editar</button>
          <button class="btn btn-ghost" data-action="delete" data-id="${cls.id}">Eliminar</button>
        </div>
      </article>
    `;
  };

  const initialRange = makeTodayRange();

  let classTypes = [];
  let classTypesError = "";
  try {
    classTypes = await gymService.listClassTypes();
  } catch (err) {
    classTypesError = err?.message || "No se pudieron cargar los tipos de clase.";
  }

  const [classes, initialMembersOverviewResult] = await Promise.all([
    gymService.listClasses({ from: initialRange.from, to: initialRange.to }).catch(() => []),
    trainingService.getCoachMembersOverview(6).catch(() => ({ members: [], generatedAt: null })),
  ]);

  const myClasses = classes.filter(isMine);
  const initialMembersOverview = Array.isArray(initialMembersOverviewResult?.members)
    ? initialMembersOverviewResult.members
    : [];
  const initialMembersGeneratedAt = initialMembersOverviewResult?.generatedAt || null;

  const typeOptions = classTypes.length
    ? [
        `<option value="" disabled selected hidden>Elige tipo</option>`,
        ...classTypes.map((t) => `<option value="${t.id}">${t.name}</option>`),
      ].join("")
    : `<option value="" disabled selected>No hay tipos disponibles</option>`;

  const initialList = myClasses.length
    ? myClasses.map(renderCard).join("")
    : `<div class="empty-state">
        <div class="empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff5b2e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <p class="empty-title">Sin clases hoy</p>
        <p class="empty-sub">No tienes clases asignadas hoy.</p>
      </div>`;
  const initialMembersList = renderMemberOverviewCards(initialMembersOverview);

  setTimeout(() => {
    const listEl = document.querySelector("#trainer-classes");
    const statusEl = document.querySelector("#trainer-status");
    const filterForm = document.querySelector("#trainer-class-filter");
    const refreshBtn = document.querySelector("#trainer-refresh");
    const todayBtn = document.querySelector("#trainer-filter-today");
    const historyBtn = document.querySelector("#trainer-filter-history");

    const resEl = document.querySelector("#trainer-reservations");
    const resTitle = document.querySelector("#trainer-res-title");
    const resStatus = document.querySelector("#trainer-res-status");

    const createForm = document.querySelector("#trainer-create-class");
    const createMsg = document.querySelector("#trainer-create-msg");

    const editCard = document.querySelector("#trainer-edit-card");
    const editForm = document.querySelector("#trainer-edit-class");
    const editMsg = document.querySelector("#trainer-edit-msg");
    const editCancelBtn = document.querySelector("#trainer-edit-cancel");
    const membersListEl = document.querySelector("#trainer-members-list");
    const membersStatusEl = document.querySelector("#trainer-members-status");
    const membersCountEl = document.querySelector("#trainer-members-count");
    const membersRefreshBtn = document.querySelector("#trainer-members-refresh");

    let current = myClasses.slice();
    let selectedClassId = null;
    let range = { ...initialRange };
    let membersOverview = initialMembersOverview.slice();
    let membersGeneratedAt = initialMembersGeneratedAt;
    let membersSignature = JSON.stringify(membersOverview);
    let membersPollTimer = null;
    let membersLoading = false;
    const attendeeNameCache = new Map();

    const setStatus = (text, isError = false) => {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.style.color = isError ? "#b42318" : "var(--muted)";
    };

    const setMembersStatus = (text, isError = false) => {
      if (!membersStatusEl) return;
      membersStatusEl.textContent = text;
      membersStatusEl.style.color = isError ? "#b42318" : "var(--muted)";
    };

    const applyRangeToFilter = (nextRange) => {
      if (!filterForm) return;
      filterForm.from.value = toLocalInputValue(nextRange?.from);
      filterForm.to.value = toLocalInputValue(nextRange?.to);
    };

    const renderList = (items) => {
      if (!listEl) return;
      listEl.innerHTML = items.length
        ? items.map(renderCard).join("")
        : `<div class="empty-state">
            <div class="empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff5b2e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <p class="empty-title">Sin clases en el rango</p>
            <p class="empty-sub">Ajusta el filtro para consultar otros dias o revisa el historial.</p>
          </div>`;
    };

    const renderMembersOverview = (items) => {
      if (membersListEl) membersListEl.innerHTML = renderMemberOverviewCards(items);
      if (membersCountEl) {
        membersCountEl.textContent = `${items.length} usuarios`;
      }
    };

    const loadMembersOverview = async ({ silent = false } = {}) => {
      if (membersLoading) return;
      membersLoading = true;

      if (!silent) {
        setMembersStatus("Actualizando usuarios y actividad...");
      }
      if (membersRefreshBtn) {
        membersRefreshBtn.disabled = true;
        membersRefreshBtn.textContent = "Actualizando...";
      }

      try {
        const res = await trainingService.getCoachMembersOverview(6);
        const items = Array.isArray(res?.members) ? res.members : [];
        const nextSignature = JSON.stringify(items);
        const changed = nextSignature !== membersSignature;

        membersOverview = items;
        membersGeneratedAt = res?.generatedAt || null;
        membersSignature = nextSignature;
        renderMembersOverview(membersOverview);

        if (!silent || changed) {
          setMembersStatus(`Sincronizado: ${formatMemberDate(membersGeneratedAt)}.`);
        }
      } catch (err) {
        if (!silent) {
          setMembersStatus(err?.message || "No se pudo cargar el resumen de usuarios.", true);
        }
      } finally {
        membersLoading = false;
        if (membersRefreshBtn) {
          membersRefreshBtn.disabled = false;
          membersRefreshBtn.textContent = "Actualizar usuarios";
        }
      }
    };

    const startMembersPolling = () => {
      if (membersPollTimer) {
        window.clearInterval(membersPollTimer);
      }
      membersPollTimer = window.setInterval(() => {
        if (!membersListEl || !document.body.contains(membersListEl)) {
          if (membersPollTimer) window.clearInterval(membersPollTimer);
          membersPollTimer = null;
          return;
        }
        loadMembersOverview({ silent: true }).catch(() => {});
      }, 8000);
    };

    const resetReservations = () => {
      selectedClassId = null;
      if (resTitle) resTitle.textContent = "Reservas de clase";
      if (resStatus) resStatus.textContent = "Selecciona una clase para ver asistentes.";
      if (resEl) resEl.innerHTML = "";
    };

    const toUserId = (value) => {
      const id = Number(value);
      return Number.isInteger(id) && id > 0 ? id : null;
    };

    const formatUserName = (user = {}) => {
      const firstName = String(user.first_name || user.firstName || "").trim();
      const lastName = String(user.last_name || user.lastName || "").trim();
      const fullName = `${firstName} ${lastName}`.trim();
      return fullName || String(user.name || user.email || "").trim();
    };

    const hydrateReservationsWithNames = async (items = []) => {
      const reservations = Array.isArray(items) ? items : [];
      if (!reservations.length) return [];

      const missingIds = [
        ...new Set(
          reservations
            .map((item) => toUserId(item.user_id))
            .filter((id) => id && !attendeeNameCache.has(id))
        ),
      ];

      if (missingIds.length) {
        try {
          const users = await authService.listBasicUsers(missingIds);
          users.forEach((user) => {
            const id = toUserId(user.id);
            if (!id) return;
            const displayName = formatUserName(user);
            attendeeNameCache.set(id, displayName || `Usuario ${id}`);
          });
        } catch (err) {
          console.error("No se pudieron cargar nombres de reservas:", err);
        }
      }

      return reservations.map((item) => {
        const userId = toUserId(item.user_id);
        const displayName =
          (userId ? attendeeNameCache.get(userId) : "") ||
          item.attendee_name ||
          (userId ? `Usuario ${userId}` : "Usuario");
        return {
          ...item,
          attendee_name: displayName,
        };
      });
    };

    const statusLabel = {
      booked: "Pendiente",
      present: "Presente",
      late: "Tarde",
      absent: "Ausente",
      no_show: "No-show",
      cancelled: "Cancelada",
    };

    const attendanceStatuses = [
      { value: "present", label: "Presente" },
      { value: "late", label: "Tarde" },
      { value: "absent", label: "Ausente" },
      { value: "no_show", label: "No-show" },
    ];

    const renderAttendanceReservations = (items) => {
      if (!resEl) return;
      if (!items.length) {
        resEl.innerHTML = "<p class='sub'>Sin reservas activas.</p>";
        return;
      }

      const ordered = items
        .slice()
        .sort((a, b) => {
          const order = { booked: 0, present: 1, late: 2, absent: 3, no_show: 4, cancelled: 5 };
          return (order[a.status] ?? 99) - (order[b.status] ?? 99);
        });

      resEl.innerHTML = ordered
        .map(
          (r) => `
          <li class="row" style="display:flex; flex-direction:column; gap:8px; align-items:stretch;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
              <span>#${r.id} - ${r.attendee_name || `Usuario ${r.user_id}`}</span>
              <span class="pill">${statusLabel[r.status] || r.status}</span>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
              ${attendanceStatuses
                .map(
                  (item) =>
                    `<button class="btn btn-ghost" type="button" data-action="mark-attendance" data-class-id="${selectedClassId}" data-reservation-id="${r.id}" data-status="${item.value}" ${
                      r.status === item.value ? "disabled" : ""
                    }>${item.label}</button>`
                )
                .join("")}
            </div>
          </li>`
        )
        .join("");
    };

    const loadReservations = async (classId) => {
      selectedClassId = classId;
      const reservations = await gymService.listReservations(classId);
      const reservationsWithNames = await hydrateReservationsWithNames(reservations);
      if (resTitle) resTitle.textContent = `Reservas de la clase ${classId}`;
      renderAttendanceReservations(reservationsWithNames);
      if (resStatus) {
        const pending = reservationsWithNames.filter((item) => item.status === "booked").length;
        resStatus.textContent = `${reservationsWithNames.length} reservas activas - ${pending} pendientes de pase de lista`;
      }
    };

    const loadClasses = async (nextRange) => {
      if (nextRange) {
        range = { ...range, ...nextRange };
      }

      setStatus("Actualizando clases...");
      try {
        const params = {};
        if (range.from) params.from = range.from;
        if (range.to) params.to = range.to;

        const data = await gymService.listClasses(params);
        current = data.filter(isMine);
        renderList(current);
        applyRangeToFilter(range);
        setStatus(`Mostrando ${current.length} clases (${buildRangeLabel(range)}).`);

        if (selectedClassId && !current.some((item) => Number(item.id) === Number(selectedClassId))) {
          resetReservations();
        }
      } catch (err) {
        console.error(err);
        setStatus(err.message || "No se pudieron cargar las clases.", true);
      }
    };

    const openEditCard = (cls) => {
      if (!editCard || !editForm) return;
      editForm.classId.value = cls.id;
      editForm.classTypeId.value = String(cls.class_type_id || "");
      editForm.date.value = cls.starts_at?.slice(0, 10) || "";
      editForm.start.value = cls.starts_at?.slice(11, 16) || "";
      editForm.end.value = cls.ends_at?.slice(11, 16) || "";
      editForm.room.value = cls.location || "";
      editForm.instructor.value = cls.instructor_name || "";
      editForm.capacity.value = cls.capacity || "";
      editForm.description.value = cls.description || "";
      if (editMsg) {
        editMsg.textContent = "";
        editMsg.style.color = "#0f7b3c";
      }
      editCard.style.display = "block";
      editCard.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const closeEditCard = () => {
      if (!editCard || !editForm) return;
      editCard.style.display = "none";
      editForm.reset();
      if (editMsg) editMsg.textContent = "";
    };

    listEl?.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      const action = btn.dataset.action;
      if (!id) return;

      const toggle = (isLoading, label) => {
        btn.disabled = isLoading;
        if (!btn.dataset.label) btn.dataset.label = btn.textContent;
        btn.textContent = isLoading ? label : btn.dataset.label;
      };

      try {
        if (action === "reservations") {
          toggle(true, "Cargando...");
          await loadReservations(id);
          return;
        }

        if (action === "edit") {
          const cls = current.find((item) => Number(item.id) === id);
          if (!cls) return;
          openEditCard(cls);
          return;
        }

        if (action === "delete") {
          toggle(true, "Eliminando...");
          await gymService.deleteClass(id);
          if (Number(selectedClassId) === id) resetReservations();
          await loadClasses();
        }
      } catch (err) {
        if (resStatus) resStatus.textContent = err.message || "Error al procesar.";
      } finally {
        toggle(false);
      }
    });

    resEl?.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action='mark-attendance']");
      if (!btn) return;
      const classId = Number(btn.dataset.classId || selectedClassId);
      const reservationId = Number(btn.dataset.reservationId);
      const status = String(btn.dataset.status || "").trim().toLowerCase();
      if (!classId || !reservationId || !status) return;

      const toggle = (isLoading, label) => {
        btn.disabled = isLoading;
        if (!btn.dataset.label) btn.dataset.label = btn.textContent;
        btn.textContent = isLoading ? label : btn.dataset.label;
      };

      try {
        toggle(true, "Guardando...");
        await gymService.updateReservationStatus(classId, reservationId, status);
        await loadReservations(classId);
      } catch (err) {
        if (resStatus) resStatus.textContent = err.message || "No se pudo actualizar asistencia.";
      } finally {
        toggle(false);
      }
    });

    createForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (createMsg) {
        createMsg.textContent = "";
        createMsg.style.color = "#0f7b3c";
      }
      const btn = createForm.querySelector("button[type='submit']");
      const toggle = (isLoading, label) => {
        if (!btn) return;
        btn.disabled = isLoading;
        if (!btn.dataset.label) btn.dataset.label = btn.textContent;
        btn.textContent = isLoading ? label : btn.dataset.label;
      };

      const date = createForm.date.value;
      const startTime = createForm.start.value;
      const endTime = createForm.end.value;
      const classTypeId = createForm.classTypeId.value;
      const capacity = createForm.capacity.value ? Number(createForm.capacity.value) : null;
      const location = createForm.room.value.trim();
      const instructor = name;
      const description = createForm.description.value.trim();

      if (!classTypes.length) {
        if (createMsg) {
          createMsg.textContent = "No hay tipos de clase disponibles. Contacta con un administrador.";
          createMsg.style.color = "#b42318";
        }
        return;
      }

      if (!date || !startTime || !endTime || !classTypeId || !capacity) {
        if (createMsg) {
          createMsg.textContent = "Completa tipo, fecha, horas y capacidad.";
          createMsg.style.color = "#b42318";
        }
        return;
      }

      try {
        toggle(true, "Creando...");
        await gymService.createClass({
          class_type_id: Number(classTypeId),
          starts_at: new Date(`${date}T${startTime}`).toISOString(),
          ends_at: new Date(`${date}T${endTime}`).toISOString(),
          capacity,
          location,
          instructor_name: instructor,
          description: description || null,
        });
        createForm.reset();
        if (createMsg) {
          createMsg.textContent = "Clase creada.";
          createMsg.style.color = "#0f7b3c";
        }
        await loadClasses();
      } catch (err) {
        if (createMsg) {
          createMsg.textContent = err.message || "No se pudo crear la clase.";
          createMsg.style.color = "#b42318";
        }
      } finally {
        toggle(false);
      }
    });

    editForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!editForm) return;

      const btn = editForm.querySelector("button[type='submit']");
      const toggle = (isLoading) => {
        if (!btn) return;
        btn.disabled = isLoading;
        if (!btn.dataset.label) btn.dataset.label = btn.textContent;
        btn.textContent = isLoading ? "Guardando..." : btn.dataset.label;
      };

      const id = Number(editForm.classId.value);
      const classTypeId = editForm.classTypeId.value;
      const date = editForm.date.value;
      const startTime = editForm.start.value;
      const endTime = editForm.end.value;
      const capacity = editForm.capacity.value ? Number(editForm.capacity.value) : null;

      if (!id || !classTypeId || !date || !startTime || !endTime || !capacity) {
        if (editMsg) {
          editMsg.textContent = "Completa tipo, fecha, horas y capacidad para guardar.";
          editMsg.style.color = "#b42318";
        }
        return;
      }

      try {
        toggle(true);
        await gymService.updateClass(id, {
          class_type_id: Number(classTypeId),
          starts_at: new Date(`${date}T${startTime}`).toISOString(),
          ends_at: new Date(`${date}T${endTime}`).toISOString(),
          capacity,
          location: editForm.room.value.trim() || null,
          instructor_name: editForm.instructor.value.trim() || null,
          description: editForm.description.value.trim() || null,
        });

        if (editMsg) {
          editMsg.textContent = "Clase actualizada correctamente.";
          editMsg.style.color = "#0f7b3c";
        }

        await loadClasses();
        if (Number(selectedClassId) === id) {
          await loadReservations(id);
        }
      } catch (err) {
        if (editMsg) {
          editMsg.textContent = err.message || "No se pudo actualizar la clase.";
          editMsg.style.color = "#b42318";
        }
      } finally {
        toggle(false);
      }
    });

    editCancelBtn?.addEventListener("click", closeEditCard);

    filterForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const from = toIsoFromLocalInput(filterForm.from.value);
      const to = toIsoFromLocalInput(filterForm.to.value);

      if (from && to && new Date(from).getTime() > new Date(to).getTime()) {
        setStatus("El rango no es valido: 'Desde' debe ser anterior a 'Hasta'.", true);
        return;
      }

      if (!from && !to) {
        loadClasses(makeTodayRange());
        return;
      }

      loadClasses({
        mode: "custom",
        from,
        to,
      });
    });

    todayBtn?.addEventListener("click", () => {
      loadClasses(makeTodayRange());
    });

    historyBtn?.addEventListener("click", () => {
      loadClasses(makeHistoryRange());
    });

    refreshBtn?.addEventListener("click", () => loadClasses());
    membersRefreshBtn?.addEventListener("click", () => {
      loadMembersOverview({ silent: false }).catch(() => {});
    });

    renderList(current);
    renderMembersOverview(membersOverview);
    applyRangeToFilter(range);
    setStatus(`Mostrando ${current.length} clases (${buildRangeLabel(range)}).`);
    setMembersStatus(`Sincronizado: ${formatMemberDate(membersGeneratedAt)}.`);
    startMembersPolling();
  }, 0);

  return `
    <div class="bg-blobs"></div>

    <div class="screen">
      ${Navbar()}
      <main class="container">
        <section class="hero">
          <div class="card">
            <div class="kicker">PANEL ENTRENADOR</div>
            <h2 class="h2">${trainerTitle}</h2>
            <p class="sub">Gestiona tus clases, filtra por dias, consulta historial y revisa reservas.</p>

            <div class="trainer-layout">
              <div class="card trainer-panel trainer-classes-panel">
                <div class="kicker">Clases asignadas</div>

                <div class="admin-filter-card" style="display:flex; flex-direction:column; gap:8px; width:100%;">
                  <div class="kicker" style="font-size:11px;">Filtrar por fecha</div>
                  <form id="trainer-class-filter" class="form admin-filter-form" style="margin:0;">
                    <div class="form-col">
                      <label>Desde</label>
                      <input name="from" type="datetime-local" />
                    </div>
                    <div class="form-col">
                      <label>Hasta</label>
                      <input name="to" type="datetime-local" />
                    </div>
                    <div class="admin-filter-actions" style="display:flex; flex-wrap:wrap; gap:8px; grid-template-columns:none;">
                      <button class="btn btn-primary" type="submit">Aplicar</button>
                      <button class="btn btn-ghost" type="button" id="trainer-filter-today">Hoy</button>
                      <button class="btn btn-ghost" type="button" id="trainer-filter-history">Historial</button>
                      <button class="btn btn-ghost" type="button" id="trainer-refresh">Actualizar</button>
                    </div>
                  </form>
                </div>

                <div class="dim" id="trainer-status" style="margin-top:8px;">Conectado al servicio.</div>
                <div class="class-gallery trainer-class-gallery" id="trainer-classes" style="margin-top:8px;">
                  ${initialList}
                </div>
              </div>

              <div class="card trainer-panel trainer-form-panel">
                <div class="kicker">Crear nueva clase</div>
                <form id="trainer-create-class" class="form" style="margin-top:8px; display:flex; flex-direction:column; gap:10px;">
                  <label>Tipo de clase</label>
                  <select name="classTypeId" required ${classTypes.length ? "" : "disabled"}>${typeOptions}</select>
                  <div class="dim" style="color:#b42318;">
                    ${classTypesError || (classTypes.length ? "" : "No hay tipos de clase disponibles. Pide al admin que cree uno.")}
                  </div>

                  <div class="form-row">
                    <div class="form-col">
                      <label>Fecha</label>
                      <input name="date" type="date" required />
                    </div>
                    <div class="form-col">
                      <label>Inicio</label>
                      <input name="start" type="time" required />
                    </div>
                    <div class="form-col">
                      <label>Fin</label>
                      <input name="end" type="time" required />
                    </div>
                  </div>

                  <div class="form-row">
                    <div class="form-col">
                      <label>Sala / ubicacion</label>
                      <input name="room" type="text" placeholder="Sala 2" />
                    </div>
                    <div class="form-col">
                      <label>Capacidad</label>
                      <input name="capacity" type="number" min="1" placeholder="20" required />
                    </div>
                  </div>

                  <label>Coach visible</label>
                  <input name="instructor" type="text" value="${name}" readonly />

                  <label>Descripcion de la clase</label>
                  <textarea name="description" placeholder="Objetivo, material, sensaciones previstas"></textarea>

                  <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                    <button class="btn btn-primary" type="submit">Crear clase</button>
                    <span id="trainer-create-msg" style="font-weight:700;"></span>
                  </div>
                </form>
              </div>

              <div class="card trainer-panel trainer-reservations-panel">
                <div class="kicker" id="trainer-res-title">Reservas de clase</div>
                <div class="dim" id="trainer-res-status">Selecciona una clase para ver asistentes.</div>
                <ul class="list" id="trainer-reservations" style="margin-top:10px;"></ul>
              </div>

              <div class="card trainer-panel trainer-members-panel">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
                  <div>
                    <div class="kicker">Usuarios registrados</div>
                    <div class="dim" id="trainer-members-count">${initialMembersOverview.length} usuarios</div>
                  </div>
                  <button class="btn btn-ghost" type="button" id="trainer-members-refresh">Actualizar usuarios</button>
                </div>
                <div class="dim" id="trainer-members-status" style="margin-top:8px;">
                  Sincronizado: ${escapeHtml(formatMemberDate(initialMembersGeneratedAt))}.
                </div>
                <div id="trainer-members-list" style="display:grid; gap:10px; margin-top:10px;">
                  ${initialMembersList}
                </div>
              </div>

              <div class="card trainer-panel trainer-edit-panel" id="trainer-edit-card" style="display:none;">
                <div class="kicker">Editar clase</div>
                <form id="trainer-edit-class" class="form" style="margin:0; display:flex; flex-direction:column; gap:10px; background:transparent; padding:0;">
                  <input type="hidden" name="classId" />

                  <label>Tipo de clase</label>
                  <select name="classTypeId" required ${classTypes.length ? "" : "disabled"}>${typeOptions}</select>

                  <div class="form-row">
                    <div class="form-col">
                      <label>Fecha</label>
                      <input name="date" type="date" required />
                    </div>
                    <div class="form-col">
                      <label>Inicio</label>
                      <input name="start" type="time" required />
                    </div>
                    <div class="form-col">
                      <label>Fin</label>
                      <input name="end" type="time" required />
                    </div>
                  </div>

                  <label>Ubicacion</label>
                  <input name="room" type="text" placeholder="Sala 1" />

                  <label>Coach visible</label>
                  <input name="instructor" type="text" placeholder="Nombre coach" />

                  <label>Capacidad</label>
                  <input name="capacity" type="number" min="1" required />

                  <label>Descripcion</label>
                  <textarea name="description" placeholder="Descripcion de la clase"></textarea>

                  <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                    <button class="btn btn-primary" type="submit">Guardar cambios</button>
                    <button class="btn btn-ghost" type="button" id="trainer-edit-cancel">Cancelar</button>
                    <span id="trainer-edit-msg" style="font-weight:700;"></span>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}
