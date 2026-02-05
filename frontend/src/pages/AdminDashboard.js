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

  const classTypes = await gymService.listClassTypes().catch(() => []);
  const classes = await gymService.listClasses().catch(() => []);

  const heroImages = {
    crossfit: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80",
    hiit: "https://images.unsplash.com/photo-1556817411-31ae72fa3ea0?auto=format&fit=crop&w=1200&q=80",
    mobility: "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=1200&q=80",
    spinning: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=1200&q=80",
    cycling: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=1200&q=80",
    strength: "https://images.unsplash.com/photo-1554344058-8d1d1bcdfaf8?auto=format&fit=crop&w=1200&q=80",
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
        ${cls.description ? `<p class="sub" style="margin:6px 0 4px; color:#e8edf6;">${cls.description}</p>` : ""}
        <div class="chip-row">
          <span class="chip">${cls.booked_count || 0} reservas</span>
          <span class="chip">Tipo ${cls.class_type_name || "-"}</span>
          <span class="chip">Trainer ${cls.trainer_user_id || "-"}</span>
        </div>
        <div class="cta-inline" style="margin-top:10px;">
          <button class="btn btn-primary" data-action="reservations" data-id="${cls.id}">Reservas</button>
          <button class="btn btn-ghost" data-action="delete" data-id="${cls.id}">Eliminar</button>
        </div>
      </article>
    `;
  };

  const initialClassList = classes.length
    ? classes.map(renderClassCard).join("")
    : "<p class='sub'>No hay clases cargadas.</p>";

  const typeOptions = [
    `<option value="" disabled selected hidden>Elige tipo</option>`,
    ...classTypes.map((t) => `<option value="${t.id}">${t.name}</option>`),
  ].join("");

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

    let currentClasses = classes.slice();

    const renderReservations = (items) => {
      if (!resList) return;
      if (!items.length) {
        resList.innerHTML = "<p class='sub'>Sin reservas para esta clase.</p>";
        return;
      }
      resList.innerHTML = items
        .map(
          (r) => `
          <li class="row">
            <span>#${r.id} · Usuario ${r.user_id}</span>
            <span class="pill">${r.status}</span>
          </li>`
        )
        .join("");
    };

    const renderClasses = (items) => {
      if (!classList) return;
      classList.innerHTML = items.length
        ? items.map(renderClassCard).join("")
        : "<p class='sub'>No hay clases con los filtros aplicados.</p>";
    };

    const setStatus = (txt, isError = false) => {
      if (!classStatus) return;
      classStatus.textContent = txt;
      classStatus.style.color = isError ? "#fca5a5" : "var(--muted)";
    };

    const loadClasses = async () => {
      setStatus("Cargando clases...");
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
          const reservations = await gymService.listReservations(id);
          if (resTitle) resTitle.textContent = `Reservas clase ${id}`;
          renderReservations(reservations);
          if (resStatus) resStatus.textContent = `${reservations.length} reservas encontradas.`;
        }
        if (action === "delete") {
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

    renderClasses(currentClasses);
  }, 0);

  return `
    <div class="screen">
      ${Navbar()}
      <main class="container">
        <section class="hero">
          <div class="card" style="display:flex; flex-direction:column; gap:18px;">
            <div class="kicker">ADMIN CONSOLE</div>
            <h2 class="h2">${name} · control visual</h2>
            <p class="sub">Gestiona clases con descripción, aforo y coach desde un panel más visual.</p>

            <div class="admin-hero">
              <div class="floating-stat"><span class="lbl">Clases</span><span class="val">${classes.length}</span></div>
              <div class="floating-stat"><span class="lbl">Tipos disponibles</span><span class="val">${classTypes.length}</span></div>
              <div class="floating-stat"><span class="lbl">Sesión</span><span class="val">${isOnline ? "Online" : "Demo"}</span></div>
            </div>

            <div class="admin-grid">
              <div class="card" style="display:flex; flex-direction:column; gap:12px;">
                <div class="kicker">Clases</div>
                <form id="admin-class-filter" class="form" style="margin:0; display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:10px; align-items:end; padding:0; background:transparent;">
                  <div class="form-col">
                    <label>Desde</label>
                    <input name="from" type="datetime-local" />
                  </div>
                  <div class="form-col">
                    <label>Hasta</label>
                    <input name="to" type="datetime-local" />
                  </div>
                  <button class="btn btn-primary" type="submit">Filtrar</button>
                  <button class="btn btn-ghost" type="button" id="admin-class-refresh">Actualizar</button>
                </form>
                <div class="dim" id="admin-class-status">Conectado al servicio.</div>
                <div class="class-gallery" id="admin-classes" style="margin-top:8px;">
                  ${initialClassList}
                </div>
              </div>

              <div class="card" style="display:grid; gap:12px; grid-template-columns:1fr;">
                <div class="class-visual">
                  <div class="overlay">
                    <div class="kicker">Nueva clase</div>
                    <div style="font-weight:1000; font-size:24px;">Foto + descripción</div>
                    <div class="chip-row">
                      <span class="chip">Coach visible</span>
                      <span class="chip">Aforo controlado</span>
                    </div>
                  </div>
                </div>
                <form id="admin-create-class" class="form" style="margin:0; display:flex; flex-direction:column; gap:10px; background:transparent; padding:0;">
                  <label>Tipo de clase</label>
                  <select name="classTypeId" required>${typeOptions}</select>

                  <div class="admin-form-grid">
                    <div class="form-col">
                      <label>Trainer ID</label>
                      <input name="trainerId" type="number" min="1" placeholder="ej. 5" required />
                    </div>
                    <div class="form-col">
                      <label>Capacidad</label>
                      <input name="capacity" type="number" min="1" placeholder="20" required />
                    </div>
                  </div>

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

                  <label>Descripción de la clase</label>
                  <textarea name="description" placeholder="Qué se hará, nivel, material, sensaciones..." ></textarea>

                  <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                    <button class="btn btn-primary" type="submit">Crear clase</button>
                    <span id="admin-create-msg" style="color:#2be7c6; font-weight:700;"></span>
                  </div>
                  <div class="dim">Nota: introduce el ID del entrenador (lo encuentras en auth-service).</div>
                </form>
              </div>
            </div>

            <div class="card" style="grid-column: span 2;">
              <div class="kicker" id="admin-res-title">Reservas</div>
              <div class="dim" id="admin-res-status">Pulsa en "Reservas" de una clase para ver los asistentes.</div>
              <ul class="list" id="admin-reservations" style="margin-top:10px;"></ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}
