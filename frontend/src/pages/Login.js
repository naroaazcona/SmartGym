import { Navbar } from "../components/Navbar.js";
import { authService } from "../services/authService.js";
import { authStore } from "../state/authStore.js";
import { navigate } from "../router.js";
import { CONFIG } from "../config.js";

const ALLOWED_EMAIL_PROVIDERS = ["gmail", "outlook", "yahoo"];

const isAllowedRegisterEmail = (email) => {
  const domain = String(email || "").toLowerCase().split("@")[1];
  if (!domain) return false;
  const provider = domain.split(".")[0];
  return ALLOWED_EMAIL_PROVIDERS.includes(provider);
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

const isStrongPassword = (value) => {
  const pass = String(value || "");
  if (pass.length < 8) return false;
  return /[A-Za-z]/.test(pass) && /\d/.test(pass);
};

const setLoading = (btn, isLoading, label = "") => {
  if (!btn) return;
  if (!btn.dataset.label) btn.dataset.label = btn.textContent;
  btn.disabled = isLoading;
  if (isLoading && label) btn.textContent = label;
  else btn.textContent = btn.dataset.label;
};

const friendlyError = (ex, fallback) => {
  const msg = ex?.message || "";
  if (/network/i.test(msg)) return "No hay conexión con el servidor.";
  return msg || fallback;
};

function navigateAfterAuth(role) {
  if (role === "admin") navigate("/admin");
  else if (role === "trainer") navigate("/trainer");
  else navigate("/");
}

function initGoogleSignIn(googleError, show) {
  if (!CONFIG.GOOGLE_CLIENT_ID || CONFIG.GOOGLE_CLIENT_ID.startsWith("TU_")) return;

  const waitForGSI = (retries = 20) => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        callback: async (response) => {
          if (googleError) googleError.textContent = "";
          try {
            const { me, isNew } = await authService.loginWithGoogle(response.credential);
            if (isNew) {
              // Rellenar datos adicionales antes de ir a suscripción
              const nameEl = document.querySelector("#gc-firstName");
              const lastEl = document.querySelector("#gc-lastName");
              if (nameEl && me?.profile?.firstName) nameEl.value = me.profile.firstName;
              if (lastEl && me?.profile?.lastName)  lastEl.value = me.profile.lastName;
              show("google-complete");
            } else {
              navigateAfterAuth(me?.role);
            }
          } catch (ex) {
            if (googleError) googleError.textContent = friendlyError(ex, "Error al iniciar sesión con Google.");
          }
        },
      });

      const btnContainer = document.querySelector("#google-btn-container");
      if (btnContainer) {
        window.google.accounts.id.renderButton(btnContainer, {
          type: "standard",
          shape: "rectangular",
          theme: "outline",
          text: "continue_with",
          size: "large",
          locale: "es",
          width: btnContainer.offsetWidth || 340,
        });
      }
    } else if (retries > 0) {
      setTimeout(() => waitForGSI(retries - 1), 150);
    }
  };

  waitForGSI();
}

