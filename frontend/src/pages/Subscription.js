import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { navigate } from "../router.js";
import { apiFetch } from "../api/client.js";

export async function SubscriptionPage() {
  const isOnline = Boolean(authStore.token);

  // Leer parámetros de la URL
  const hash = location.hash || "";
  const success = hash.includes("success=true");
  const cancelled = hash.includes("cancelled=true");

  // Obtener suscripción actual si está logueado
  let currentSubscription = null;
  if (isOnline) {
    try {
      const res = await apiFetch("/auth/subscription/me");
      currentSubscription = res.subscription;
    } catch {
      currentSubscription = null;
    }
  }

  const isActive = currentSubscription?.status === "active";
  const currentPlan = currentSubscription?.plan || null;

  // Si el pago fue correcto, ir directamente al onboarding (sin botón intermedio)
  if (success && isOnline) {
    navigate("/onboarding");
    return "";
  }

  // Listener para botones de pago
  setTimeout(() => {
    document.querySelectorAll(".js-subscribe").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!isOnline) {
          navigate("/login");
          return;
        }

        const plan = btn.dataset.plan;
        btn.disabled = true;
        btn.textContent = "Redirigiendo...";

        try {
          const res = await apiFetch("/auth/subscription/checkout", {
            method: "POST",
            body: { plan },
          });
          if (res.url) window.location.href = res.url;
        } catch (err) {
          btn.disabled = false;
          btn.textContent = "Suscribirse";
          alert(err.message || "Error al procesar el pago");
        }
      });
    });
  }, 0);

  return `
    <div class="screen">
      ${Navbar()}
      <main class="container" style="padding: 40px 0; display: flex; flex-direction: column; gap: 32px;">

        <div style="text-align: center;">
          <div class="kicker">Planes</div>
          <h1 style="font-size: 36px; font-weight: 1000; margin: 8px 0;">Elige tu suscripción</h1>
          <p class="sub">Sin permanencia. Cancela cuando quieras.</p>
        </div>

        ${success ? `
          <div class="card" style="background: #d1fae5; border-color: #6ee7b7; text-align: center; padding: 24px;">
            <div style="font-size: 32px;">✅</div>
            <h2 style="margin: 8px 0;">¡Pago completado!</h2>
            <p class="sub">Tu suscripción ya está activa. Redirigiendo a tus preguntas...</p>
          </div>
        ` : ""}

        ${cancelled ? `
          <div class="card" style="background: #fee2e2; border-color: #fca5a5; text-align: center; padding: 24px;">
            <div style="font-size: 32px;">❌</div>
            <h2 style="margin: 8px 0;">Pago cancelado</h2>
            <p class="sub">No se ha realizado ningún cargo. Puedes intentarlo de nuevo cuando quieras.</p>
          </div>
        ` : ""}

        ${isActive ? `
          <div class="card" style="background: #eff6ff; border-color: #93c5fd; text-align: center; padding: 24px;">
            <div class="kicker">Suscripción activa</div>
            <h2 style="margin: 8px 0;">Plan ${currentPlan === "basic" ? "Básico" : "Premium"}</h2>
            <p class="sub">Tu suscripción está activa hasta el 
              ${currentSubscription.current_period_end 
                ? new Date(currentSubscription.current_period_end).toLocaleDateString("es-ES") 
                : "—"}.
            </p>
          </div>
        ` : ""}

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; max-width: 800px; margin: 0 auto; width: 100%;">
          
          <!-- Plan Básico -->
          <div class="card" style="display: flex; flex-direction: column; gap: 16px; padding: 32px;">
            <div>
              <div class="kicker">Básico</div>
              <div style="font-size: 40px; font-weight: 1000;">19,99€<span style="font-size: 16px; font-weight: 400;">/mes</span></div>
            </div>
            <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px;">
              <li>✅ Acceso a todas las clases</li>
              <li>✅ Reservas online</li>
              <li>✅ Plan de entrenamiento IA</li>
              <li>✅ Clases premium</li>
              <li>❌ Nutrición personalizada</li>
            </ul>
            <button 
              class="btn btn-ghost js-subscribe" 
              data-plan="basic"
              ${currentPlan === "basic" && isActive ? "disabled" : ""}
            >
              ${currentPlan === "basic" && isActive ? "Plan actual" : "Suscribirse"}
            </button>
          </div>

          <!-- Plan Premium -->
          <div class="card" style="display: flex; flex-direction: column; gap: 16px; padding: 32px; border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent);">
            <div>
              <div class="kicker" style="color: var(--accent);"> Premium</div>
              <div style="font-size: 40px; font-weight: 1000;">29,99€<span style="font-size: 16px; font-weight: 400;">/mes</span></div>
            </div>
            <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px;">
              <li>✅ Acceso a todas las clases</li>
              <li>✅ Reservas online</li>
              <li>✅ Plan de entrenamiento IA</li>
              <li>✅ Clases premium</li>
              <li>✅ Nutrición personalizada</li>
            </ul>
            <button 
              class="btn btn-primary js-subscribe" 
              data-plan="premium"
              ${currentPlan === "premium" && isActive ? "disabled" : ""}
            >
              ${currentPlan === "premium" && isActive ? "Plan actual" : "Suscribirse"}
            </button>
          </div>

        </div>
      </main>
    </div>
  `;
}
