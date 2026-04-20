import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { authService } from "../services/authService.js";
import { navigate } from "../router.js";
import { gymService } from "../services/gymService.js";

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const activeCount = (types = []) => types.filter((t) => t.is_active !== false).length;

export async function AdminClassTypesPage() {
  const me = await authService.loadSession().catch(() => authStore.me);
  if (!authStore.token || !me) {
    navigate("/login");
    return "";
  }
  if (me.role !== "admin") {
    navigate("/");
    return "";
  }

  const initialTypes = await gymService.listClassTypes({ include_inactive: true }).catch(() => []);

  setTimeout(() => {
    const listEl = document.querySelector("#admin-types-list");
    const countEl = document.querySelector("#admin-types-count");
    const createForm = document.querySelector("#admin-type-create-form");
    const createMsg = document.querySelector("#admin-type-create-msg");
    const editCard = document.querySelector("#admin-type-edit-card");
    const editForm = document.querySelector("#admin-type-edit-form");
    const editMsg = document.querySelector("#admin-type-edit-msg");
    const editCancel = document.querySelector("#admin-type-edit-cancel");
    let types = initialTypes.slice();

    const setMsg = (el, text, isError = false) => {
      if (!el) return;
      el.textContent = text;
      el.style.color = isError ? "#fca5a5" : "#2be7c6";
    };

    const render = () => {
      if (countEl) countEl.textContent = String(activeCount(types));
      if (!listEl) return;
      if (!types.length) {
        listEl.innerHTML = "<li class='admin-empty-row'>No hay tipos de clase.</li>";
        return;
      }
      listEl.innerHTML = types
        .map((t) => {
          const active = t.is_active !== false;
          return `
            <li class="admin-type-item">
              <div class="admin-type-item-head">
                <div>
                  <div class="admin-type-item-name">${esc(t.name)}</div>
                  <div class="admin-type-item-desc">${esc(t.description || "Sin descripcion")}</div>
                </div>
                <span class="admin-mini-chip ${active ? "is-active" : "is-off"}">${active ? "Activo" : "Inactivo"}</span>
              </div>
              <div class="admin-row-actions">
                <button class="btn btn-ghost" data-action="edit" data-id="${t.id}">Editar</button>
                <button class="btn btn-ghost" data-action="delete" data-id="${t.id}" ${active ? "" : "disabled"}>Eliminar</button>
              </div>
            </li>
          `;
        })
        .join("");
    };

    const load = async () => {
      types = await gymService.listClassTypes({ include_inactive: true }).catch(() => types);
      render();
    };

    createForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = createForm.name.value.trim();
      if (!name) {
        setMsg(createMsg, "El nombre es obligatorio.", true);
        return;
      }
      const btn = createForm.querySelector("button[type='submit']");
      btn.disabled = true;
      try {
        await gymService.createClassType({
          name,
          description: createForm.description.value.trim() || null,
        });
        createForm.reset();
        setMsg(createMsg, "Tipo creado correctamente.");
        await load();
      } catch (err) {
        setMsg(createMsg, err.message || "No se pudo crear el tipo.", true);
      } finally {
        btn.disabled = false;
      }
    });

    listEl?.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      if (!id) return;
      if (btn.dataset.action === "edit") {
        const item = types.find((t) => Number(t.id) === id);
        if (!item || !editCard || !editForm) return;
        editForm.classTypeId.value = item.id;
        editForm.name.value = item.name || "";
        editForm.description.value = item.description || "";
        setMsg(editMsg, "");
        editCard.style.display = "block";
        editCard.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (btn.dataset.action === "delete") {
        if (!confirm("Seguro que quieres eliminar este tipo de clase?")) return;
        btn.disabled = true;
        try {
          await gymService.deleteClassType(id);
          await load();
        } catch (err) {
          alert(err.message || "No se pudo eliminar el tipo.");
        } finally {
          btn.disabled = false;
        }
      }
    });

    editForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = Number(editForm.classTypeId.value);
      if (!id) return;
      const btn = editForm.querySelector("button[type='submit']");
      btn.disabled = true;
      try {
        await gymService.updateClassType(id, {
          name: editForm.name.value.trim(),
          description: editForm.description.value.trim() || null,
        });
        setMsg(editMsg, "Tipo actualizado correctamente.");
        await load();
      } catch (err) {
        setMsg(editMsg, err.message || "No se pudo actualizar el tipo.", true);
      } finally {
        btn.disabled = false;
      }
    });

    editCancel?.addEventListener("click", () => {
      if (editCard) editCard.style.display = "none";
    });

    render();
  }, 0);

  return `
    <div class="screen">
      ${Navbar()}
      <main class="container">
        <section class="hero">
          <div class="admin-types-layout">
            <div class="card admin-admin-panel admin-type-create-panel">
              <div class="kicker">ADMIN - TIPOS DE CLASE</div>
              <h2 class="h2">Gestion de tipos de clase</h2>
              <p class="sub">Crear, editar y eliminar tipos.</p>
              <form id="admin-type-create-form" class="form admin-type-form-fill">
                <label>Nombre</label>
                <input name="name" type="text" required />
                <label>Descripcion</label>
                <textarea name="description" class="admin-type-description"></textarea>
                <div class="admin-form-actions">
                  <button class="btn btn-primary" type="submit">Crear tipo</button>
                  <span id="admin-type-create-msg" class="admin-inline-msg"></span>
                </div>
              </form>
            </div>

            <div class="card admin-admin-panel">
              <div class="kicker">Listado</div>
              <h3 style="margin:0;">Tipos disponibles</h3>
              <div class="admin-inline-stats">
                <span class="admin-mini-chip">Activos: <strong id="admin-types-count">${activeCount(initialTypes)}</strong></span>
              </div>
              <ul class="list admin-types-list" id="admin-types-list"></ul>
            </div>
          </div>

          <div class="card" id="admin-type-edit-card" style="display:none; margin-top:12px;">
            <div class="kicker">Editar tipo</div>
            <form id="admin-type-edit-form" class="form admin-form-full">
              <input type="hidden" name="classTypeId" />
              <label>Nombre</label>
              <input name="name" type="text" required />
              <label>Descripcion</label>
              <textarea name="description"></textarea>
              <div class="admin-form-actions">
                <button class="btn btn-primary" type="submit">Guardar</button>
                <button class="btn btn-ghost" type="button" id="admin-type-edit-cancel">Cancelar</button>
                <span id="admin-type-edit-msg" class="admin-inline-msg"></span>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  `;
}
