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

  const classTypes = await gymService.listClassTypes().catch(() => []);
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

  const typeOptions = [
    `<option value="" disabled selected hidden>Elige tipo</option>`,
    ...classTypes.map((t) => `<option value="${t.id}">${t.name}</option>`),
  ].join("");

  const initialList = myClasses.length
    ? myClasses.map(renderCard).join("")
    : "<p class='sub'>No tienes clases asignadas hoy.</p>";

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
            <span>#${r.id} · Usuario ${r.user_id}</span>
            <span class="pill">${r.status}</span>
          </li>`
        )
        .join("");
    };

      const renderList = (items) => {
        if (!listEl) return;
        listEl.innerHTML = items.length
          ? items.map(renderCard).join("")
          : "<p class='sub'>No tienes clases asignadas.</p>";
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
          const reservations = await gymService.listReservations(id);
          if (resTitle) resTitle.textContent = `Reservas de la clase ${id}`;
          renderReservations(reservations);
          if (resStatus) resStatus.textContent = `${reservations.length} reservas encontradas`;
        }
        if (action === "delete") {
          toggle(true, "Eliminando...");
          await gymService.deleteClass(id);
          if (resTitle) resTitle.textContent = "Reservas de clase";
          renderReservations([]);
          await loadClasses();
        }
      } catch (err) {
        if (resStatus) resStatus.textContent = err.message || "Error al procesar.";
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
      const instructor = form.instructor.value.trim() || name;
      const description = form.description.value.trim();

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
            <h2 class="h2">${name} · turno de hoy</h2>
            <p class="sub">Gestiona tus clases, revisa reservas y crea sesiones nuevas.</p>

            <div class="grid">
              <div class="card" style="grid-column: span 7;">
                <div class="kicker">Clases del día</div>
                <div class="dim" id="trainer-status">Conectado al servicio.</div>
                <div class="class-gallery" id="trainer-classes" style="margin-top:8px;">
                  ${initialList}
                </div>
                <div class="mtop" style="display:flex; gap:10px; flex-wrap:wrap;">
                  <button class="btn btn-primary" id="trainer-refresh" type="button">Actualizar</button>
                </div>
              </div>

              <div class="card" style="grid-column: span 5;">
                <div class="kicker">Crear nueva clase</div>
                <form id="trainer-create-class" class="form" style="margin-top:8px; display:flex; flex-direction:column; gap:10px;">
                  <label>Tipo de clase</label>
                  <select name="classTypeId" required>${typeOptions}</select>

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
                  <input name="instructor" type="text" placeholder="${name}" />

                  <label>Descripción de la clase</label>
                  <textarea name="description" placeholder="Objetivo, material, sensaciones previstas"></textarea>

                  <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                    <button class="btn btn-primary" type="submit">Crear clase</button>
                    <span id="trainer-create-msg" style="color:#0f7b3c; font-weight:700;"></span>
                  </div>
                </form>
              </div>

              <div class="card" style="grid-column: span 12;">
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
