import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { authService } from "../services/authService.js";
import { navigate } from "../router.js";
import { gymService } from "../services/gymService.js";

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
  const isOnline = Boolean(authStore.token);

  let classTypes = [];
  let classTypesError = "";
  try {
    classTypes = await gymService.listClassTypes();
  } catch (err) {
    classTypesError = err?.message || "No se pudieron cargar los tipos de clase.";
  }
  const classes = await gymService.listClasses().catch(() => []);
  const trainers = await authService.listByRole('trainer').catch(() => []);

  const heroImages = {
    crossfit: "https://images.unsplash.com/photo-1558611848-73f7eb4001a1?auto=format&fit=crop&w=1400&q=80",
    hiit: "https://images.unsplash.com/photo-1554284126-aa88f22d8b74?auto=format&fit=crop&w=1400&q=80",
    mobility: "https://images.unsplash.com/photo-1546484959-f9a9c6c4b4c1?auto=format&fit=crop&w=1400&q=80",
    spinning: "https://images.unsplash.com/photo-1546484475-7e0b1cd5a33e?auto=format&fit=crop&w=1400&q=80",
    cycling: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=1400&q=80",
    strength: "https://images.unsplash.com/photo-1483721310020-03333e577078?auto=format&fit=crop&w=1400&q=80",
  };

  const imgForType = (type) => heroImages[String(type || "").toLowerCase()] || heroImages.strength;

  const fmtDate = (iso) =>
    new Date(iso).toLocaleString("es-ES", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  const renderClassCard = (cls) => {
    const full = Number(cls.booked_count || 0) >= Number(cls.capacity);
    return `
      <article class="class-card" data-class-id="${cls.id}">
        <div class="backdrop" style="background-image:url('${imgForType(cls.class_type_name)}')"></div>
        <div class="tag red">${cls.class_type_name || "Clase"}</div>
        <div style="display:flex; justify-content:space-between; gap:8px; align-items:flex-start;">
          <div>
            <div style="font-weight:1000; font-size:18px;">${fmtDate(cls.starts_at)}</div>
            <div class="dim">${cls.location || "Sala principal"} · ${cls.capacity} plazas</div>
            ${cls.instructor_name ? `<div class="dim">Coach: ${cls.instructor_name}</div>` : ""}
          </div>
          <span class="badge ${full ? "red" : "green"}">
            ${full ? "Completa" : `${cls.capacity - (cls.booked_count || 0)} libres`}
          </span>
        </div>
        ${cls.description ? `<p class="sub" style="margin:6px 0 4px; color:#0b0f19;">${cls.description}</p>` : ""}
        <div class="chip-row">
          <span class="chip">${cls.booked_count || 0} reservas</span>
          <span class="chip">Tipo ${cls.class_type_name || "-"}</span>
          <span class="chip">Trainer ${cls.trainer_user_id || "-"}</span>
        </div>
        <div class="cta-inline" style="margin-top:10px;">
          <button class="btn btn-primary" data-action="reservations" data-id="${cls.id}">Reservas</button>
          <button class="btn btn-ghost" data-action="edit" data-id="${cls.id}">Editar</button>
          <button class="btn btn-ghost" data-action="delete" data-id="${cls.id}">Eliminar</button>
        </div>
      </article>
    `;
  };

  const initialClassList = classes.length
    ? classes.map(renderClassCard).join("")
    : `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff5b2e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg>
        </div>
        <p class="empty-title">Sin clases programadas</p>
        <p class="empty-sub">Crea la primera clase usando el formulario de la derecha.</p>
      </div>`;

  const buildTypeOptions = (types = []) => {
    if (!types.length) {
      return `<option value="" disabled selected>No hay tipos disponibles</option>`;
    }
    return [
      `<option value="" disabled selected hidden>Elige tipo</option>`,
      ...types.map((t) => `<option value="${t.id}">${t.name}</option>`),
    ].join("");
  };

  const typeOptions = buildTypeOptions(classTypes);

  const trainerOptions = trainers.map(t => `<option value="${t.id}">${t.first_name || t.name} (ID: ${t.id})</option>`).join('');

  setTimeout(() => {
    const classList = document.querySelector("#admin-classes");
    const classStatus = document.querySelector("#admin-class-status");
    const filterForm = document.querySelector("#admin-class-filter");
    const refreshBtn = document.querySelector("#admin-class-refresh");

    const resTitle = document.querySelector("#admin-res-title");
    const resStatus = document.querySelector("#admin-res-status");
    const resList = document.querySelector("#admin-reservations");

    const createForm = document.querySelector("#admin-create-class");
    const createMsg = document.querySelector("#admin-create-msg");
    const classTypeErrorEl = document.querySelector("#admin-class-type-error");
    const classTypeCountEl = document.querySelector("#admin-class-type-count");

    let currentClasses = classes.slice();

    const buildTypeOptionsHtml = (types = []) => {
      if (!types.length) {
        return `<option value="" disabled selected>No hay tipos disponibles</option>`;
      }
      return [
        `<option value="" disabled selected hidden>Elige tipo</option>`,
        ...types.map((t) => `<option value="${t.id}">${t.name}</option>`),
      ].join("");
    };

    const syncClassTypeSelects = (types = []) => {
      const html = buildTypeOptionsHtml(types);
      document.querySelectorAll("select[data-class-type-select='true']").forEach((select) => {
        const currentVal = select.value;
        select.innerHTML = html;
        select.disabled = !types.length;
        if (currentVal && types.some((t) => String(t.id) === String(currentVal))) {
          select.value = String(currentVal);
        }
      });
      if (classTypeCountEl) classTypeCountEl.textContent = String(types.length);
    };

    const renderReservations = (items, userMap = {}) => {
      if (!resList) return;
      if (!items.length) {
        resList.innerHTML = "<p class='sub'>Sin reservas para esta clase.</p>";
        return;
      }
      resList.innerHTML = items
        .map(
          (r) => {
            const userName = userMap[r.user_id]
              ? `${userMap[r.user_id].name} <span class="dim" style="font-size:12px;">(#${r.user_id})</span>`
              : `Usuario ${r.user_id}`;
            return `
          <li class="row">
            <span>#${r.id} · ${userName}</span>
            <span class="pill">${r.status}</span>
          </li>`;
          }
        )
        .join("");
    };

    const renderClasses = (items) => {
      if (!classList) return;
      classList.innerHTML = items.length
        ? items.map(renderClassCard).join("")
        : `<div class="empty-state" style="grid-column:1/-1">
            <div class="empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff5b2e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </div>
            <p class="empty-title">Sin resultados</p>
            <p class="empty-sub">Ninguna clase coincide con el filtro seleccionado.</p>
          </div>`;
    };

    const setStatus = (txt, isError = false) => {
      if (!classStatus) return;
      classStatus.textContent = txt;
      classStatus.style.color = isError ? "#fca5a5" : "var(--muted)";
    };

    const loadClasses = async () => {
      setStatus("Cargando clases...");
      if (classList) {
        classList.innerHTML = Array.from({ length: 3 }, () => `
          <div class="skeleton-card">
            <div class="skeleton skeleton-thumb"></div>
            <div class="skeleton skeleton-badge"></div>
            <div class="skeleton skeleton-line med"></div>
            <div class="skeleton skeleton-line short"></div>
            <div class="skeleton skeleton-line full"></div>
          </div>`).join("");
      }
      try {
        const params = {};
        if (filterForm?.from?.value) params.from = new Date(filterForm.from.value).toISOString();
        if (filterForm?.to?.value) params.to = new Date(filterForm.to.value).toISOString();
        const data = await gymService.listClasses(params);
        currentClasses = data;
        renderClasses(data);
        setStatus(`Clases cargadas: ${data.length}.`);
      } catch (err) {
        console.error(err);
        setStatus(err.message || "No se pudieron cargar las clases.", true);
      }
    };

    classList?.addEventListener("click", async (e) => {
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
          const [reservations, members, trainers] = await Promise.all([
            gymService.listReservations(id),
            authService.listByRole("member").catch(() => []),
            authService.listByRole("trainer").catch(() => []),
          ]);
          const userMap = {};
          [...members, ...trainers].forEach((u) => { userMap[u.id] = u; });
          if (resTitle) resTitle.textContent = `Reservas clase ${id}`;
          renderReservations(reservations, userMap);
          if (resStatus) resStatus.textContent = `${reservations.length} reservas encontradas.`;
        }

        if (action === "edit") {
          const cls = currentClasses.find(c => c.id === id);
          if (!cls) return;
          const editCard = document.querySelector("#admin-edit-card");
          const editForm = document.querySelector("#admin-edit-class");
          if (!editCard || !editForm) return;

          editForm.classId.value = cls.id;
          editForm.classTypeId.value = cls.class_type_id;
          editForm.trainerId.value = cls.trainer_user_id || "";
          editForm.date.value = cls.starts_at.slice(0, 10);
          editForm.start.value = cls.starts_at.slice(11, 16);
          editForm.end.value = cls.ends_at.slice(11, 16);
          editForm.room.value = cls.location || "";
          editForm.instructor.value = cls.instructor_name || "";
          editForm.capacity.value = cls.capacity;
          editForm.description.value = cls.description || "";

          editCard.style.display = "block";
          editCard.scrollIntoView({ behavior: "smooth" });
        }

        if (action === "delete") {
          const confirmed = confirm("¿Seguro que quieres eliminar esta clase?");
          if (!confirmed) return;
          toggle(true, "Eliminando...");
          await gymService.deleteClass(id);
          renderReservations([]);
          if (resTitle) resTitle.textContent = "Reservas";
          await loadClasses();
        }
      } catch (err) {
        if (resStatus) resStatus.textContent = err.message || "Error al procesar.";
      } finally {
        toggle(false);
      }
    });

    document.querySelector("#admin-edit-cancel")?.addEventListener("click", () => {
      const editCard = document.querySelector("#admin-edit-card");
      if (editCard) editCard.style.display = "none";
    });

    document.querySelector("#admin-edit-class")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const editForm = e.target;
      const editMsg = document.querySelector("#admin-edit-msg");
      const btn = editForm.querySelector("button[type='submit']");
      const toggle = (isLoading) => {
        btn.disabled = isLoading;
        if (!btn.dataset.label) btn.dataset.label = btn.textContent;
        btn.textContent = isLoading ? "Guardando..." : btn.dataset.label;
      };

      const id = Number(editForm.classId.value);
      const date = editForm.date.value;
      const startTime = editForm.start.value;
      const endTime = editForm.end.value;

      try {
        toggle(true);
        await gymService.updateClass(id, {
          class_type_id: Number(editForm.classTypeId.value),
          trainer_user_id: Number(editForm.trainerId.value),
          starts_at: new Date(`${date}T${startTime}`).toISOString(),
          ends_at: new Date(`${date}T${endTime}`).toISOString(),
          capacity: Number(editForm.capacity.value),
          location: editForm.room.value.trim() || null,
          instructor_name: editForm.instructor.value.trim() || null,
          description: editForm.description.value.trim() || null,
        });
        if (editMsg) editMsg.textContent = "Clase actualizada correctamente.";
        await loadClasses();
      } catch (err) {
        if (editMsg) editMsg.textContent = err.message || "No se pudo actualizar la clase.";
      } finally {
        toggle(false);
      }
    });

    refreshBtn?.addEventListener("click", () => loadClasses());

    filterForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      loadClasses();
    });

    createForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (createMsg) createMsg.textContent = "";
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
      const trainerId = createForm.trainerId.value ? Number(createForm.trainerId.value) : null;
      const location = createForm.room.value.trim();
      const instructor = createForm.instructor.value.trim();
      const description = createForm.description.value.trim();

      if (!classTypes.length) {
        if (createMsg) createMsg.textContent = "Primero crea un tipo de clase.";
        return;
      }

      if (!date || !startTime || !endTime || !classTypeId || !capacity || !trainerId) {
        if (createMsg) createMsg.textContent = "Completa tipo, trainer, fecha, horas y capacidad.";
        return;
      }

      try {
        toggle(true, "Creando...");
        await gymService.createClass({
          class_type_id: Number(classTypeId),
          trainer_user_id: trainerId,
          starts_at: new Date(`${date}T${startTime}`).toISOString(),
          ends_at: new Date(`${date}T${endTime}`).toISOString(),
          capacity,
          location,
          instructor_name: instructor || null,
          description: description || null,
        });
        createForm.reset();
        if (createMsg) createMsg.textContent = "Clase creada correctamente.";
        await loadClasses();
      } catch (err) {
        if (createMsg) createMsg.textContent = err.message || "No se pudo crear la clase.";
      } finally {
        toggle(false);
      }
    });

    document.querySelector("#admin-create-staff")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const staffMsg = document.querySelector("#admin-staff-msg");
      const btn = form.querySelector("button[type='submit']");
      const toggle = (isLoading) => {
        btn.disabled = isLoading;
        if (!btn.dataset.label) btn.dataset.label = btn.textContent;
        btn.textContent = isLoading ? "Creando..." : btn.dataset.label;
      };

      try {
        toggle(true);
        await authService.createStaff({
          firstName: form.firstName.value.trim(),
          lastName: form.lastName.value.trim(),
          email: form.email.value.trim(),
          password: form.password.value,
          phone: form.phone.value.trim() || undefined,
          role: "trainer",
        });
        form.reset();
        if (staffMsg) {
          staffMsg.textContent = "Entrenador creado correctamente.";
          staffMsg.style.color = "#2be7c6";
        }
        const updatedTrainers = await authService.listByRole("trainer").catch(() => []);
        document.querySelectorAll("select[name='trainerId']").forEach(select => {
          const currentVal = select.value;
          select.innerHTML = `<option value="" disabled selected hidden>Elige trainer</option>` +
            updatedTrainers.map(t => `<option value="${t.id}">${t.first_name || t.name} (ID: ${t.id})</option>`).join("");
          select.value = currentVal;
        });
      } catch (err) {
        if (staffMsg) {
          staffMsg.textContent = err.message || "No se pudo crear el entrenador.";
          staffMsg.style.color = "#fca5a5";
        }
      } finally {
        toggle(false);
      }
    });

    renderClasses(currentClasses);
    syncClassTypeSelects(classTypes);
    if (classTypeErrorEl) {
      classTypeErrorEl.textContent = classTypesError || (classTypes.length ? "" : "No hay tipos de clase todavía. Crea uno abajo.");
      if (classTypesError) classTypeErrorEl.style.color = "#fca5a5";
    }

  }, 0);

  return `
    <div class="screen">
      ${Navbar()}
      <main class="container">
        <section class="hero">
          <div class="card" style="display:flex; flex-direction:column; gap:18px;">
            <div class="kicker">ADMIN CONSOLE</div>
            <h2 class="h2">${name} · control visual</h2>
            <p class="sub">Gestiona clases con descripción, aforo y entrenadores.</p>

            <div class="admin-hero">
              <div class="floating-stat"><span class="lbl">Clases</span><span class="val">${classes.length}</span></div>
              <div class="floating-stat"><span class="lbl">Tipos disponibles</span><span class="val" id="admin-class-type-count">${classTypes.length}</span></div>
              <div class="floating-stat"><span class="lbl">Sesión</span><span class="val">${isOnline ? "Activa" : "Inicia sesión"}</span></div>
            </div>

            <div class="admin-grid">

              <!-- COLUMNA IZQUIERDA: filtro arriba + lista de clases abajo -->
              <div class="card admin-classes-card" style="display:flex; flex-direction:column; gap:12px;">
                <div class="admin-classes-header">
                  <!-- Filtrar clases ahora en posición principal (izquierda) -->
                  <div class="admin-filter-card" style="display:flex; flex-direction:column; gap:8px;">
                    <div class="kicker">Filtrar clases</div>
                    <form id="admin-class-filter" class="form admin-filter-form">
                      <div class="form-col">
                        <label>Desde</label>
                        <input name="from" type="datetime-local" />
                      </div>
                      <div class="form-col">
                        <label>Hasta</label>
                        <input name="to" type="datetime-local" />
                      </div>
                      <div class="admin-filter-actions">
                        <button class="btn btn-primary" type="submit">Filtrar</button>
                        <button class="btn btn-ghost" type="button" id="admin-class-refresh">Actualizar</button>
                      </div>
                    </form>
                    <div class="dim" id="admin-class-status">Conectado al servicio.</div>
                  </div>
                  <!-- Kicker "Clases" ahora en posición secundaria (derecha) -->
                  <div class="kicker" style="align-self:flex-start; padding-top:4px;">Clases</div>
                </div>
                <div class="class-gallery" id="admin-classes" style="margin-top:8px;">
                  ${initialClassList}
                </div>
              </div>

              <!-- COLUMNA DERECHA: crear clase + crear entrenador (más ancha ahora) -->
              <div class="admin-side-stack">
                <div class="card" style="display:flex; flex-direction:column; gap:12px;">
                  <div class="kicker">Crear clase</div>
                  <form id="admin-create-class" class="form" style="margin:0; display:flex; flex-direction:column; gap:10px; background:transparent; padding:0; flex:1;">
                    <label>Tipo de clase</label>
                    <select name="classTypeId" data-class-type-select="true" required ${classTypes.length ? "" : "disabled"}>${typeOptions}</select>
                    <div class="dim" id="admin-class-type-error" style="color:#fca5a5;">${classTypesError || ""}</div>
                    <label>Trainer</label>
                    <select name="trainerId" required>
                      <option value="" disabled selected hidden>Elige trainer</option>
                      ${trainerOptions}
                    </select>
                    <div class="admin-form-grid">
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
                    <label>Ubicación</label>
                    <input name="room" type="text" placeholder="Sala 1" />
                    <label>Coach visible</label>
                    <input name="instructor" type="text" placeholder="Nombre coach" />
                    <label>Capacidad</label>
                    <input name="capacity" type="number" min="1" placeholder="20" required />
                    <label>Descripción de la clase</label>
                    <textarea name="description" placeholder="Qué se hará, nivel, material, sensaciones..."></textarea>
                    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                      <button class="btn btn-primary" type="submit">Crear clase</button>
                      <span id="admin-create-msg" style="color:#2be7c6; font-weight:700;"></span>
                    </div>
                  </form>
                </div>

                <div class="card" style="display:flex; flex-direction:column; gap:10px;">
                  <div class="kicker">Crear entrenador</div>
                  <form id="admin-create-staff" class="form" style="margin:0; display:flex; flex-direction:column; gap:10px; background:transparent; padding:0;">
                    <div class="admin-form-grid">
                      <div class="form-col">
                        <label>Nombre</label>
                        <input name="firstName" type="text" placeholder="Juan" required />
                      </div>
                      <div class="form-col">
                        <label>Apellido</label>
                        <input name="lastName" type="text" placeholder="García" required />
                      </div>
                    </div>
                    <label>Email</label>
                    <input name="email" type="email" placeholder="juan@smartgym.com" required />
                    <label>Contraseña</label>
                    <input name="password" type="password" placeholder="Mínimo 6 caracteres" required />
                    <label>Teléfono</label>
                    <input name="phone" type="text" placeholder="600000000" />
                    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                      <button class="btn btn-primary" type="submit">Crear entrenador</button>
                      <span id="admin-staff-msg" style="font-weight:700;"></span>
                    </div>
                  </form>
                </div>
              </div>

            </div>
            <!-- RESERVAS -->
            <div class="card">
              <div class="kicker" id="admin-res-title">Reservas</div>
              <div class="dim" id="admin-res-status">Pulsa en "Reservas" de una clase para ver los asistentes.</div>
              <ul class="list" id="admin-reservations" style="margin-top:10px;"></ul>
            </div>

            <!-- EDITAR CLASE -->
            <div class="card" style="display:none;" id="admin-edit-card">
              <div class="kicker">Editar clase</div>
              <form id="admin-edit-class" class="form" style="margin:0; display:flex; flex-direction:column; gap:10px; background:transparent; padding:0;">
                <input type="hidden" name="classId" />
                <label>Tipo de clase</label>
                <select name="classTypeId" data-class-type-select="true" required ${classTypes.length ? "" : "disabled"}>${typeOptions}</select>
                <label>Trainer</label>
                <select name="trainerId" required>
                  <option value="" disabled selected hidden>Elige trainer</option>
                  ${trainerOptions}
                </select>
                <div class="admin-form-grid">
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
                <label>Ubicación</label>
                <input name="room" type="text" placeholder="Sala 1" />
                <label>Coach visible</label>
                <input name="instructor" type="text" placeholder="Nombre coach" />
                <label>Capacidad</label>
                <input name="capacity" type="number" min="1" required />
                <label>Descripción</label>
                <textarea name="description" placeholder="Descripción de la clase..."></textarea>
                <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                  <button class="btn btn-primary" type="submit">Guardar cambios</button>
                  <button class="btn btn-ghost" type="button" id="admin-edit-cancel">Cancelar</button>
                  <span id="admin-edit-msg" style="color:#2be7c6; font-weight:700;"></span>
                </div>
              </form>
            </div>

          </div>
        </section>
      </main>
    </div>
  `;
}
