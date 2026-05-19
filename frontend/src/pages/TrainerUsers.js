import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { authService } from "../services/authService.js";
import { navigate } from "../router.js";
import { trainingService } from "../services/trainingService.js";
import { escapeHtml } from "./memberHelpers.js";

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

const AVATAR_PALETTES = [
  ["#2563eb", "#1e3a8a"],
  ["#10b981", "#064e3b"],
  ["#6366f1", "#312e81"],
  ["#f59e0b", "#78350f"],
  ["#8b5cf6", "#4c1d95"],
  ["#0ea5e9", "#0c4a6e"],
];

const avatarPalette = (id) => AVATAR_PALETTES[Math.abs(Number(id) || 0) % AVATAR_PALETTES.length];

const initials = (member = {}) => {
  const user = member?.user || {};
  const first = String(user.first_name || "").trim();
  const last = String(user.last_name || "").trim();
  if (first && last) return (first[0] + last[0]).toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  const email = String(user.email || "");
  return email ? email[0].toUpperCase() : "?";
};

const prefChips = (value, fallback = "Sin definir") => {
  const items = toListValues(value);
  if (!items.length) {
    const text = String(value || "").trim();
    const label = text || fallback;
    return `<span style="font-size:13px; color:#5a6680; font-weight:600;">${escapeHtml(label)}</span>`;
  }
  return items
    .map(
      (item) =>
        `<span style="display:inline-flex; align-items:center; padding:4px 10px; border-radius:999px; background:rgba(37,99,235,.08); border:1px solid rgba(37,99,235,.18); font-size:12px; font-weight:600; color:#1e3a8a; white-space:nowrap;">${escapeHtml(item)}</span>`
    )
    .join("");
};

