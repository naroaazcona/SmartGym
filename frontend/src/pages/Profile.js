import { Navbar } from "../components/Navbar.js";
import { authService } from "../services/authService.js";
import { authStore } from "../state/authStore.js";
import { navigate } from "../router.js";

const formatDateForInput = (value) => {
  if (!value) return "";
  return String(value).slice(0, 10);
};

const getLocalPhoneDigits = (value) => {
  const digits = String(value || "").replace(/[^\d]/g, "");
  if (!digits) return "";
  let local = digits;
  if (local.startsWith("0034")) local = local.slice(4);
  if (local.startsWith("34")) local = local.slice(2);
  local = local.replace(/^0+/, "");
  return local;
};

const normalizeEsPhone = (value) => {
  const digits = String(value || "").replace(/[^\d]/g, "");
  if (!digits) return "";

  let local = digits;
  if (local.startsWith("0034")) local = local.slice(4);
  if (local.startsWith("34")) local = local.slice(2);
  local = local.replace(/^0+/, "");

  return local ? `+34 ${local}` : "+34";
};

const attachPhoneSanitizer = (input) => {
  if (!input) return;
  input.setAttribute("inputmode", "numeric");
  input.setAttribute("pattern", "\\d*");
  input.addEventListener("input", () => {
    input.value = input.value.replace(/[^\d]/g, "");
  });
};

const friendlyError = (ex, fallback) => {
  const msg = ex?.message || "";
  if (/network/i.test(msg)) return "No hay conexion con el servidor.";
  return msg || fallback;
};

const prettyRole = (role) => {
  const r = String(role || "").toLowerCase();
  if (r === "admin") return "Administrador";
  if (r === "trainer") return "Entrenador";
  return "Miembro";
};

const prettyGender = (g) => {
  if (g === "female") return "Femenino";
  if (g === "male") return "Masculino";
  if (g === "other") return "Otro / Prefiero no decir";
  return "-";
};

