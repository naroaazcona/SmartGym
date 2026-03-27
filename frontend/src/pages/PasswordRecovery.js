import { Navbar } from "../components/Navbar.js";
import { authService } from "../services/authService.js";
import { navigate, showToast } from "../router.js";

const RECOVERY_FLOW_KEY = "smartgym_password_recovery_flow";
const RECOVERY_RESET_KEY = "smartgym_password_recovery_reset";

function readStorage(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

function clearRecoveryStorage() {
  sessionStorage.removeItem(RECOVERY_FLOW_KEY);
  sessionStorage.removeItem(RECOVERY_RESET_KEY);
}

export function PasswordRecoveryStartPage() {
  setTimeout(() => {
    const form = document.querySelector("#recovery-start-form");
    const btn = document.querySelector("#recovery-start-submit");
    const errorEl = document.querySelector("#recovery-start-error");

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errorEl) errorEl.textContent = "";

      const email = String(form.email.value || "").trim();
      const phone = String(form.phone.value || "").trim();
      if (!email || !phone) {
        if (errorEl) errorEl.textContent = "Introduce email y telefono.";
        return;
      }

      if (btn) {
        btn.disabled = true;
        btn.textContent = "Verificando...";
      }

      try {
        const data = await authService.startPasswordRecovery(email, phone);
        writeStorage(RECOVERY_FLOW_KEY, {
          requestId: Number(data.requestId),
          challengeCode: String(data.challengeCode || ""),
          expiresAt: data.expiresAt || null,
          email,
        });
        sessionStorage.removeItem(RECOVERY_RESET_KEY);
        navigate("/recuperar-codigo");
      } catch (ex) {
        if (errorEl) errorEl.textContent = ex.message || "No se pudo verificar la cuenta.";
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Continuar";
        }
      }
    });
  }, 0);

  return `
    <div class="bg-blobs"></div>
    <div class="screen">
      ${Navbar()}
      <main class="container">
        <section class="hero auth-hero">
          <div class="card form">
            <div class="kicker">Recuperar acceso</div>
            <h2 class="h2" style="margin:8px 0 4px;">Olvide mi contrasena</h2>
            <p class="sub">Introduce tu email y telefono para verificar tu cuenta.</p>

            <form id="recovery-start-form" style="margin-top:12px;">
              <label>Email</label>
              <input name="email" type="email" placeholder="tu@correo.com" required />

              <label>Telefono</label>
              <input name="phone" type="tel" placeholder="600000000" required />

              <div class="mtop" style="display:flex; gap:12px; flex-wrap:wrap;">
                <button id="recovery-start-submit" class="btn btn-primary" type="submit">Continuar</button>
                <a class="btn btn-ghost" href="#/login">Volver a login</a>
              </div>

              <div id="recovery-start-error" class="error"></div>
            </form>
          </div>
        </section>
      </main>
    </div>
  `;
}

