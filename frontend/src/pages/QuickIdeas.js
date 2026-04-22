import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { authService } from "../services/authService.js";
import { navigate, showToast } from "../router.js";
import { trainingService } from "../services/trainingService.js";

const quickPlans = [
  {
    id: "fullbody",
    title: "Fullbody 3x/sem",
    focus: "Fuerza + core",
    time: "45-55 min",
    durationMin: 50,
    tip: "Base: sentadilla, press, remo.",
    description: "Sesión completa que trabaja todo el cuerpo. Ideal para 3 días no consecutivos a la semana. Combina fuerza compuesta con trabajo de core para máximo rendimiento.",
    exercises: [
      { name: "Sentadilla con barra", sets: 4, detail: "8-10 reps" },
      { name: "Press banca", sets: 3, detail: "8-10 reps" },
      { name: "Remo con barra", sets: 3, detail: "10-12 reps" },
      { name: "Press militar", sets: 3, detail: "10 reps" },
      { name: "Plancha", sets: 3, detail: "45 seg" },
      { name: "Peso muerto rumano", sets: 3, detail: "10 reps" },
    ],
  },
  {
    id: "hiit-movilidad",
    title: "HIIT + movilidad",
    focus: "Cardio + stretch",
    time: "30 min",
    durationMin: 30,
    tip: "4 bloques 40/20 + 10' movilidad.",
    description: "Alta intensidad seguida de movilidad activa. Quema calorías y mejora tu rango de movimiento en una sola sesión. Perfecto para días de poco tiempo.",
    exercises: [
      { name: "Burpees", sets: 4, detail: "40 seg / 20 seg descanso" },
      { name: "Mountain climbers", sets: 4, detail: "40 seg / 20 seg descanso" },
      { name: "Saltos en caja", sets: 4, detail: "40 seg / 20 seg descanso" },
      { name: "Sprint en sitio", sets: 4, detail: "40 seg / 20 seg descanso" },
      { name: "Movilidad cadera (círculos)", sets: 1, detail: "10 min, fluido" },
    ],
  },
  {
    id: "torso-potente",
    title: "Torso potente",
    focus: "Pecho + espalda",
    time: "40-50 min",
    durationMin: 45,
    tip: "Superseries de empuje y tracción.",
    description: "Superseries que alternan empuje y tracción para máximo volumen y eficiencia. Trabaja pecho, espalda y hombros con poco descanso entre grupos musculares.",
    exercises: [
      { name: "Press banca inclinado + Remo sentado", sets: 4, detail: "10 reps cada uno" },
      { name: "Press plano con mancuernas + Dominadas", sets: 3, detail: "10 / máx reps" },
      { name: "Fondos en paralelas + Face pull", sets: 3, detail: "10-12 reps" },
      { name: "Pullover + Aperturas con cables", sets: 3, detail: "12 reps" },
    ],
  },
  {
    id: "pierna-gluteo",
    title: "Pierna y glúteo",
    focus: "Lower body",
    time: "50 min",
    durationMin: 50,
    tip: "Sentadilla, bisagra y zancadas pesadas.",
    description: "Sesión completa de tren inferior. Combina sentadilla profunda, bisagra de cadera y trabajo unilateral para desarrollar fuerza y masa muscular en piernas y glúteos.",
    exercises: [
      { name: "Sentadilla búlgara", sets: 4, detail: "10 reps por pierna" },
      { name: "Peso muerto rumano", sets: 3, detail: "10 reps" },
      { name: "Hip thrust", sets: 4, detail: "12 reps" },
      { name: "Zancadas con mancuernas", sets: 3, detail: "12 reps por pierna" },
      { name: "Prensa de piernas", sets: 3, detail: "15 reps" },
      { name: "Curl femoral", sets: 3, detail: "12 reps" },
    ],
  },
  {
    id: "core-postura",
    title: "Core + postura",
    focus: "Estabilidad",
    time: "25-30 min",
    durationMin: 28,
    tip: "Plancha, antirotación y control lumbo-pélvico.",
    description: "Trabajo profundo de core orientado a mejorar postura y prevenir lesiones. Sin carga pesada, enfocado en activación y control motor. Ideal como complemento o días de recuperación.",
    exercises: [
      { name: "Plancha frontal", sets: 3, detail: "45-60 seg" },
      { name: "Pallof press", sets: 3, detail: "12 reps por lado" },
      { name: "Bird dog", sets: 3, detail: "10 reps por lado" },
      { name: "Dead bug", sets: 3, detail: "10 reps por lado" },
      { name: "Superman", sets: 3, detail: "15 reps" },
      { name: "Plancha lateral", sets: 3, detail: "30 seg por lado" },
    ],
  },
  {
    id: "metcon-express",
    title: "Metcon express",
    focus: "Quema calórica",
    time: "20-25 min",
    durationMin: 22,
    tip: "Circuito rápido con kettlebell y remo.",
    description: "Circuito de alta intensidad que maximiza la quema calórica en poco tiempo. Perfecto cuando no tienes mucho tiempo pero quieres un entrenamiento efectivo y completo.",
    exercises: [
      { name: "KB Swing", sets: 3, detail: "15 reps" },
      { name: "Remo en máquina", sets: 3, detail: "250 metros" },
      { name: "Box jump", sets: 3, detail: "12 reps" },
      { name: "Push press con mancuernas", sets: 3, detail: "12 reps" },
      { name: "Farmer carry", sets: 3, detail: "20 metros" },
    ],
  },
];

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderPlanCard = (plan, isMember) => `
  <article class="card quick-idea-card" id="plan-${plan.id}" style="display:flex; flex-direction:column; gap:14px;">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
      <div>
        <div style="font-weight:1000; font-size:20px; font-family:inherit;">${escapeHtml(plan.title)}</div>
        <div class="dim" style="margin-top:4px;">${escapeHtml(plan.focus)} · ${escapeHtml(plan.time)}</div>
      </div>
      <span class="badge">${escapeHtml(plan.time)}</span>
    </div>

    <p class="sub" style="margin:0;">${escapeHtml(plan.description)}</p>
    <p class="dim" style="margin:0; font-weight:700; font-style:italic;">"${escapeHtml(plan.tip)}"</p>

    <div>
      <div style="font-weight:800; font-size:13px; margin-bottom:8px; color:var(--muted);">Ejercicios</div>
      <ul class="list" style="gap:6px;">
        ${plan.exercises.map((ex) => `
          <li class="row" style="padding:10px 12px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
            <span style="font-weight:800;">${escapeHtml(ex.name)}</span>
            <span class="pill">${ex.sets} series · ${escapeHtml(ex.detail)}</span>
          </li>`).join("")}
      </ul>
    </div>

    ${isMember ? `
    <div style="display:flex; align-items:center; gap:10px; margin-top:auto; flex-wrap:wrap;">
      <button class="btn btn-primary" data-action="save-plan" data-plan-id="${plan.id}">Guardar en mi historial</button>
      <span class="dim" id="save-msg-${plan.id}" style="font-weight:700;"></span>
    </div>` : ""}
  </article>
`;

