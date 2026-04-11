import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { authService } from "../services/authService.js";
import { navigate } from "../router.js";
import { gymService } from "../services/gymService.js";

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
  const trainerTitle =
    name === "Entrenador" ? "Entrenador - turno de hoy" : `Entrenador ${name} - turno de hoy`;

  const heroImages = {
    crossfit: "https://images.unsplash.com/photo-1558611848-73f7eb4001a1?auto=format&fit=crop&w=1400&q=80",
    hiit: "https://images.unsplash.com/photo-1554284126-aa88f22d8b74?auto=format&fit=crop&w=1400&q=80",
    mobility: "https://images.unsplash.com/photo-1546484959-f9a9c6c4b4c1?auto=format&fit=crop&w=1400&q=80",
    spinning: "https://images.unsplash.com/photo-1546484475-7e0b1cd5a33e?auto=format&fit=crop&w=1400&q=80",
    cycling: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=1400&q=80",
    strength: "https://images.unsplash.com/photo-1483721310020-03333e577078?auto=format&fit=crop&w=1400&q=80",
  };
  const imgForType = (type) => heroImages[String(type || "").toLowerCase()] || heroImages.strength;

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

  let classTypes = [];
  let classTypesError = "";
  try {
    classTypes = await gymService.listClassTypes();
  } catch (err) {
    classTypesError = err?.message || "No se pudieron cargar los tipos de clase.";
  }
  const classes = await gymService
    .listClasses({ from: start.toISOString(), to: end.toISOString() })
    .catch(() => []);

  const myClasses = classes.filter(
    (c) => Number(c.trainer_user_id) === Number(me.id) || !c.trainer_user_id
  );

  const fmtDate = (iso) =>
    new Date(iso).toLocaleString("es-ES", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  const renderCard = (cls) => {
    const full = Number(cls.booked_count || 0) >= Number(cls.capacity);
    return `
      <article class="class-card" data-class-id="${cls.id}">
        <div class="backdrop" style="background-image:url('${imgForType(cls.class_type_name)}')"></div>
        <div class="tag ${full ? "red" : "green"}">${cls.class_type_name || "Clase"}</div>
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
          <div>
            <div style="font-weight:1000;">${fmtDate(cls.starts_at)}</div>
            <div class="dim">${cls.capacity} plazas · ${cls.booked_count || 0} reservas · ${cls.location || "Centro"}</div>
            ${cls.instructor_name ? `<div class="dim">Coach: ${cls.instructor_name}</div>` : ""}
          </div>
          <span class="badge ${full ? "red" : "green"}">${full ? "Completa" : `${cls.capacity - (cls.booked_count || 0)} libres`}</span>
        </div>
        ${cls.description ? `<p class="sub" style="margin:6px 0; color:#0b0f19;">${cls.description}</p>` : ""}
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
          <button class="btn btn-primary" data-action="reservations" data-id="${cls.id}">Reservas</button>
          <button class="btn btn-ghost" data-action="delete" data-id="${cls.id}">Eliminar</button>
        </div>
      </article>
    `;
  };

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
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff5b2e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <p class="empty-title">Sin clases hoy</p>
        <p class="empty-sub">No tienes clases asignadas para hoy. Consulta con el administrador.</p>
      </div>`;

  setTimeout(() => {
    const listEl = document.querySelector("#trainer-classes");
    const statusEl = document.querySelector("#trainer-status");
    const resEl = document.querySelector("#trainer-reservations");
    const resTitle = document.querySelector("#trainer-res-title");
    const resStatus = document.querySelector("#trainer-res-status");
    const form = document.querySelector("#trainer-create-class");
    const createMsg = document.querySelector("#trainer-create-msg");
    const refreshBtn = document.querySelector("#trainer-refresh");
    let current = myClasses.slice();
    let selectedClassId = null;
    const attendeeNameCache = new Map();

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

      const missingIds = [...new Set(
        reservations
          .map((item) => toUserId(item.user_id))
          .filter((id) => id && !attendeeNameCache.has(id))
      )];

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

    const renderReservations = (items) => {
      if (!resEl) return;
      if (!items.length) {
        resEl.innerHTML = "<p class='sub'>Sin reservas aún.</p>";
        return;
      }
      resEl.innerHTML = items
        .map(
          (r) => `
          <li class="row">
            <span>#${r.id} · ${r.attendee_name || `Usuario ${r.user_id}`}</span>
            <span class="pill">${r.status}</span>
          </li>`
        )
        .join("");
    };

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
              <span>#${r.id} · ${r.attendee_name || `Usuario ${r.user_id}`}</span>
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
        resStatus.textContent = `${reservationsWithNames.length} reservas activas · ${pending} pendientes de pase de lista`;
      }
    };

    const renderList = (items) => {
        if (!listEl) return;
        listEl.innerHTML = items.length
          ? items.map(renderCard).join("")
          : `<div class="empty-state">
              <div class="empty-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff5b2e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <p class="empty-title">Sin clases asignadas</p>
              <p class="empty-sub">No tienes clases en este período.</p>
            </div>`;
      };

    const setStatus = (txt, isError = false) => {
      if (!statusEl) return;
      statusEl.textContent = txt;
      statusEl.style.color = isError ? "#b42318" : "var(--muted)";
    };

    const loadClasses = async () => {
      setStatus("Actualizando clases...");
      try {
        const data = await gymService.listClasses({
          from: start.toISOString(),
          to: end.toISOString(),
        });
        current = data.filter(
          (c) => Number(c.trainer_user_id) === Number(me.id) || !c.trainer_user_id
        );
        renderList(current);
        setStatus(`Clases para hoy: ${current.length}.`);
      } catch (err) {
        console.error(err);
        setStatus(err.message || "No se pudieron cargar las clases.", true);
      }
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
        }
        if (action === "delete") {
          toggle(true, "Eliminando...");
          await gymService.deleteClass(id);
          if (resTitle) resTitle.textContent = "Reservas de clase";
          selectedClassId = selectedClassId === id ? null : selectedClassId;
          renderAttendanceReservations([]);
          if (resStatus) resStatus.textContent = "Selecciona una clase para ver asistentes.";
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

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (createMsg) createMsg.textContent = "";
      const btn = form.querySelector("button[type='submit']");
      const toggle = (isLoading, label) => {
        if (!btn) return;
        btn.disabled = isLoading;
        if (!btn.dataset.label) btn.dataset.label = btn.textContent;
        btn.textContent = isLoading ? label : btn.dataset.label;
      };

      const date = form.date.value;
      const startTime = form.start.value;
      const endTime = form.end.value;
      const classTypeId = form.classTypeId.value;
      const capacity = form.capacity.value ? Number(form.capacity.value) : null;
      const location = form.room.value.trim();
      const instructor = name;
      const description = form.description.value.trim();

      if (!classTypes.length) {
        if (createMsg) createMsg.textContent = "No hay tipos de clase disponibles. Contacta con un administrador.";
        return;
      }

      if (!date || !startTime || !endTime || !classTypeId || !capacity) {
        if (createMsg) createMsg.textContent = "Completa tipo, fecha, horas y capacidad.";
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
        form.reset();
        if (createMsg) createMsg.textContent = "Clase creada.";
        await loadClasses();
      } catch (err) {
        if (createMsg) createMsg.textContent = err.message || "No se pudo crear la clase.";
      } finally {
        toggle(false);
      }
    });

    refreshBtn?.addEventListener("click", () => loadClasses());

    renderList(current);
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
            <p class="sub">Gestiona tus clases, revisa reservas y crea sesiones nuevas.</p>

            <div class="trainer-layout">
              <div class="card trainer-panel trainer-classes-panel">
                <div class="kicker">Clases del día</div>
                <div class="dim" id="trainer-status">Conectado al servicio.</div>
                <div class="class-gallery trainer-class-gallery" id="trainer-classes" style="margin-top:8px;">
                  ${initialList}
                </div>
                <div class="mtop" style="display:flex; gap:10px; flex-wrap:wrap;">
                  <button class="btn btn-primary" id="trainer-refresh" type="button">Actualizar</button>
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

                  <label>Descripción de la clase</label>
                  <textarea name="description" placeholder="Objetivo, material, sensaciones previstas"></textarea>

                  <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                    <button class="btn btn-primary" type="submit">Crear clase</button>
                    <span id="trainer-create-msg" style="color:#0f7b3c; font-weight:700;"></span>
                  </div>
                </form>
              </div>

              <div class="card trainer-panel trainer-reservations-panel">
                <div class="kicker" id="trainer-res-title">Reservas de clase</div>
                <div class="dim" id="trainer-res-status">Selecciona una clase para ver asistentes.</div>
                <ul class="list" id="trainer-reservations" style="margin-top:10px;"></ul>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}
