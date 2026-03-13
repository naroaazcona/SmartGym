import { navigate } from "../router.js";
import { authStore } from "../state/authStore.js";
import { trainingApi } from "../api/training.js";

const STEPS = [
  {
    id: "goal",
    question: "¿Cuál es tu objetivo principal?",
    emoji: "🎯",
    type: "single",
    options: [
      { value: "perder_peso", label: "Perder peso", icon: "🔥" },
      { value: "ganar_musculo", label: "Ganar músculo", icon: "💪" },
      { value: "mejorar_resistencia", label: "Mejorar resistencia", icon: "🏃" },
      { value: "mantenerse_en_forma", label: "Mantenerme en forma", icon: "⚖️" },
      { value: "reducir_estres", label: "Reducir estrés", icon: "🧘" },
      { value: "mejorar_condicion_fisica", label: "Mejorar condición física", icon: "📈" },
    ],
  },
  {
    id: "experience_level",
    question: "¿Cuál es tu nivel de experiencia?",
    emoji: "🏋️",
    type: "single",
    options: [
      { value: "beginner", label: "Principiante", desc: "Menos de 6 meses", icon: "🌱" },
      { value: "intermediate", label: "Intermedio", desc: "6 meses - 2 años", icon: "🌿" },
      { value: "advanced", label: "Avanzado", desc: "Más de 2 años", icon: "🌳" },
    ],
  },
  {
    id: "days_per_week",
    question: "¿Cuántos días a la semana quieres entrenar?",
    emoji: "📅",
    type: "single",
    options: [
      { value: "2", label: "2 días", desc: "Ideal para empezar", icon: "🟢" },
      { value: "3", label: "3 días", desc: "Lo más habitual", icon: "🟡" },
      { value: "4", label: "4 días", desc: "Buen ritmo", icon: "🟠" },
      { value: "5", label: "5 días", desc: "Alto rendimiento", icon: "🔴" },
    ],
  },
  {
    id: "preferred_training",
    question: "¿Qué tipo de entrenamiento prefieres?",
    emoji: "⚡",
    type: "multi",
    options: [
      { value: "fuerza", label: "Fuerza", icon: "🏋️" },
      { value: "cardio", label: "Cardio", icon: "🏃" },
      { value: "hiit", label: "HIIT", icon: "⚡" },
      { value: "yoga_pilates", label: "Yoga / Pilates", icon: "🧘" },
      { value: "funcional", label: "Funcional", icon: "🤸" },
      { value: "crossfit", label: "CrossFit", icon: "🔩" },
    ],
  },
  {
    id: "injuries",
    question: "¿Tienes alguna limitación física?",
    emoji: "🩺",
    type: "multi",
    options: [
      { value: "ninguna", label: "Ninguna", icon: "✅" },
      { value: "rodilla", label: "Rodilla", icon: "🦵" },
      { value: "espalda", label: "Espalda", icon: "🔙" },
      { value: "hombro", label: "Hombro", icon: "💪" },
      { value: "tobillo", label: "Tobillo / Pie", icon: "🦶" },
      { value: "muñeca", label: "Muñeca / Codo", icon: "🤚" },
    ],
  },
  {
    id: "available_equipment",
    question: "¿Con qué equipamiento cuentas?",
    emoji: "🏠",
    type: "multi",
    options: [
      { value: "gimnasio_completo", label: "Gimnasio completo", icon: "🏋️" },
      { value: "mancuernas", label: "Mancuernas en casa", icon: "💪" },
      { value: "bandas_elasticas", label: "Bandas elásticas", icon: "🔗" },
      { value: "peso_corporal", label: "Solo peso corporal", icon: "🤸" },
      { value: "bicicleta", label: "Bicicleta / Cinta", icon: "🚴" },
    ],
  },
];