const renderMemberCards = (members = []) => {
  if (!members.length) {
    return `
      <div class="empty-state" style="padding:48px 16px; grid-column:1/-1;">
        <div class="empty-icon">
          <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <p class="empty-title">Sin usuarios para mostrar</p>
        <p class="empty-sub">Todavía no hay usuarios registrados.</p>
      </div>
    `;
  }

  return members
    .map((member) => {
      const user = member?.user || {};
      const preferences = member?.preferences || {};
      const logs = Array.isArray(member?.logs) ? member.logs : [];
      const role = String(user.role || "member").toLowerCase();
      const roleLabel = role === "admin" ? "Admin" : role === "trainer" ? "Entrenador" : "Miembro";
      const roleBg =
        role === "admin"
          ? "rgba(239,68,68,.10); border-color:rgba(239,68,68,.22); color:#991b1b;"
          : role === "trainer"
          ? "rgba(37,99,235,.10); border-color:rgba(37,99,235,.22); color:#1e3a8a;"
          : "rgba(16,185,129,.10); border-color:rgba(16,185,129,.22); color:#065f46;";

      const [avatarBg, avatarFg] = avatarPalette(user.id);
      const logsTotal = Number(member?.logs_total || logs.length || 0);

      const pref = {
        goal: prefChips(preferences.goal, "Sin objetivo"),
        training: prefChips(preferences.preferred_training, "Sin preferencia"),
        injuries: prefChips(preferences.injuries, "Sin lesiones"),
        equipment: prefChips(preferences.available_equipment, "Sin especificar"),
      };

      const renderLog = (log) => {
        const title = escapeHtml(log?.title || "Entrenamiento");
        const dateLabel = escapeHtml(formatDate(log?.date || log?.createdAt));
        const duration = Number(log?.duration_min || 0);
        return `
          <div style="display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:10px; background:rgba(255,255,255,.85); border:1px solid rgba(24,24,27,.08);">
            <div style="width:32px; height:32px; border-radius:8px; background:rgba(37,99,235,.08); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <svg width="15" height="15" fill="none" stroke="#2563eb" stroke-width="2.2" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:13px; font-weight:500; color:#18181b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${title}</div>
              <div style="font-size:11px; color:#5a6680; margin-top:1px;">${dateLabel}${duration > 0 ? ` · ${duration} min` : ""}</div>
            </div>
          </div>`;
      };

      const visibleLogs = logs.slice(0, 4);
      const extraLogs = logs.slice(4);
      const extraCount = logsTotal > 4 ? logsTotal - 4 : 0;
      const cardId = escapeHtml(String(user.id || member?.id || Math.random()));

      const logsHtml = logs.length
        ? visibleLogs.map(renderLog).join("") +
          (extraLogs.length
            ? `<div id="tu-extra-${cardId}" style="display:none; flex-direction:column; gap:8px;">${extraLogs.map(renderLog).join("")}</div>`
            : "")
        : `<div style="padding:12px; text-align:center; color:#5a6680; font-size:13px; font-weight:600; background:rgba(255,255,255,.5); border-radius:10px; border:1px dashed rgba(13,26,45,.1);">Sin ejercicios registrados</div>`;

      return `
        <article id="tu-card-${cardId}" style="border:1px solid rgba(13,26,45,.11); border-radius:18px; background:linear-gradient(175deg, #ffffff 0%, #f5f8ff 100%); box-shadow:0 8px 24px rgba(13,26,45,.10); display:flex; flex-direction:column; overflow:hidden; transition:transform .16s ease, box-shadow .16s ease, grid-column .2s ease;" onmouseenter="if(!this.dataset.expanded)this.style.transform='translateY(-3px)',this.style.boxShadow='0 16px 36px rgba(13,26,45,.16)'" onmouseleave="if(!this.dataset.expanded)this.style.transform='',this.style.boxShadow='0 8px 24px rgba(13,26,45,.10)'">

          <!-- Header con avatar -->
          <div style="padding:18px 18px 14px; display:flex; gap:14px; align-items:flex-start; border-bottom:1px solid rgba(13,26,45,.07);">
            <div style="width:52px; height:52px; border-radius:14px; background:linear-gradient(135deg, ${avatarBg}, ${avatarBg}cc); display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:700; color:${avatarFg}; flex-shrink:0; border:2px solid rgba(255,255,255,.8); box-shadow:0 6px 14px rgba(13,26,45,.14);">
              ${escapeHtml(initials(member))}
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:17px; font-weight:600; color:#18181b; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(displayMemberName(member))}</div>
              <div style="font-size:12.5px; color:#5a6680; margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(user.email || "Sin email")}</div>
              <div style="margin-top:6px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <span style="display:inline-flex; align-items:center; padding:3px 9px; border-radius:999px; border:1px solid; background:${roleBg} font-size:11px; font-weight:600; letter-spacing:.04em; text-transform:uppercase;">${escapeHtml(roleLabel)}</span>
                <span style="font-size:11px; color:#71717a; font-weight:700;">ID ${escapeHtml(String(user.id || "-"))}</span>
              </div>
            </div>
          </div>

          <!-- Stats strip -->
          <div style="display:grid; grid-template-columns:1fr 1fr; border-bottom:1px solid rgba(13,26,45,.07);">
            <div style="padding:10px 16px; border-right:1px solid rgba(13,26,45,.07);">
              <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.08em; color:#71717a;">Última actividad</div>
              <div style="font-size:13px; font-weight:500; color:#18181b; margin-top:2px;">${escapeHtml(formatDate(member?.last_activity_at))}</div>
            </div>
            <div style="padding:10px 16px;">
              <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.08em; color:#71717a;">Sesiones</div>
              <div style="font-size:22px; font-weight:700; color:#18181b; line-height:1.1;">${logsTotal}</div>
            </div>
          </div>

          <!-- Preferencias -->
          <div style="padding:14px 18px; display:flex; flex-direction:column; gap:12px; border-bottom:1px solid rgba(13,26,45,.07);">
            <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.1em; color:#71717a;">Preferencias</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <div style="background:rgba(255,255,255,.7); border:1px solid rgba(13,26,45,.09); border-radius:12px; padding:10px 12px;">
                <div style="font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#71717a; margin-bottom:6px;">Objetivo</div>
                <div style="display:flex; flex-wrap:wrap; gap:4px;">${pref.goal}</div>
              </div>
              <div style="background:rgba(255,255,255,.7); border:1px solid rgba(13,26,45,.09); border-radius:12px; padding:10px 12px;">
                <div style="font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#71717a; margin-bottom:6px;">Entrenamiento</div>
                <div style="display:flex; flex-wrap:wrap; gap:4px;">${pref.training}</div>
              </div>
              <div style="background:rgba(255,255,255,.7); border:1px solid rgba(13,26,45,.09); border-radius:12px; padding:10px 12px;">
                <div style="font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#71717a; margin-bottom:6px;">Lesiones</div>
                <div style="display:flex; flex-wrap:wrap; gap:4px;">${pref.injuries}</div>
              </div>
              <div style="background:rgba(255,255,255,.7); border:1px solid rgba(13,26,45,.09); border-radius:12px; padding:10px 12px;">
                <div style="font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:.08em; color:#f59e0b; margin-bottom:6px;">Equipamiento</div>
                <div style="display:flex; flex-wrap:wrap; gap:4px;">${pref.equipment}</div>
              </div>
            </div>
          </div>

          <!-- Logs -->
          <div style="padding:14px 18px; flex:1; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:2px;">
              <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.1em; color:#71717a;">Últimas sesiones</div>
            </div>
            ${logsHtml}
            ${extraCount > 0 ? `
            <button
              id="tu-toggle-${cardId}"
              data-card-id="${cardId}"
              type="button"
              style="margin-top:4px; display:flex; align-items:center; justify-content:center; gap:6px; width:100%; padding:9px 14px; border-radius:10px; border:1px solid rgba(24,24,27,.10); background:rgba(24,24,27,.04); color:#18181b; font-size:12px; font-weight:600; letter-spacing:.04em; cursor:pointer; transition:background .14s ease, transform .14s ease;"
              onmouseenter="this.style.background='rgba(24,24,27,.08)'; this.style.transform='translateY(-1px)';"
              onmouseleave="this.style.background='rgba(24,24,27,.04)'; this.style.transform='';">
              <svg id="tu-chevron-${cardId}" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="transition:transform .2s ease;"><path d="M6 9l6 6 6-6"/></svg>
              Ver ${extraCount} sesiones más
            </button>` : ""}
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

    const attachCardHandlers = (container) => {
      if (!container) return;
      container.querySelectorAll("[id^='tu-toggle-']").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.cardId;
          const card = container.querySelector(`#tu-card-${id}`);
          const extra = container.querySelector(`#tu-extra-${id}`);
          const chevron = container.querySelector(`#tu-chevron-${id}`);
          if (!card || !extra) return;

          const isExpanded = card.dataset.expanded === "1";
          if (isExpanded) {
            extra.style.display = "none";
            card.style.gridColumn = "";
            card.style.transform = "";
            card.style.boxShadow = "0 8px 24px rgba(13,26,45,.10)";
            card.style.borderColor = "rgba(13,26,45,.11)";
            card.dataset.expanded = "";
            if (chevron) chevron.style.transform = "";
            btn.innerHTML = btn.innerHTML.replace(/Ocultar sesiones/, `Ver ${extra.children.length} sesiones más`);
          } else {
            extra.style.display = "flex";
            extra.style.flexDirection = "column";
            extra.style.gap = "8px";
            card.style.gridColumn = "1 / -1";
            card.style.transform = "";
            card.style.boxShadow = "0 8px 24px rgba(24,24,27,.12)";
            card.style.borderColor = "rgba(37,99,235,.22)";
            card.dataset.expanded = "1";
            if (chevron) chevron.style.transform = "rotate(180deg)";
            btn.innerHTML = btn.innerHTML.replace(/Ver \d+ sesiones más/, "Ocultar sesiones");
          }
        });
      });
    };

    const render = (items) => {
      if (listEl) listEl.innerHTML = renderMemberCards(items);
      if (countEl) countEl.textContent = `${items.length} usuarios`;
      if (statusEl) statusEl.style.color = "#8a96a8";
      attachCardHandlers(listEl);
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
      <main style="width:100%; padding:16px 20px 32px;">
        <section style="width:100%;">
          <div class="card" style="width:100%; min-height:calc(100vh - 140px); display:flex; flex-direction:column; gap:16px;">

            <!-- Page header -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; padding-bottom:14px; border-bottom:1px solid rgba(13,26,45,.08);">
              <div>
                <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.14em; color:#71717a; margin-bottom:4px;">Panel de entrenador</div>
                <h2 class="h2" style="margin:0 0 6px;">Mis usuarios</h2>
                <p class="sub" style="margin:0; font-size:14px; color:#5a6680;">Preferencias de entrenamiento y sesiones registradas de cada miembro.</p>
              </div>
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:6px; padding:8px 14px; border-radius:999px; background:rgba(24,24,27,.05); border:1px solid rgba(24,24,27,.08);">
                  <div style="width:8px; height:8px; border-radius:50%; background:#10b981;"></div>
                  <span id="trainer-users-count" style="font-size:13px; font-weight:600; color:#18181b;">${initialMembers.length} usuarios</span>
                </div>
                <button class="btn btn-ghost" id="trainer-users-refresh" type="button" style="padding:8px 16px; font-size:12px;">Actualizar</button>
              </div>
            </div>

            <div id="trainer-users-status" style="font-size:12px; color:#71717a; font-weight:700; margin-top:-6px;">Sincronizado: ${escapeHtml(formatDate(initialGeneratedAt))}.</div>

            <div id="trainer-users-list" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(360px, 1fr)); gap:16px;">
              ${renderMemberCards(initialMembers)}
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}