export function PasswordRecoveryCodePage() {
  const flow = readStorage(RECOVERY_FLOW_KEY);
  if (!flow?.requestId) {
    navigate("/recuperar-password");
    return "";
  }

  setTimeout(() => {
    const form = document.querySelector("#recovery-code-form");
    const btn = document.querySelector("#recovery-code-submit");
    const showCodeBtn = document.querySelector("#recovery-show-code");
    const errorEl = document.querySelector("#recovery-code-error");
    const showCodeMessage = () => {
      if (!flow.challengeCode) return;
      showToast(`Codigo temporal: ${flow.challengeCode}`, "success", 4800);
    };
    showCodeBtn?.addEventListener("click", showCodeMessage);
    setTimeout(showCodeMessage, 180);

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errorEl) errorEl.textContent = "";

      const code = String(form.code.value || "").trim();
      if (!code) {
        if (errorEl) errorEl.textContent = "Introduce el codigo de verificacion.";
        return;
      }

      if (btn) {
        btn.disabled = true;
        btn.textContent = "Validando...";
      }

      try {
        const data = await authService.verifyPasswordRecovery(flow.requestId, code);
        writeStorage(RECOVERY_RESET_KEY, {
          requestId: Number(data.requestId || flow.requestId),
          resetToken: String(data.resetToken || ""),
        });
        navigate("/cambiar-password");
      } catch (ex) {
        if (errorEl) errorEl.textContent = ex.message || "Codigo no valido.";
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Verificar codigo";
        }
      }
    });
  }, 0);

  return `
    <div class="bg-blobs"></div>
    <div class="screen">
      ${Navbar()}
      <main class="container">
        <section class="hero auth-hero">
          <div class="card form">
            <div class="kicker">Paso 2 de 3</div>
            <h2 class="h2" style="margin:8px 0 4px;">Verifica el codigo</h2>
            <p class="sub">El codigo temporal aparece como mensaje y se oculta automaticamente.</p>
            <div class="mtop" style="display:flex; gap:10px; flex-wrap:wrap;">
              <button id="recovery-show-code" class="btn btn-ghost" type="button">Mostrar codigo otra vez</button>
            </div>
            <p class="sub">Introduce ese codigo para poder cambiar tu contrasena.</p>

            <form id="recovery-code-form" style="margin-top:12px;">
              <label>Codigo de verificacion</label>
              <input name="code" type="text" inputmode="numeric" placeholder="123456" required />

              <div class="mtop" style="display:flex; gap:12px; flex-wrap:wrap;">
                <button id="recovery-code-submit" class="btn btn-primary" type="submit">Verificar codigo</button>
                <a class="btn btn-ghost" href="#/recuperar-password">Volver</a>
              </div>

              <div id="recovery-code-error" class="error"></div>
            </form>
          </div>
        </section>
      </main>
    </div>
  `;
}

export function PasswordRecoveryResetPage() {
  const resetCtx = readStorage(RECOVERY_RESET_KEY);
  if (!resetCtx?.requestId || !resetCtx?.resetToken) {
    navigate("/recuperar-password");
    return "";
  }

  setTimeout(() => {
    const form = document.querySelector("#recovery-reset-form");
    const btn = document.querySelector("#recovery-reset-submit");
    const errorEl = document.querySelector("#recovery-reset-error");
    const okEl = document.querySelector("#recovery-reset-success");

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errorEl) errorEl.textContent = "";
      if (okEl) okEl.textContent = "";

      const password = String(form.password.value || "");
      const confirm = String(form.confirmPassword.value || "");

      if (password.length < 6) {
        if (errorEl) errorEl.textContent = "La contrasena debe tener al menos 6 caracteres.";
        return;
      }
      if (password !== confirm) {
        if (errorEl) errorEl.textContent = "Las contrasenas no coinciden.";
        return;
      }

      if (btn) {
        btn.disabled = true;
        btn.textContent = "Actualizando...";
      }

      try {
        await authService.resetPasswordRecovery(
          resetCtx.requestId,
          resetCtx.resetToken,
          password
        );
        clearRecoveryStorage();
        if (okEl) okEl.textContent = "Contrasena actualizada. Redirigiendo a login...";
        setTimeout(() => navigate("/login"), 1400);
      } catch (ex) {
        if (errorEl) errorEl.textContent = ex.message || "No se pudo actualizar la contrasena.";
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Cambiar contrasena";
        }
      }
    });
  }, 0);

  return `
    <div class="bg-blobs"></div>
    <div class="screen">
      ${Navbar()}
      <main class="container">
        <section class="hero auth-hero">
          <div class="card form">
            <div class="kicker">Paso 3 de 3</div>
            <h2 class="h2" style="margin:8px 0 4px;">Nueva contrasena</h2>
            <p class="sub">Establece una contrasena nueva para tu cuenta.</p>

            <form id="recovery-reset-form" style="margin-top:12px;">
              <label>Nueva contrasena</label>
              <input name="password" type="password" placeholder="********" required />

              <label>Repite la contrasena</label>
              <input name="confirmPassword" type="password" placeholder="********" required />

              <div class="mtop" style="display:flex; gap:12px; flex-wrap:wrap;">
                <button id="recovery-reset-submit" class="btn btn-primary" type="submit">Cambiar contrasena</button>
                <a class="btn btn-ghost" href="#/login">Cancelar</a>
              </div>

              <div id="recovery-reset-success" style="margin-top:12px; font-weight:900; color:#0f7b3c;"></div>
              <div id="recovery-reset-error" class="error"></div>
            </form>
          </div>
        </section>
      </main>
    </div>
  `;
}
