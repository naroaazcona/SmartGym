import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { authService } from "../services/authService.js";
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
  return `${first} ${last}`.trim() || String(user?.name || user?.email || "Usuario");
};

const onlyMembers = (items = []) => (Array.isArray(items) ? items.filter((u) => String(u.role) === "member") : []);
const initials = (user) =>
  fullName(user)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "SO";

const subscriptionLabel = (user) => {
  const plan = String(user?.subscription_plan || "").trim();
  if (!plan) return "Sin suscripcion";

  const status = String(user?.subscription_status || "").trim().toLowerCase();
  const statusMap = {
    active: "activa",
    trialing: "prueba",
    cancelled: "cancelada",
    canceled: "cancelada",
    past_due: "pendiente",
    incomplete: "incompleta",
    incomplete_expired: "expirada",
  };
  const statusLabel = statusMap[status] || status || "desconocido";
  return `${plan} (${statusLabel})`;
};

const subscriptionTone = (user) => {
  const status = String(user?.subscription_status || "").trim().toLowerCase();
  if (!status) return "is-empty";
  if (["active", "trialing"].includes(status)) return "is-active";
  if (["past_due", "incomplete"].includes(status)) return "is-warning";
  return "is-off";
};

export async function AdminUsersPage() {
  const me = await authService.loadSession().catch(() => authStore.me);
  if (!authStore.token || !me) {
    navigate("/login");
    return "";
  }
  if (me.role !== "admin") {
    navigate("/");
    return "";
  }

  const initialUsers = onlyMembers(await authService.listUsers().catch(() => []));

  setTimeout(() => {
    const listEl = document.querySelector("#admin-users-list-all");
    const countEl = document.querySelector("#admin-users-count-all");
    const searchEl = document.querySelector("#admin-users-search-all");
    const statusEl = document.querySelector("#admin-users-status-all");
    const refreshBtn = document.querySelector("#admin-users-refresh-all");
    const editCard = document.querySelector("#admin-user-edit-card");
    const editForm = document.querySelector("#admin-user-edit-form");
    const editCancel = document.querySelector("#admin-user-edit-cancel");
    const editMsg = document.querySelector("#admin-user-edit-msg");
    let users = initialUsers.slice();
    let pollHandle = null;

    const setMsg = (text, isError = false) => {
      if (!editMsg) return;
      editMsg.textContent = text;
      editMsg.style.color = isError ? "#fca5a5" : "#2be7c6";
    };

    const renderUsers = (filter = "") => {
      if (!listEl) return;
      const term = String(filter || "").trim().toLowerCase();
      const items = term
        ? users.filter((u) =>
            [fullName(u), u.email, u.role, u.subscription_plan, u.subscription_status]
              .join(" ")
              .toLowerCase()
              .includes(term)
          )
        : users;
      if (countEl) countEl.textContent = String(users.length);
      if (!items.length) {
        listEl.innerHTML = "<li class='admin-empty-row'>Sin resultados.</li>";
        return;
      }
      listEl.innerHTML = items
        .map(
          (u) => `
          <li class="admin-user-card">
            <div class="admin-user-head">
              <div class="admin-user-avatar">${esc(initials(u))}</div>
              <div class="admin-user-copy">
                <div class="admin-user-name">${esc(fullName(u))}</div>
                <div class="admin-user-email">${esc(u.email || "Sin email")}</div>
              </div>
              <span class="admin-mini-chip ${subscriptionTone(u)}">${esc(subscriptionLabel(u))}</span>
            </div>
            <div class="admin-user-foot">
              <div class="admin-user-contact">${esc(u.phone || "Sin telefono")}</div>
              <div class="admin-user-actions">
                <button class="btn btn-ghost" data-action="edit" data-id="${u.id}">Editar</button>
                <button class="btn btn-ghost" data-action="delete" data-id="${u.id}">Eliminar</button>
              </div>
            </div>
          </li>`
        )
        .join("");
    };

    const loadUsers = async () => {
      if (statusEl) {
        statusEl.textContent = "Actualizando usuarios desde base de datos...";
        statusEl.style.color = "var(--muted)";
      }
      try {
        users = onlyMembers(await authService.listUsers());
        renderUsers(searchEl?.value || "");
        if (statusEl) {
          statusEl.textContent = `Socios cargados: ${users.length}.`;
          statusEl.style.color = "var(--muted)";
        }
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = err.message || "No se pudieron cargar usuarios.";
          statusEl.style.color = "#fca5a5";
        }
      }
    };

    const openEdit = (user) => {
      if (!editCard || !editForm) return;
      editForm.userId.value = user.id;
      editForm.firstName.value = user.first_name || "";
      editForm.lastName.value = user.last_name || "";
      editForm.email.value = user.email || "";
      editForm.phone.value = user.phone || "";
      setMsg("");
      editCard.style.display = "block";
      editCard.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    listEl?.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      if (!id) return;
      if (btn.dataset.action === "edit") {
        const user = users.find((item) => Number(item.id) === id);
        if (user) openEdit(user);
        return;
      }
      if (btn.dataset.action === "delete") {
        if (!confirm("Seguro que quieres eliminar este usuario?")) return;
        btn.disabled = true;
        try {
          await authService.deleteUser(id);
          await loadUsers();
          if (editCard) editCard.style.display = "none";
        } catch (err) {
          alert(err.message || "No se pudo eliminar el usuario.");
        } finally {
          btn.disabled = false;
        }
      }
    });

    searchEl?.addEventListener("input", () => renderUsers(searchEl.value));
    refreshBtn?.addEventListener("click", () => loadUsers());

    editForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = Number(editForm.userId.value);
      if (!id) return;
      const btn = editForm.querySelector("button[type='submit']");
      btn.disabled = true;
      try {
        await authService.updateUser(id, {
          firstName: editForm.firstName.value.trim(),
          lastName: editForm.lastName.value.trim(),
          email: editForm.email.value.trim(),
          phone: editForm.phone.value.trim() || null,
        });
        setMsg("Usuario actualizado correctamente.");
        await loadUsers();
      } catch (err) {
        setMsg(err.message || "No se pudo actualizar el usuario.", true);
      } finally {
        btn.disabled = false;
      }
    });

    editCancel?.addEventListener("click", () => {
      if (editCard) editCard.style.display = "none";
    });

    loadUsers();
    pollHandle = setInterval(() => loadUsers(), 15000);

    const cleanup = () => {
      if (pollHandle) clearInterval(pollHandle);
      pollHandle = null;
    };
    window.addEventListener("hashchange", cleanup, { once: true });
  }, 0);

  return `
    <div class="screen">
      ${Navbar()}
      <main class="container">
        <section class="hero">
          <div class="card admin-admin-panel">
            <div class="kicker">ADMIN - USUARIOS</div>
            <h2 class="h2">Gestion de usuarios</h2>
            <p class="sub">Editar y eliminar informacion de los socios.</p>
            <div class="admin-toolbar">
              <button id="admin-users-refresh-all" class="btn btn-primary" type="button">Actualizar</button>
              <span class="dim" id="admin-users-status-all">Conectando con base de datos...</span>
            </div>
            <input id="admin-users-search-all" type="text" placeholder="Buscar por nombre, email o suscripcion..." />
            <div class="admin-inline-stats">
              <span class="admin-mini-chip">Socios: <strong id="admin-users-count-all">${initialUsers.length}</strong></span>
            </div>
            <ul class="list admin-user-grid" id="admin-users-list-all"></ul>
          </div>

          <div class="card" id="admin-user-edit-card" style="display:none; margin-top:12px;">
            <div class="kicker">Editar usuario</div>
            <form id="admin-user-edit-form" class="form admin-form-full">
              <input type="hidden" name="userId" />
              <div class="admin-form-grid">
                <div>
                  <label>Nombre</label>
                  <input name="firstName" type="text" required />
                </div>
                <div>
                  <label>Apellido</label>
                  <input name="lastName" type="text" required />
                </div>
                <div>
                  <label>Email</label>
                  <input name="email" type="email" required />
                </div>
                <div>
                  <label>Telefono</label>
                  <input name="phone" type="text" placeholder="+34 600000000" />
                </div>
              </div>
              <div class="admin-form-actions">
                <button class="btn btn-primary" type="submit">Guardar</button>
                <button class="btn btn-ghost" type="button" id="admin-user-edit-cancel">Cancelar</button>
                <span id="admin-user-edit-msg" class="admin-inline-msg"></span>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  `;
}
