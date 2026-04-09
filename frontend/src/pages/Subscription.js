import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { navigate } from "../router.js";
import { apiFetch } from "../api/client.js";

export async function SubscriptionPage() {
  const isOnline = Boolean(authStore.token);

  // Query y hash para compatibilidad (Stripe puede volver en cualquiera de los dos formatos)
  const searchParams = new URLSearchParams(location.search || "");
  const hash = location.hash || "";
  const [, hashQuery = ""] = hash.split("?");
  const hashParams = new URLSearchParams(hashQuery);

  const success = searchParams.get("success") === "true" || hashParams.get("success") === "true";
  const sessionId = searchParams.get("session_id") || hashParams.get("session_id");

  // Confirmacion silenciosa del checkout al volver de Stripe
  if (success && isOnline) {
    try {
      await apiFetch("/auth/subscription/confirm", {
        method: "POST",
        body: sessionId ? { sessionId } : {},
      });
    } catch {
      // No mostramos barra de estado por requerimiento de UI.
    }
  }

  // Obtener suscripcion actual para deshabilitar el plan activo
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

  // Si viene de alta de usuario + pago correcto, continuar onboarding
  const consumeOnboardingRequired = () => {
    const userId = authStore.me?.id;
    if (userId) {
      const scopedKey = `onboarding_required_${userId}`;
      if (localStorage.getItem(scopedKey) === "1") {
        localStorage.removeItem(scopedKey);
        localStorage.removeItem("onboarding_required");
        return true;
      }
    }

    if (localStorage.getItem("onboarding_required") === "1") {
      localStorage.removeItem("onboarding_required");
      return true;
    }

    return false;
  };

  const shouldGoToOnboarding = success && isOnline && consumeOnboardingRequired();
  if (shouldGoToOnboarding) {
    navigate("/onboarding");
    return "";
  }

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
          <h1 style="font-size: 36px; font-weight: 1000; margin: 8px 0;">Elige tu suscripcion</h1>
          <p class="sub">Sin permanencia. Cancela cuando quieras.</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; max-width: 800px; margin: 0 auto; width: 100%;">

          <div class="card" style="display: flex; flex-direction: column; gap: 16px; padding: 32px;">
            <div>
              <div class="kicker">Basico</div>
              <div style="font-size: 40px; font-weight: 1000;">19,99 &euro;<span style="font-size: 16px; font-weight: 400;">/mes</span></div>
            </div>
            <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px;">
              <li>&#x2705; Acceso a todas las clases</li>
              <li>&#x2705; Reservas online</li>
              <li>&#x2705; Plan de entrenamiento IA</li>
              <li>&#x2705; Clases premium</li>
              <li>&#x274C; Nutricion personalizada</li>
            </ul>
            <button
              class="btn btn-ghost js-subscribe"
              data-plan="basic"
              ${currentPlan === "basic" && isActive ? "disabled" : ""}
            >
              ${currentPlan === "basic" && isActive ? "Plan actual" : "Suscribirse"}
            </button>
          </div>

          <div class="card" style="display: flex; flex-direction: column; gap: 16px; padding: 32px; border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent);">
            <div>
              <div class="kicker" style="color: var(--accent);">Premium</div>
              <div style="font-size: 40px; font-weight: 1000;">29,99 &euro;<span style="font-size: 16px; font-weight: 400;">/mes</span></div>
            </div>
            <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px;">
              <li>&#x2705; Acceso a todas las clases</li>
              <li>&#x2705; Reservas online</li>
              <li>&#x2705; Plan de entrenamiento IA</li>
              <li>&#x2705; Clases premium</li>
              <li>&#x2705; Nutricion personalizada</li>
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

