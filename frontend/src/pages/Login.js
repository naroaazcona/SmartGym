import { Navbar } from "../components/Navbar.js";
import { authService } from "../services/authService.js";
import { navigate } from "../router.js";

function goToRole(me) {
  if (!me?.role) return navigate("/");
  if (me.role === "admin") navigate("/admin");
  else if (me.role === "trainer") navigate("/trainer");
  else navigate("/member");
}

export async function LoginPage() {
  setTimeout(() => {
    const tabs = document.querySelectorAll("[data-auth-tab]");
    const views = document.querySelectorAll("[data-auth-view]");
    const loginForm = document.querySelector("#login-form");
    const registerForm = document.querySelector("#register-form");
    const loginError = document.querySelector("#login-error");
    const registerError = document.querySelector("#register-error");

    const show = (mode) => {
      tabs.forEach((btn) => btn.classList.toggle("active", btn.dataset.authTab === mode));
      views.forEach((block) => block.classList.toggle("hidden", block.dataset.authView !== mode));
    };

    tabs.forEach((btn) => {
      btn.addEventListener("click", () => show(btn.dataset.authTab));
    });
    show("login");

    loginForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (loginError) loginError.textContent = "";

      const email = loginForm.email.value.trim();
      const password = loginForm.password.value;

      try {
        const me = await authService.login(email, password);
        goToRole(me);
      } catch (ex) {
        if (loginError) loginError.textContent = ex.message || "Error al iniciar sesion";
      }
    });

    registerForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (registerError) registerError.textContent = "";

      const payload = {
        firstName: registerForm.firstName.value.trim(),
        lastName: registerForm.lastName.value.trim(),
        email: registerForm.regEmail.value.trim(),
        password: registerForm.regPassword.value,
      };

      try {
        const res = await authService.register(payload);
        const me = res?.user || null;
        if (me) goToRole(me);
        else navigate("/member");
      } catch (ex) {
        if (registerError) registerError.textContent = ex.message || "Error al registrar";
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
              <button type="button" class="tab-btn active" data-auth-tab="login">Iniciar sesion</button>
              <button type="button" class="tab-btn" data-auth-tab="register">Registrarse</button>
            </div>

            <div data-auth-view="login">
              <form id="login-form">
                <label>Email</label>
                <input name="email" type="email" autocomplete="email" placeholder="tu@correo.com" required />

                <label>Contrasena</label>
                <input name="password" type="password" autocomplete="current-password" placeholder="********" required />

                <div class="mtop" style="display:flex; gap:12px; flex-wrap:wrap;">
                  <button class="btn btn-primary" type="submit">Entrar</button>
                  <a class="btn btn-ghost" href="#/">Volver</a>
                </div>

                <div id="login-error" class="error"></div>
              </form>
            </div>

            <div data-auth-view="register" class="hidden">
              <form id="register-form">
                <div class="form-row">
                  <div class="form-col">
                    <label>Nombre</label>
                    <input name="firstName" type="text" autocomplete="given-name" placeholder="Ana" required />
                  </div>
                  <div class="form-col">
                    <label>Apellidos</label>
                    <input name="lastName" type="text" autocomplete="family-name" placeholder="Lopez" required />
                  </div>
                </div>

                <label>Email</label>
                <input name="regEmail" type="email" autocomplete="email" placeholder="nuevo@correo.com" required />

                <label>Contrasena</label>
                <input name="regPassword" type="password" autocomplete="new-password" placeholder="********" required />

                <div class="mtop" style="display:flex; gap:12px; flex-wrap:wrap;">
                  <button class="btn btn-primary" type="submit">Crear cuenta</button>
                  <button class="btn btn-ghost" type="button" data-auth-tab="login">Ya tengo cuenta</button>
                </div>

                <div id="register-error" class="error"></div>
              </form>
            </div>

            <div class="footer">
              Si falla el login/registro, revisa que el backend este levantado y <code>src/config.js</code> apunte al API Gateway.
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}