export async function ProfilePage() {
  if (!authStore.token) {
    navigate("/login");
    return "";
  }

  try {
    await authService.loadSession();
  } catch {
    /* si falla, usamos el estado actual */
  }

  if (!authStore.me) {
    navigate("/login");
    return "";
  }

  const me = authStore.me || {};
  const profile = me.profile || {};

  const birthDate = formatDateForInput(profile.birthDate);
  const phoneDisplay = normalizeEsPhone(profile.phone) || profile.phone || "-";
  const phoneDigits = getLocalPhoneDigits(profile.phone);

  const displayName =
    ((profile.firstName || profile.lastName) &&
      `${profile.firstName || ""} ${profile.lastName || ""}`.trim()) ||
    me.name ||
    me.email ||
    "Tu cuenta";

  const initials = (displayName || "SG")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const metrics = [
    { label: "Altura", value: profile.heightCm ? `${profile.heightCm} cm` : "-", icon: "📏", tone: "yellow" },
    { label: "Peso", value: profile.weightKg ? `${profile.weightKg} kg` : "-", icon: "⚖️", tone: "red" },
    { label: "Género", value: prettyGender(profile.gender), icon: "🧬", tone: "green" },
  ];

  setTimeout(() => {
    const form = document.querySelector("#profile-form");
    const msg = document.querySelector("#profile-msg");
    const err = document.querySelector("#profile-error");
    const submitBtn = document.querySelector("#profile-save");

    const nameLabel = document.querySelectorAll("[data-profile-name]");
    const phoneLabel = document.querySelectorAll("[data-profile-phone]");
    const genderLabel = document.querySelectorAll("[data-profile-gender]");
    const birthLabel = document.querySelectorAll("[data-profile-birth]");
    const heightLabel = document.querySelectorAll("[data-profile-height]");
    const weightLabel = document.querySelectorAll("[data-profile-weight]");

    const setStatus = (text = "", isError = false) => {
      if (msg) msg.textContent = !isError ? text : "";
      if (err) err.textContent = isError ? text : "";
    };

    attachPhoneSanitizer(form?.phone);

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      setStatus();

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Guardando...";
      }

      const payload = {
        firstName: form.firstName.value.trim(),
        lastName: form.lastName.value.trim(),
        phone: normalizeEsPhone(form.phone.value) || null,
        birthDate: form.birthDate.value || null,
        gender: form.gender.value || null,
        heightCm: form.heightCm.value ? Number(form.heightCm.value) : null,
        weightKg: form.weightKg.value ? Number(form.weightKg.value) : null,
      };

      try {
        const updated = await authService.updateProfile(payload);
        const updatedProfile = updated?.profile || {};

        setStatus("Perfil actualizado correctamente.");

        const newName =
          ((updatedProfile.firstName || updatedProfile.lastName) &&
            `${updatedProfile.firstName || ""} ${updatedProfile.lastName || ""}`.trim()) ||
          updated?.name ||
          updated?.email ||
          "Tu cuenta";

        nameLabel?.forEach((n) => (n.textContent = newName));
        phoneLabel?.forEach((n) => (n.textContent = normalizeEsPhone(updatedProfile.phone) || "-"));
        genderLabel?.forEach((n) => (n.textContent = prettyGender(updatedProfile.gender)));
        birthLabel?.forEach((n) => (n.textContent = formatDateForInput(updatedProfile.birthDate) || "-"));
        heightLabel?.forEach((n) => (n.textContent = updatedProfile.heightCm ?? "-"));
        weightLabel?.forEach((n) => (n.textContent = updatedProfile.weightKg ?? "-"));
      } catch (ex) {
        setStatus(friendlyError(ex, "No se pudo actualizar el perfil"), true);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Guardar cambios";
        }
      }
    });
  }, 0);

  const metricCards = metrics
    .map(
      (m) => `
        <div class="metric-tile">
          <div class="metric-icon ${m.tone}">${m.icon}</div>
          <div class="metric-meta">
            <div class="lbl">${m.label}</div>
            <div class="val">${m.value}</div>
          </div>
        </div>
      `
    )
    .join("");

  return `
    <div class="bg-blobs"></div>

    <div class="screen">
      ${Navbar()}
      <main class="container">
        <section class="hero">
          <div class="profile-grid">

            <aside class="profile-card">
              <div class="profile-head">
                <div class="profile-avatar">${initials}</div>
                <div style="min-width:0;">
                  <div class="kicker">Perfil</div>
                  <h2 class="profile-name" data-profile-name>${displayName}</h2>
                  <p class="profile-email">${me.email || "Sin email"}</p>
                </div>
              </div>

              <div class="profile-chips">
                <span class="profile-chip" data-profile-phone>📞 <span class="mini">Tel</span> <b>${phoneDisplay}</b></span>
              </div>

              <div class="profile-metrics">
                ${metricCards}
              </div>
            </aside>

            <section class="profile-card">
              <div class="profile-section-title">
                <h3>Resumen</h3>
              </div>

              <div class="kv-grid">
                <div class="kv"><span>Nombre</span><span data-profile-name>${displayName}</span></div>
                <div class="kv"><span>Email</span><span>${me.email || "-"}</span></div>
                <div class="kv"><span>Teléfono</span><span data-profile-phone>${phoneDisplay}</span></div>
                <div class="kv"><span>Género</span><span data-profile-gender>${prettyGender(profile.gender)}</span></div>
                <div class="kv"><span>Nacimiento</span><span data-profile-birth>${birthDate || "-"}</span></div>
                <div class="kv"><span>Altura / Peso</span><span><span data-profile-height>${profile.heightCm ?? "-"}</span> cm · <span data-profile-weight>${profile.weightKg ?? "-"}</span> kg</span></div>
              </div>

              <div class="profile-section-title" style="margin-top:4px;">
                <h3>Editar perfil</h3>
              </div>

              <form id="profile-form" class="form profile-form">
                <div class="form-row">
                  <div class="form-col">
                    <label>Nombre</label>
                    <input name="firstName" type="text" autocomplete="given-name" value="${profile.firstName || ""}" required />
                  </div>
                  <div class="form-col">
                    <label>Apellidos</label>
                    <input name="lastName" type="text" autocomplete="family-name" value="${profile.lastName || ""}" required />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-col">
                    <label>Teléfono</label>
                    <div class="phone-group">
                      <span class="phone-prefix">+34</span>
                      <input name="phone" type="tel" autocomplete="tel" value="${phoneDigits}" />
                    </div>
                  </div>
                  <div class="form-col">
                    <label>Fecha de nacimiento</label>
                    <input name="birthDate" type="date" value="${birthDate}" />
                  </div>
                </div>

                <label>Género</label>
                <select name="gender">
                  <option value="" disabled ${profile.gender ? "" : "selected"} hidden>Elige una opción</option>
                  <option value="female" ${profile.gender === "female" ? "selected" : ""}>Femenino</option>
                  <option value="male" ${profile.gender === "male" ? "selected" : ""}>Masculino</option>
                  <option value="other" ${profile.gender === "other" ? "selected" : ""}>Otro / Prefiero no decir</option>
                </select>

                <div class="form-row">
                  <div class="form-col">
                    <label>Peso (kg)</label>
                    <input name="weightKg" type="number" min="1" step="0.1" value="${profile.weightKg ?? ""}" />
                  </div>
                  <div class="form-col">
                    <label>Altura (cm)</label>
                    <input name="heightCm" type="number" min="50" max="260" step="1" value="${profile.heightCm ?? ""}" />
                  </div>
                </div>

                <div class="profile-actions">
                  <button id="profile-save" class="btn btn-primary" type="submit">Guardar cambios</button>
                  <span id="profile-msg" class="profile-success"></span>
                </div>

                <div id="profile-error" class="error profile-error"></div>
              </form>
            </section>

          </div>
        </section>
      </main>
    </div>
  `;
}
