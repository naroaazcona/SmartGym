import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { authService } from "../services/authService.js";
import { navigate } from "../router.js";
import { trainingService } from "../services/trainingService.js";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatDate = (value) => {
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

const renderMemberCards = (members = []) => {
  if (!members.length) {
    return `
      <div class="empty-state" style="padding:32px 16px;">
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
                const dateLabel = escapeHtml(formatDate(log?.date || log?.createdAt));
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

          <div class="dim" style="margin-top:6px;">Ultima actividad: ${escapeHtml(formatDate(member?.last_activity_at))}</div>

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

export async function TrainerUsersPage() {
  const me = await authService.loadSession().catch(() => authStore.me);
  if (!authStore.token || !me) {
    navigate("/login");
    return "";
  }
  if (me.role && me.role !== "trainer") {
    navigate("/");
    return "";
  }

  const initialOverview = await trainingService
    .getCoachMembersOverview(6)
    .catch(() => ({ members: [], generatedAt: null }));
  const initialMembers = Array.isArray(initialOverview?.members) ? initialOverview.members : [];
  const initialGeneratedAt = initialOverview?.generatedAt || null;

  setTimeout(() => {
    const listEl = document.querySelector("#trainer-users-list");
    const statusEl = document.querySelector("#trainer-users-status");
    const countEl = document.querySelector("#trainer-users-count");
    const refreshBtn = document.querySelector("#trainer-users-refresh");

    let members = initialMembers.slice();
    let generatedAt = initialGeneratedAt;
    let signature = JSON.stringify(members);
    let loading = false;
    let pollTimer = null;

    const setStatus = (text, isError = false) => {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.style.color = isError ? "#b42318" : "var(--muted)";
    };

    const render = (items) => {
      if (listEl) listEl.innerHTML = renderMemberCards(items);
      if (countEl) countEl.textContent = `${items.length} usuarios`;
    };

    const load = async ({ silent = false } = {}) => {
      if (loading) return;
      loading = true;

      if (!silent) setStatus("Actualizando usuarios...");
      if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.textContent = "Actualizando...";
      }

      try {
        const res = await trainingService.getCoachMembersOverview(6);
        const nextMembers = Array.isArray(res?.members) ? res.members : [];
        const nextGeneratedAt = res?.generatedAt || null;
        const nextSignature = JSON.stringify(nextMembers);
        const changed = nextSignature !== signature;

        members = nextMembers;
        generatedAt = nextGeneratedAt;
        signature = nextSignature;
        render(members);

        if (!silent || changed) {
          setStatus(`Sincronizado: ${formatDate(generatedAt)}.`);
        }
      } catch (err) {
        if (!silent) {
          setStatus(err?.message || "No se pudo cargar el listado de usuarios.", true);
        }
      } finally {
        loading = false;
        if (refreshBtn) {
          refreshBtn.disabled = false;
          refreshBtn.textContent = "Actualizar";
        }
      }
    };

    const startPolling = () => {
      if (pollTimer) window.clearInterval(pollTimer);
      pollTimer = window.setInterval(() => {
        if (!listEl || !document.body.contains(listEl)) {
          window.clearInterval(pollTimer);
          pollTimer = null;
          return;
        }
        load({ silent: true }).catch(() => {});
      }, 8000);
    };

    refreshBtn?.addEventListener("click", () => load({ silent: false }));
    render(members);
    setStatus(`Sincronizado: ${formatDate(generatedAt)}.`);
    startPolling();
  }, 0);

  return `
    <div class="bg-blobs"></div>
    <div class="screen">
      ${Navbar()}
      <main style="width:100%; padding:14px 16px 26px;">
        <section style="width:100%;">
          <div class="card" style="width:100%; min-height:calc(100vh - 140px); display:flex; flex-direction:column; gap:12px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
              <div>
                <div class="kicker">Usuarios</div>
                <h2 class="h2" style="margin:6px 0 2px;">Usuarios registrados</h2>
                <p class="sub" style="margin:0;">Vista completa con preferencias de formulario y ejercicios registrados.</p>
              </div>
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <span class="badge" id="trainer-users-count">${initialMembers.length} usuarios</span>
                <button class="btn btn-ghost" id="trainer-users-refresh" type="button">Actualizar</button>
              </div>
            </div>

            <div class="dim" id="trainer-users-status">Sincronizado: ${escapeHtml(formatDate(initialGeneratedAt))}.</div>

            <div id="trainer-users-list" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:10px;">
              ${renderMemberCards(initialMembers)}
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}