export async function LoginPage() {
  setTimeout(() => {
    const tabs = document.querySelectorAll("[data-auth-tab]");
    const views = document.querySelectorAll("[data-auth-view]");
    const loginForm = document.querySelector("#login-form");
    const registerForm = document.querySelector("#register-form");
    const loginError = document.querySelector("#login-error");
    const registerError = document.querySelector("#register-error");
    const googleError = document.querySelector("#google-error");
    const loginBtn = document.querySelector("#login-submit");
    const forgotBtn = document.querySelector("#forgot-password-btn");
    const registerBtn = document.querySelector("#register-submit");
    let loginFailures = 0;
    let cooldownUntil = 0;

    const show = (mode) => {
      tabs.forEach((btn) => btn.classList.toggle("active", btn.dataset.authTab === mode));
      views.forEach((block) => block.classList.toggle("hidden", block.dataset.authView !== mode));
    };

    initGoogleSignIn(googleError, show);

    tabs.forEach((btn) => {
      btn.addEventListener("click", () => show(btn.dataset.authTab));
    });
    show("login");
    forgotBtn?.addEventListener("click", () => navigate("/recuperar-password"));

    attachPhoneSanitizer(registerForm?.phone);

    loginForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (loginError) loginError.textContent = "";

      const now = Date.now();
      if (cooldownUntil && now < cooldownUntil) {
        const remaining = Math.ceil((cooldownUntil - now) / 1000);
        loginError.textContent = `Demasiados intentos. Espera ${remaining}s para reintentar.`;
        if (loginBtn) {
          loginBtn.disabled = true;
          setTimeout(() => { if (loginBtn) loginBtn.disabled = false; }, Math.max(0, cooldownUntil - now));
        }
        return;
      }

      const email = loginForm.email.value.trim();
      const password = loginForm.password.value;

      if (!email || !password) {
        loginError.textContent = "Completa email y contraseña.";
        return;
      }

      setLoading(loginBtn, true, "Entrando...");

      try {
        const me = await authService.login(email, password);
        loginFailures = 0;
        cooldownUntil = 0;
        navigateAfterAuth(me?.role);
      } catch (ex) {
        loginFailures += 1;
        if (loginFailures >= 3) {
          cooldownUntil = Date.now() + 10000;
        }
        if (loginError) loginError.textContent = friendlyError(ex, "Error al iniciar sesión. Revisa credenciales.");
      }
      setLoading(loginBtn, false, "Entrar");
    });

    const googleCompleteForm = document.querySelector("#google-complete-form");
    const googleCompleteError = document.querySelector("#google-complete-error");
    const googleCompleteBtn = document.querySelector("#google-complete-submit");
    attachPhoneSanitizer(googleCompleteForm?.gc_phone);

    googleCompleteForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (googleCompleteError) googleCompleteError.textContent = "";

      const payload = {
        firstName:  googleCompleteForm.gc_firstName.value.trim(),
        lastName:   googleCompleteForm.gc_lastName.value.trim(),
        phone:      normalizeEsPhone(googleCompleteForm.gc_phone.value),
        birthDate:  googleCompleteForm.gc_birthDate.value,
        gender:     googleCompleteForm.gc_gender.value,
        heightCm:   googleCompleteForm.gc_heightCm.value ? Number(googleCompleteForm.gc_heightCm.value) : undefined,
        weightKg:   googleCompleteForm.gc_weightKg.value ? Number(googleCompleteForm.gc_weightKg.value) : undefined,
      };

      setLoading(googleCompleteBtn, true, "Guardando...");
      try {
        await authService.updateProfile(payload);
        const userId = authStore.me?.id;
        if (userId) localStorage.setItem(`onboarding_required_${userId}`, "1");
        localStorage.setItem("onboarding_required", "1");
        navigate("/suscripcion");
      } catch (ex) {
        if (googleCompleteError) googleCompleteError.textContent = friendlyError(ex, "Error al guardar los datos.");
      } finally {
        setLoading(googleCompleteBtn, false, "Continuar");
      }
    });

    registerForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (registerError) registerError.textContent = "";

      const email = registerForm.regEmail.value.trim();
      if (!isAllowedRegisterEmail(email)) {
        if (registerError) registerError.textContent = "Solo se permiten correos de Gmail, Outlook o Yahoo.";
        registerForm.regEmail.focus();
        return;
      }

      const password = registerForm.regPassword.value;
      if (!isStrongPassword(password)) {
        registerError.textContent = "La contraseña debe tener al menos 8 caracteres e incluir números.";
        registerForm.regPassword.focus();
        return;
      }

      const payload = {
        firstName: registerForm.firstName.value.trim(),
        lastName: registerForm.lastName.value.trim(),
        phone: normalizeEsPhone(registerForm.phone.value),
        birthDate: registerForm.birthDate.value,
        gender: registerForm.gender.value,
        heightCm: registerForm.heightCm.value ? Number(registerForm.heightCm.value) : undefined,
        weightKg: registerForm.weightKg.value ? Number(registerForm.weightKg.value) : undefined,
        email,
        password,
      };

      setLoading(registerBtn, true, "Creando...");

      try {
        await authService.register(payload);
        const userId = authStore.me?.id;
        if (userId) {
          localStorage.setItem(`onboarding_required_${userId}`, "1");
        }
        // Fallback global: evita perder el flujo si la sesión tarda en hidratarse tras volver de Stripe.
        localStorage.setItem("onboarding_required", "1");
        // Nuevo usuario -> primero pago de suscripcion con Stripe
        navigate("/suscripcion");
      } catch (ex) {
        if (registerError) registerError.textContent = friendlyError(ex, "Error al registrar. Revisa los datos.");
      } finally {
        setLoading(registerBtn, false, "Crear cuenta");
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
            <div class="kicker">Acceso</div>
            <h2 class="h2" style="margin:8px 0 4px;">Inicia sesión</h2>
            <p class="sub">¿No tienes cuenta? Pulsa en registrarse</p>

            <div class="auth-tabs">
              <button type="button" class="tab-btn active" data-auth-tab="login">Iniciar sesión</button>
              <button type="button" class="tab-btn" data-auth-tab="register">Registrarse</button>
            </div>

            <div data-auth-view="login">
              <form id="login-form">
                <label>Email</label>
                <input name="email" type="email" autocomplete="email" placeholder="tu@correo.com" required />

                <label>Contraseña</label>
                <input name="password" type="password" autocomplete="current-password" placeholder="********" required />

                <div class="mtop" style="display:flex; gap:12px; flex-wrap:wrap;">
                  <button id="login-submit" class="btn btn-primary" type="submit">Entrar</button>
                  <a class="btn btn-ghost" href="#/">Volver</a>
                </div>

                <div class="mtop">
                  <button id="forgot-password-btn" class="btn btn-ghost" type="button">Se me ha olvidado la contraseña</button>
                </div>

                <div id="login-error" class="error"></div>
              </form>

              <div class="auth-divider"><span>o continúa con</span></div>
              <div id="google-btn-container" style="display:flex; justify-content:center; margin-top:8px;"></div>
              <div id="google-error" class="error" style="margin-top:8px;"></div>
            </div>

            <div data-auth-view="google-complete" class="hidden">
              <div class="kicker" style="margin-bottom:4px;">Un último paso</div>
              <p class="sub" style="margin-bottom:16px;">Completa tu perfil para continuar con el registro.</p>
              <form id="google-complete-form">
                <div class="form-row">
                  <div class="form-col">
                    <label>Nombre</label>
                    <input id="gc-firstName" name="gc_firstName" type="text" autocomplete="given-name" placeholder="Ana" required />
                  </div>
                  <div class="form-col">
                    <label>Apellidos</label>
                    <input id="gc-lastName" name="gc_lastName" type="text" autocomplete="family-name" placeholder="López" required />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-col">
                    <label>Teléfono</label>
                    <div class="phone-group">
                      <span class="phone-prefix">+34</span>
                      <input name="gc_phone" type="tel" autocomplete="tel" placeholder="600000000" required />
                    </div>
                  </div>
                  <div class="form-col">
                    <label>Fecha de nacimiento</label>
                    <input name="gc_birthDate" type="date" required />
                  </div>
                </div>

                <label>Género</label>
                <select name="gc_gender" required>
                  <option value="" disabled selected hidden>Elige una opción</option>
                  <option value="female">Femenino</option>
                  <option value="male">Masculino</option>
                  <option value="other">Otro / Prefiero no decir</option>
                </select>

                <div class="form-row">
                  <div class="form-col">
                    <label>Peso (kg) <span class="dim">(opcional)</span></label>
                    <input name="gc_weightKg" type="number" min="1" step="0.1" placeholder="70" />
                  </div>
                  <div class="form-col">
                    <label>Altura (cm) <span class="dim">(opcional)</span></label>
                    <input name="gc_heightCm" type="number" min="50" max="260" step="1" placeholder="170" />
                  </div>
                </div>

                <div class="mtop" style="display:flex; gap:12px; flex-wrap:wrap;">
                  <button id="google-complete-submit" class="btn btn-primary" type="submit">Continuar</button>
                </div>
                <div id="google-complete-error" class="error"></div>
              </form>
            </div>

            <div data-auth-view="register" class="hidden">
              <form id="register-form">
                <div class="kicker">Datos básicos</div>
                <div class="form-row">
                  <div class="form-col">
                    <label>Nombre</label>
                    <input name="firstName" type="text" autocomplete="given-name" placeholder="Ana" required />
                  </div>
                  <div class="form-col">
                    <label>Apellidos</label>
                    <input name="lastName" type="text" autocomplete="family-name" placeholder="López" required />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-col">
                    <label>Teléfono</label>
                    <div class="phone-group">
                      <span class="phone-prefix">+34</span>
                      <input name="phone" type="tel" autocomplete="tel" placeholder="600000000" required />
                    </div>
                  </div>
                  <div class="form-col">
                    <label>Fecha de nacimiento</label>
                    <input name="birthDate" type="date" required />
                  </div>
                </div>

                <label>Género</label>
                <select name="gender" required>
                  <option value="" disabled selected hidden>Elige una opción</option>
                  <option value="female">Femenino</option>
                  <option value="male">Masculino</option>
                  <option value="other">Otro / Prefiero no decir</option>
                </select>

                <div class="form-row">
                  <div class="form-col">
                    <label>Peso (kg) <span class="dim">(opcional)</span></label>
                    <input name="weightKg" type="number" min="1" step="0.1" placeholder="70" />
                  </div>
                  <div class="form-col">
                    <label>Altura (cm) <span class="dim">(opcional)</span></label>
                    <input name="heightCm" type="number" min="50" max="260" step="1" placeholder="170" />
                  </div>
                </div>

                <label>Email <span class="dim">(solo Gmail, Outlook o Yahoo)</span></label>
                <input name="regEmail" type="email" autocomplete="email" placeholder="nombre@gmail.com" required />

                <label>Contraseña</label>
                <input name="regPassword" type="password" autocomplete="new-password" placeholder="********" required />

                <div class="mtop" style="display:flex; gap:12px; flex-wrap:wrap;">
                  <button id="register-submit" class="btn btn-primary" type="submit">Crear cuenta</button>
                  <button class="btn btn-ghost" type="button" data-auth-tab="login">Ya tengo cuenta</button>
                </div>

                <div id="register-error" class="error"></div>
              </form>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}
