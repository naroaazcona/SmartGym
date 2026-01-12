import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { authService } from "../services/authService.js";
import { navigate } from "../router.js";

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

  setTimeout(() => {
    const form = document.querySelector("#create-class-form");
    const msg = document.querySelector("#create-class-msg");
    const err = document.querySelector("#create-class-error");
    const submitBtn = document.querySelector("#create-class-btn");

    const setStatus = (text = "", isError = false) => {
      if (msg) msg.textContent = !isError ? text : "";
      if (err) err.textContent = isError ? text : "";
    };

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      setStatus();
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Creando...";
      }

      const payload = {
        title: form.title.value.trim(),
        date: form.date.value,
        time: form.time.value,
        room: form.room.value.trim(),
        capacity: form.capacity.value ? Number(form.capacity.value) : null,
      };

      if (!payload.title || !payload.date || !payload.time) {
        setStatus("Completa titulo, fecha y hora.", true);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Crear clase";
        }
        return;
      }

      // Simulación local sin llamar al backend
      setTimeout(() => {
        setStatus(`Clase "${payload.title}" lista para enviar al backend.`, false);
        form.reset();
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Crear clase";
        }
      }, 400);
    });
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
            <p class="sub">Gestiona clases, pasa lista y revisa el aforo.</p>

            <div class="grid">
              <div class="card" style="grid-column: span 7;">
                <div class="kicker">Clases del día</div>
                <ul class="list">
                  <li class="row">
                    <div>
                      <div style="font-weight:1000;">18:00 · Fuerza & Core</div>
                      <div class="dim">16 plazas · 16 reservas</div>
                    </div>
                    <button class="btn btn-primary" disabled>Pasar lista</button>
                  </li>
                  <li class="row">
                    <div>
                      <div style="font-weight:1000;">19:30 · Mobility Reset</div>
                      <div class="dim">24 plazas · 13 reservas</div>
                    </div>
                    <button class="btn btn-ghost" disabled>Ver</button>
                  </li>
                </ul>
                <div class="footer">Reemplaza los items por datos reales de <code>src/api/gym.js</code>.</div>
              </div>

              <div class="card" style="grid-column: span 5;">
                <div class="kicker">Crear nueva clase</div>
                <form id="create-class-form" class="form" style="margin-top:8px; display:flex; flex-direction:column; gap:10px;">
                  <label>Título</label>
                  <input name="title" type="text" placeholder="HIIT Nocturno" required />

                  <div class="form-row">
                    <div class="form-col">
                      <label>Fecha</label>
                      <input name="date" type="date" required />
                    </div>
                    <div class="form-col">
                      <label>Hora</label>
                      <input name="time" type="time" required />
                    </div>
                  </div>

                  <div class="form-row">
                    <div class="form-col">
                      <label>Sala</label>
                      <input name="room" type="text" placeholder="Sala 2" />
                    </div>
                    <div class="form-col">
                      <label>Capacidad</label>
                      <input name="capacity" type="number" min="1" placeholder="20" />
                    </div>
                  </div>

                  <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                    <button id="create-class-btn" class="btn btn-primary" type="submit">Crear clase</button>
                    <span id="create-class-msg" style="color:#0f7b3c; font-weight:700;"></span>
                  </div>
                  <div id="create-class-error" class="error"></div>
                </form>
              </div>

              <div class="card" style="grid-column: span 5;">
                <div class="kicker">Acciones rápidas</div>
                <div class="stats">
                  <div class="stat">
                    <div class="num">7</div>
                    <div class="lbl">check-ins pendientes</div>
                  </div>
                  <div class="stat">
                    <div class="num">2</div>
                    <div class="lbl">listas de espera</div>
                  </div>
                </div>
                <div class="mtop" style="display:flex; gap:10px; flex-wrap:wrap;">
                  <button class="btn btn-primary" disabled>Escanear QR</button>
                  <button class="btn btn-ghost" disabled>Incidencia</button>
                </div>
              </div>

              <div class="card" style="grid-column: span 12;">
                <div class="kicker">Notas</div>
                <p class="sub" style="margin-top:6px;">
                  Idea: aquí puedes mostrar asistentes por clase, toggles para presente/ausente, y un resumen al finalizar.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}
