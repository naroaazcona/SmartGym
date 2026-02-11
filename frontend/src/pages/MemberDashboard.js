import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { authService } from "../services/authService.js";
import { navigate } from "../router.js";
import { gymService } from "../services/gymService.js";

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

  const name =
    me?.profile?.firstName ||
    me?.firstName ||
    me?.name ||
    me?.email ||
    "Socio";

  const heroImages = {
    crossfit: "https://images.unsplash.com/photo-1558611848-73f7eb4001a1?auto=format&fit=crop&w=1400&q=80",
    hiit: "https://images.unsplash.com/photo-1554284126-aa88f22d8b74?auto=format&fit=crop&w=1400&q=80",
    mobility: "https://images.unsplash.com/photo-1546484959-f9a9c6c4b4c1?auto=format&fit=crop&w=1400&q=80",
    spinning: "https://images.unsplash.com/photo-1546484475-7e0b1cd5a33e?auto=format&fit=crop&w=1400&q=80",
    cycling: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=1400&q=80",
    strength: "https://images.unsplash.com/photo-1483721310020-03333e577078?auto=format&fit=crop&w=1400&q=80",
  };
  const imgForType = (type) => heroImages[String(type || "").toLowerCase()] || heroImages.strength;

  const classTypes = await gymService.listClassTypes().catch(() => []);
  const classes = await gymService.listClasses().catch(() => []);

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
    const occupancy = cls.capacity
      ? Math.round(((cls.booked_count || 0) / cls.capacity) * 100)
      : 0;
    return `
      <article class="class-card" data-class-id="${cls.id}">
        <div class="backdrop" style="background-image:url('${imgForType(cls.class_type_name)}')"></div>
        <div class="tag ${full ? "red" : "green"}">${cls.class_type_name || "Clase"}</div>
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
          <div>
            <div style="font-weight:1000; font-size:18px;">${fmtDate(cls.starts_at)}</div>
            <div class="dim">${cls.location || "Centro"} · ${
      cls.instructor_name ? `Coach ${cls.instructor_name}` : "Coach por asignar"
    }</div>
          </div>
          <span class="badge ${full ? "red" : "green"}">
            ${full ? "Completa" : `${cls.capacity - (cls.booked_count || 0)} libres`}
          </span>
        </div>
        ${cls.description ? `<p class="sub" style="margin:6px 0; color:#0b0f19;">${cls.description}</p>` : ""}
        <div class="pill" style="background: rgba(255,255,255,.08); border-color: var(--border);">
          <span class="dot ${full ? "off" : ""}"></span>
          Aforo ${cls.booked_count || 0}/${cls.capacity} (${occupancy}%)
        </div>
        <div class="mtop" style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-primary" data-action="reserve" data-id="${cls.id}" ${full ? "disabled" : ""}>Reservar</button>
          <button class="btn btn-ghost" data-action="cancel" data-id="${cls.id}">Cancelar mi reserva</button>
        </div>
        <div class="dim" id="member-msg-${cls.id}"></div>
      </article>
    `;
  };

  const initialCards = classes.length
    ? classes.map(renderCard).join("")
    : "<p class='sub'>No hay clases próximas.</p>";

  // Hook de eventos y recargas una vez renderizado el DOM
  setTimeout(() => {
    const listEl = document.querySelector("#member-classes");
    const statusEl = document.querySelector("#member-status");
    const refreshBtn = document.querySelector("#member-refresh");
    let currentClasses = classes.slice();

    const render = (items) => {
      if (!listEl) return;
      if (!items.length) {
        listEl.innerHTML = "<p class='sub'>No hay clases próximas.</p>";
        return;
      }
      listEl.innerHTML = items.map(renderCard).join("");
    };

    const setStatus = (txt, isError = false) => {
      if (!statusEl) return;
      statusEl.textContent = txt;
      statusEl.style.color = isError ? "#b42318" : "var(--muted)";
    };

    const load = async () => {
      setStatus("Cargando clases...");
      try {
        const data = await gymService.listClasses();
        currentClasses = data;
        render(currentClasses);
        setStatus(`Mostrando ${currentClasses.length} clases.`);
      } catch (err) {
        console.error(err);
        setStatus(err.message || "No se pudieron cargar las clases.", true);
      }
    };

    refreshBtn?.addEventListener("click", () => load());

    listEl?.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      const action = btn.dataset.action;
      const msgEl = document.querySelector(`#member-msg-${id}`);

      const toggle = (isLoading, label) => {
        btn.disabled = isLoading;
        if (!btn.dataset.label) btn.dataset.label = btn.textContent;
        btn.textContent = isLoading ? label : btn.dataset.label;
      };

      try {
        if (action === "reserve") {
          toggle(true, "Reservando...");
          await gymService.reserveClass(id);
          if (msgEl) msgEl.textContent = "Reserva confirmada.";
        }
        if (action === "cancel") {
          toggle(true, "Cancelando...");
          await gymService.cancelReservation(id);
          if (msgEl) msgEl.textContent = "Reserva cancelada.";
        }
        await load(); // refresca aforo
      } catch (err) {
        if (msgEl) msgEl.textContent = err.message || "Error al procesar.";
      } finally {
        toggle(false);
      }
    });

    render(currentClasses);
  }, 0);

  return `
    <div class="bg-blobs"></div>

    <div class="screen">
      ${Navbar()}
      <main class="container">
        <section class="hero">
          <div class="card" style="display:flex; flex-direction:column; gap:16px;">
            <div class="kicker">RESERVA DE CLASES</div>
            <h2 class="h2">Hola, ${name}</h2>
            <p class="sub">Elige tu clase y reserva en un click. Sin buscador: todo lo próximo ya está aquí.</p>

            <div class="card" style="background: var(--surface-2); border-color: var(--border); box-shadow:none; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
              <div class="dim" id="member-status">Conectado al servicio de clases.</div>
              <button class="btn btn-primary" type="button" id="member-refresh">Actualizar</button>
            </div>

            <div class="card" style="background: var(--surface-2); border-color: var(--border); box-shadow:none;">
              <div class="kicker">Clases disponibles</div>
              <div id="member-classes" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:12px; margin-top:12px;">
                ${initialCards}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}
