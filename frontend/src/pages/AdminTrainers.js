import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { authService } from "../services/authService.js";
import { gymService } from "../services/gymService.js";
import { navigate } from "../router.js";

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const fullName = (user) => {
  const first = String(user?.first_name || user?.firstName || "").trim();
  const last = String(user?.last_name || user?.lastName || "").trim();
  return `${first} ${last}`.trim() || String(user?.name || user?.email || "Entrenador");
};

const initials = (user) =>
  fullName(user)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "TR";

const fmtDate = (iso) =>
  new Date(iso).toLocaleString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export async function AdminTrainersPage() {
  const me = await authService.loadSession().catch(() => authStore.me);
  if (!authStore.token || !me) {
    navigate("/login");
    return "";
  }
  if (me.role !== "admin") {
    navigate("/");
    return "";
  }

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();

  const loadData = async () => {
    const [users, classes] = await Promise.all([
      authService.listUsers().catch(() => []),
      gymService.listClasses({ from }).catch(() => []),
    ]);
    const trainers = users.filter((u) => String(u.role) === "trainer");
    const map = new Map();
    classes.forEach((cls) => {
      const trainerId = Number(cls.trainer_user_id || 0);
      if (!trainerId) return;
      if (!map.has(trainerId)) map.set(trainerId, []);
      map.get(trainerId).push(cls);
    });
    return { trainers, classesByTrainer: map };
  };

  const initialData = await loadData();

  setTimeout(() => {
    const listEl = document.querySelector("#admin-trainers-list");
    const statusEl = document.querySelector("#admin-trainers-status");
    const refreshBtn = document.querySelector("#admin-trainers-refresh");
    let poll = null;

    const render = (data) => {
      if (!listEl) return;
      if (!data.trainers.length) {
        listEl.innerHTML = "<div class='empty-state'><p class='empty-title'>Sin entrenadores</p><p class='empty-sub'>No hay entrenadores registrados.</p></div>";
        return;
      }

      listEl.innerHTML = data.trainers
        .map((trainer) => {
          const trainerClasses = (data.classesByTrainer.get(Number(trainer.id)) || []).sort(
            (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
          );
          const nextClass = trainerClasses[0];
          const classesHtml = trainerClasses.length
            ? trainerClasses
                .map(
                  (cls) => `
                <li class="admin-trainer-class-row">
                  <div class="admin-trainer-class-copy">
                    <div class="admin-trainer-class-name">${esc(cls.class_type_name || "Clase")}</div>
                    <div class="admin-trainer-class-time">${fmtDate(cls.starts_at)}</div>
                  </div>
                  <span class="admin-mini-chip">${esc(cls.location || "Centro")}</span>
                </li>`
                )
                .join("")
            : "<li class='admin-empty-row'>Sin clases futuras asignadas.</li>";

          return `
            <article class="admin-trainer-card">
              <div class="admin-trainer-head">
                <div class="admin-trainer-profile">
                  <div class="admin-trainer-avatar">${esc(initials(trainer))}</div>
                  <div>
                    <div class="kicker">Entrenador</div>
                    <div class="admin-trainer-name">${esc(fullName(trainer))}</div>
                    <div class="admin-trainer-contact">${esc(trainer.email || "-")}</div>
                    <div class="admin-trainer-contact">${esc(trainer.phone || "Sin telefono")}</div>
                  </div>
                </div>
                <div class="admin-trainer-badges">
                  <span class="badge green">${trainerClasses.length} clases</span>
                  <span class="admin-mini-chip">${nextClass ? `Proxima: ${fmtDate(nextClass.starts_at)}` : "Sin proxima clase"}</span>
                </div>
              </div>
              <ul class="list admin-trainer-class-list">${classesHtml}</ul>
            </article>
          `;
        })
        .join("");
    };

    const setStatus = (text, isError = false) => {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.style.color = isError ? "#fca5a5" : "var(--muted)";
    };

    const refresh = async () => {
      setStatus("Actualizando entrenadores y clases...");
      try {
        const data = await loadData();
        render(data);
        const totalClasses = [...data.classesByTrainer.values()].reduce((acc, item) => acc + item.length, 0);
        setStatus(`Entrenadores: ${data.trainers.length} | Clases futuras: ${totalClasses}.`);
      } catch (err) {
        setStatus(err.message || "No se pudo actualizar la lista.", true);
      }
    };

    refreshBtn?.addEventListener("click", refresh);
    render(initialData);
    setStatus("Lista cargada. Se actualiza automaticamente cada 15 segundos.");

    poll = setInterval(refresh, 15000);
    const cleanup = () => {
      if (poll) clearInterval(poll);
      poll = null;
    };
    window.addEventListener("hashchange", cleanup, { once: true });
  }, 0);

  return `
    <div class="screen">
      ${Navbar()}
      <main class="container">
        <section class="hero">
          <div class="card admin-admin-panel">
            <div class="kicker">ADMIN - ENTRENADORES</div>
            <h2 class="h2">Listado de entrenadores y sus clases</h2>
            <p class="sub">Vista en tiempo real de todos los entrenadores y las clases que van a dar.</p>
            <div class="admin-toolbar">
              <button id="admin-trainers-refresh" class="btn btn-primary" type="button">Actualizar ahora</button>
              <span class="dim" id="admin-trainers-status"></span>
            </div>
            <div id="admin-trainers-list" class="admin-trainer-grid"></div>
          </div>
        </section>
      </main>
    </div>
  `;
}