export async function OnboardingPage() {
  // Si no hay sesión, redirigir a login
  if (!authStore.token) {
    navigate("/login");
    return "";
  }

  setTimeout(() => {
    let currentStep = 0;
    const answers = {};

    const container = document.querySelector("#onboarding-container");
    const progressBar = document.querySelector("#onboarding-progress");
    const stepCounter = document.querySelector("#step-counter");

    function updateProgress() {
      const pct = ((currentStep + 1) / STEPS.length) * 100;
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (stepCounter) stepCounter.textContent = `${currentStep + 1} / ${STEPS.length}`;
    }

    function renderStep(index) {
      const step = STEPS[index];
      const current = answers[step.id] || (step.type === "multi" ? [] : null);

      container.innerHTML = `
        <div class="ob-step" style="animation: obFadeIn 0.35s ease">
          <div class="ob-emoji">${step.emoji}</div>
          <h2 class="ob-question">${step.question}</h2>
          <div class="ob-options ob-options--${step.type}">
            ${step.options.map(opt => {
              const isSelected = step.type === "multi"
                ? (current || []).includes(opt.value)
                : current === opt.value;
              return `
                <button
                  class="ob-option ${isSelected ? "ob-option--selected" : ""}"
                  data-value="${opt.value}"
                  data-step="${step.id}"
                  type="button"
                >
                  <span class="ob-option-label">${opt.label}</span>
                  ${opt.desc ? `<span class="ob-option-desc">${opt.desc}</span>` : ""}
                </button>
              `;
            }).join("")}
          </div>

          <div class="ob-nav">
            ${index > 0
              ? `<button class="btn btn-ghost" id="ob-back" type="button">← Atrás</button>`
              : `<div></div>`
            }
            <button class="btn btn-primary" id="ob-next" type="button" ${!hasAnswer(step, current) ? "disabled" : ""}>
              ${index === STEPS.length - 1 ? "Finalizar 🚀" : "Siguiente →"}
            </button>
          </div>

          <div id="ob-error" class="error" style="text-align:center;margin-top:8px;"></div>
        </div>
      `;

      updateProgress();
      attachOptionListeners(step);

      document.querySelector("#ob-back")?.addEventListener("click", () => {
        currentStep--;
        renderStep(currentStep);
      });

      document.querySelector("#ob-next")?.addEventListener("click", () => handleNext(step));
    }

    function hasAnswer(step, current) {
      if (step.type === "multi") return (current || []).length > 0;
      return current !== null && current !== undefined;
    }

    function attachOptionListeners(step) {
      const options = container.querySelectorAll(".ob-option");
      options.forEach(btn => {
        btn.addEventListener("click", () => {
          const val = btn.dataset.value;
          if (step.type === "single") {
            // Si es "ninguna" en lesiones, deselecciona todo lo demás
            answers[step.id] = val;
            options.forEach(b => b.classList.toggle("ob-option--selected", b.dataset.value === val));
          } else {
            // Multi select
            if (!answers[step.id]) answers[step.id] = [];
            // Si elige "ninguna", limpia el resto
            if (val === "ninguna") {
              answers[step.id] = ["ninguna"];
            } else {
              answers[step.id] = answers[step.id].filter(v => v !== "ninguna");
              const idx = answers[step.id].indexOf(val);
              if (idx > -1) answers[step.id].splice(idx, 1);
              else answers[step.id].push(val);
            }
            options.forEach(b => {
              b.classList.toggle("ob-option--selected", (answers[step.id] || []).includes(b.dataset.value));
            });
          }
          // Habilitar botón next
          const nextBtn = document.querySelector("#ob-next");
          if (nextBtn) nextBtn.disabled = !hasAnswer(step, answers[step.id]);
        });
      });
    }

    async function handleNext(step) {
      if (!hasAnswer(step, answers[step.id])) return;

      if (currentStep < STEPS.length - 1) {
        currentStep++;
        renderStep(currentStep);
      } else {
        await saveAndFinish();
      }
    }

    async function saveAndFinish() {
      const nextBtn = document.querySelector("#ob-next");
      const errDiv = document.querySelector("#ob-error");
      if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = "Guardando..."; }

      const preferences = {
        goal: answers.goal || "mejorar_condicion_fisica",
        experience_level: answers.experience_level || "beginner",
        days_per_week: parseInt(answers.days_per_week || "3"),
        preferred_training: answers.preferred_training || [],
        injuries: (answers.injuries || ["ninguna"]).join(", "),
        available_equipment: answers.available_equipment || [],
        completedAt: new Date().toISOString(),
      };

      try {
        await trainingApi.savePreferences(preferences);
        // Marcar onboarding completado en localStorage
        localStorage.setItem(`onboarding_done_${authStore.me?.id}`, "1");
        navigate("/");
      } catch (err) {
        if (errDiv) errDiv.textContent = "Error al guardar. Inténtalo de nuevo.";
        if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = "Finalizar 🚀"; }
      }
    }

    renderStep(0);
  }, 0);

  return `
    <style>
      @keyframes obFadeIn {
        from { opacity: 0; transform: translateY(18px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      .ob-wrapper {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 24px 16px;
      }

      .ob-card {
        background: var(--surface);
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow);
        width: 100%;
        max-width: 640px;
        padding: 40px 36px 32px;
        position: relative;
      }

      .ob-header {
        margin-bottom: 28px;
      }

      .ob-brand {
        font-family: "Bai Jamjuree", sans-serif;
        font-size: 1rem;
        font-weight: 700;
        letter-spacing: .08em;
        text-transform: uppercase;
        color: var(--accent) !important;
        margin-bottom: 16px;
      }

      .ob-progress-track {
        height: 6px;
        background: var(--bg-2);
        border-radius: 99px;
        overflow: hidden;
      }

      .ob-progress-fill {
        height: 100%;
        background: var(--accent);
        border-radius: 99px;
        transition: width 0.4s cubic-bezier(.4,0,.2,1);
        width: 0%;
      }

      .ob-step-counter {
        font-size: .78rem;
        color: #666 !important;
        margin-top: 6px;
        text-align: right;
      }

      .ob-emoji {
        font-size: 3rem;
        margin-bottom: 12px;
        display: block;
      }

      .ob-question {
        font-family: "Bai Jamjuree", sans-serif;
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0 0 28px;
        line-height: 1.25;
        color: #000 !important;
      }

      .ob-options {
        display: grid;
        gap: 10px;
        margin-bottom: 32px;
      }

      .ob-options--single {
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      }

      .ob-options--multi {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      }

      .ob-option {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 16px 12px;
        border-radius: var(--radius-lg);
        border: 2px solid var(--border);
        background: var(--surface-2);
        cursor: pointer;
        transition: all 0.18s ease;
        text-align: center;
      }

      .ob-option:hover {
        border-color: var(--accent);
        background: rgba(255,91,46,.07);
        transform: translateY(-2px);
      }

      .ob-option--selected {
        border-color: var(--accent) !important;
        background: rgba(255,91,46,.12) !important;
        box-shadow: 0 0 0 3px rgba(255,91,46,.15);
      }

      .ob-option-icon {
        font-size: 1.8rem;
        line-height: 1;
      }

      .ob-option-label {
        font-weight: 600;
        font-size: .9rem;
        color: #000 !important;
      }

      .ob-option-desc {
        font-size: .75rem;
        color: #666 !important;
      }

      .ob-nav {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }

      .ob-multi-hint {
        font-size: .8rem;
        color: #666 !important;
        text-align: center;
        margin-bottom: 12px;
        margin-top: -16px;
      }

      @media (max-width: 480px) {
        .ob-card { padding: 28px 20px 24px; }
        .ob-question { font-size: 1.2rem; }
        .ob-options--single,
        .ob-options--multi { grid-template-columns: repeat(2, 1fr); }
      }
    </style>

    <div class="bg-blobs"></div>
    <div class="ob-wrapper">
      <div class="ob-card">
        <div class="ob-header">
          <div class="ob-brand">SmartGym</div>
          <p style="margin:0 0 12px; color:#444 !important; font-size:.95rem;">
            Cuéntanos sobre ti para personalizar tu experiencia
          </p>
          <div class="ob-progress-track">
            <div class="ob-progress-fill" id="onboarding-progress"></div>
          </div>
          <div class="ob-step-counter" id="step-counter">1 / ${STEPS.length}</div>
        </div>

        <div id="onboarding-container"></div>
      </div>
    </div>
  `;
}