export async function QuickIdeasPage() {
  const me = await authService.loadSession().catch(() => authStore.me);

  if (!authStore.token || !me) {
    navigate("/login");
    return "";
  }

  const isMember = me.role === "member";

  setTimeout(() => {
    if (!isMember) return;

    document.querySelector("#quick-ideas-grid")?.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action='save-plan']");
      if (!btn) return;

      const planId = btn.dataset.planId;
      const plan = quickPlans.find((p) => p.id === planId);
      if (!plan) return;

      const msgEl = document.querySelector(`#save-msg-${planId}`);
      btn.disabled = true;
      btn.textContent = "Guardando...";

      try {
        await trainingService.createLog({
          title: plan.title,
          description: `${plan.focus} · ${plan.time}. ${plan.description}`,
          duration_min: plan.durationMin,
          date: new Date().toISOString(),
        });
        if (msgEl) {
          msgEl.textContent = "Guardado en tu historial.";
          msgEl.style.color = "#0f7b3c";
        }
        showToast("Entrenamiento guardado en tu historial.", "success");
        btn.textContent = "Guardado";
      } catch (err) {
        const msg = err?.message || "No se pudo guardar.";
        if (msgEl) {
          msgEl.textContent = msg;
          msgEl.style.color = "#b42318";
        }
        showToast(msg, "error");
        btn.disabled = false;
        btn.textContent = "Guardar en mi historial";
      }
    });
  }, 0);

  return `
    <div class="bg-blobs"></div>
    <div class="screen">
      ${Navbar()}
      <main class="container" style="padding-bottom:32px;">
        <section class="hero">
          <div class="card" style="display:flex; flex-direction:column; gap:20px;">
            <div>
              <h2 class="h2" style="margin:0;">Ideas rápidas de entrenamiento</h2>
              <p class="sub lead" style="margin-top:8px;">Planes cortos y efectivos para cualquier día. ${isMember ? "Guárdalos en tu historial con un clic." : ""}</p>
            </div>

            <div id="quick-ideas-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:16px;">
              ${quickPlans.map((p) => renderPlanCard(p, isMember)).join("")}
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}
