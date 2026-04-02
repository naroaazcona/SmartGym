import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { authService } from "../services/authService.js";
import { navigate } from "../router.js";
import { gymService } from "../services/gymService.js";
import { trainingService } from "../services/trainingService.js";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const firstFilled = (obj, keys = [], fallback = "") => {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const firstArray = (obj, keys = []) => {
  for (const key of keys) {
    const value = obj?.[key];
    if (Array.isArray(value)) return value;
  }
  return [];
};

const toPositiveInt = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
};

const asDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const isToday = (value) => {
  const d = asDate(value);
  if (!d) return false;
  const start = startOfToday();
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return d >= start && d < end;
};

const isWithinNextDays = (value, days = 7) => {
  const d = asDate(value);
  if (!d) return false;
  const start = startOfToday();
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return d >= start && d < end;
};

const buildRecommendationParams = (profile = {}) => ({
  level: firstFilled(profile, ["experienceLevel", "experience_level", "level"], "beginner"),
  goal: firstFilled(profile, ["goal", "fitnessGoal"], "mejorar condicion fisica"),
  days: toPositiveInt(firstFilled(profile, ["daysPerWeek", "days_per_week", "days"], 3), 3),
  injuries: firstFilled(profile, ["injuries", "limitations"], "ninguna"),
  gender: firstFilled(profile, ["gender"], ""),
  weight: firstFilled(profile, ["weightKg", "weight_kg"], ""),
  height: firstFilled(profile, ["heightCm", "height_cm"], ""),
});

const buildRecommendationProfile = (params = {}) => ({
  experience_level: firstFilled(params, ["experience_level", "level"], "beginner"),
  goal: firstFilled(params, ["goal"], "mejorar condicion fisica"),
  days_per_week: toPositiveInt(firstFilled(params, ["days_per_week", "days"], 3), 3),
  injuries: firstFilled(params, ["injuries"], "ninguna"),
  gender: firstFilled(params, ["gender"], ""),
  weight_kg: firstFilled(params, ["weight_kg", "weight"], ""),
  height_cm: firstFilled(params, ["height_cm", "height"], ""),
});

const getRecommendationPayload = (doc = null) => {
  if (!doc || typeof doc !== "object") return {};
  if (doc.recommendation && typeof doc.recommendation === "object") return doc.recommendation;
  if (doc.plan && typeof doc.plan === "object") return doc.plan;
  return doc;
};

const suggestClassType = (focus = "", classTypes = []) => {
  const names = classTypes
    .map((item) => String(item?.name || item?.class_type_name || "").trim())
    .filter(Boolean);
  if (!names.length) return "Clase funcional";
  const text = normalizeText(focus);
  const direct = names.find((name) => text.includes(normalizeText(name)) || normalizeText(name).includes(text));
  if (direct) return direct;
  return names[0];
};

const normalizeRecommendedSessions = (payload = {}, classTypes = []) => {
  const rawSessions = firstArray(payload, ["split", "sessions", "classes", "workouts", "routine"]);
  return rawSessions
    .map((raw, idx) => {
      const item = typeof raw === "string" ? { focus: raw } : raw;
      if (!item || typeof item !== "object") return null;
      const durationVal = Number(
        firstFilled(item, ["duration_min", "duration", "minutes", "durationMinutes"], "")
      );
      const exercisesRaw = firstFilled(item, ["exercises", "exercise_list", "drills", "movements"], []);
      const exercises = Array.isArray(exercisesRaw)
        ? exercisesRaw.map((x) => String(x).trim()).filter(Boolean).slice(0, 4)
        : String(exercisesRaw || "")
            .split(/[;,]+/)
            .map((x) => x.trim())
            .filter(Boolean)
            .slice(0, 4);
      return {
        day: String(firstFilled(item, ["day", "dia", "weekday", "date"], `Dia ${idx + 1}`)).trim(),
        focus: String(firstFilled(item, ["focus", "title", "name", "type"], "Sesion personalizada")).trim(),
        duration:
          Number.isFinite(durationVal) && durationVal > 0 ? `${Math.round(durationVal)} min` : "Duracion flexible",
        exercises,
        classType:
          String(firstFilled(item, ["recommended_class", "class_type", "classType"], "")).trim() ||
          suggestClassType(item.focus, classTypes),
      };
    })
    .filter(Boolean);
};

const buildDietFallback = (goal = "") => {
  const text = normalizeText(goal);
  if (text.includes("perder") || text.includes("grasa") || text.includes("deficit")) {
    return [
      { title: "Desayuno ligero", detail: "Yogur natural con frutos rojos y avena." },
      { title: "Comida principal", detail: "1/2 verduras, 1/4 proteina magra, 1/4 carbohidrato integral." },
      { title: "Cena recuperacion", detail: "Proteina + verduras + grasa saludable moderada." },
    ];
  }
  if (text.includes("masa") || text.includes("musculo") || text.includes("fuerza")) {
    return [
      { title: "Pre-entreno", detail: "Avena con leche y fruta 60-90 min antes." },
      { title: "Post-entreno", detail: "20-30g de proteina con fruta." },
      { title: "Cena completa", detail: "Carbohidrato + proteina + verduras." },
    ];
  }
  return [
    { title: "Base diaria", detail: "Proteina, verdura y carbohidrato complejo en cada comida." },
    { title: "Hidratacion", detail: "2-2.5L de agua al dia." },
    { title: "Snack inteligente", detail: "Fruta + frutos secos o yogur + semillas." },
  ];
};

const normalizeDietRecommendations = (payload = {}, goal = "") => {
  let rawDiet = firstFilled(payload, ["diets", "diet", "nutrition", "meal_plan", "meals"], []);
  if (!Array.isArray(rawDiet)) {
    if (rawDiet && typeof rawDiet === "object") {
      if (Array.isArray(rawDiet.items)) rawDiet = rawDiet.items;
      else if (Array.isArray(rawDiet.plan)) rawDiet = rawDiet.plan;
      else rawDiet = Object.entries(rawDiet).map(([title, detail]) => ({ title, detail }));
    } else if (typeof rawDiet === "string" && rawDiet.trim()) {
      rawDiet = [{ title: "Plan nutricional", detail: rawDiet }];
    } else rawDiet = [];
  }
  const parsed = rawDiet
    .map((raw, idx) => {
      const item = typeof raw === "string" ? { title: raw } : raw;
      if (!item || typeof item !== "object") return null;
      const title = String(firstFilled(item, ["title", "name", "meal", "moment"], `Sugerencia ${idx + 1}`)).trim();
      const detail = String(firstFilled(item, ["description", "detail", "notes", "tip", "advice"], "")).trim();
      return { title, detail: detail || "Sin detalle adicional" };
    })
    .filter(Boolean);
  return parsed.length ? parsed.slice(0, 6) : buildDietFallback(goal);
};

const formatRecommendationMeta = (doc, cached) => {
  const source = normalizeText(doc?.source || "");
  const sourceText =
    source === "openai" ? "Origen: OpenAI" : source === "rules_fallback" ? "Origen: fallback" : "Origen: IA";
  const createdAt = doc?.createdAt ? new Date(doc.createdAt) : null;
  const dateText =
    createdAt && !Number.isNaN(createdAt.getTime()) ? `Actualizada: ${createdAt.toLocaleString("es-ES")}` : "";
  return [sourceText, cached ? "Cache 7 dias activa" : "Generacion nueva", dateText]
    .filter(Boolean)
    .join(" | ");
};

const toRecommendedTypeSet = (recommendationState) =>
  new Set(
    (recommendationState?.classes || [])
      .map((item) => normalizeText(item?.classType))
      .filter(Boolean)
  );

const isClassRecommended = (cls, recommendedTypeSet) =>
  recommendedTypeSet.has(normalizeText(cls?.class_type_name || cls?.type || ""));

const getDemandMeta = (occupancy = 0) => {
  if (occupancy >= 85) {
    return { key: "high", label: "Alta demanda", className: "member-demand-high" };
  }
  if (occupancy >= 60) {
    return { key: "medium", label: "Demanda media", className: "member-demand-medium" };
  }
  return { key: "low", label: "Baja demanda", className: "member-demand-low" };
};

export async function MemberDashboard() {
  const me = await authService.loadSession().catch(() => authStore.me);

  if (!authStore.token || !me) {
    navigate("/login");
    return "";
  }
  if (me.role && me.role !== "member") {
    navigate("/");
    return "";
  }

  const name = me?.profile?.firstName || me?.firstName || me?.name || me?.email || "Socio";
  const isPremium = me?.subscriptionPlan === "premium";

  const heroImages = {
    crossfit: "https://images.unsplash.com/photo-1558611848-73f7eb4001a1?auto=format&fit=crop&w=1400&q=80",
    hiit: "https://images.unsplash.com/photo-1554284126-aa88f22d8b74?auto=format&fit=crop&w=1400&q=80",
    mobility: "https://images.unsplash.com/photo-1546484959-f9a9c6c4b4c1?auto=format&fit=crop&w=1400&q=80",
    spinning: "https://images.unsplash.com/photo-1546484475-7e0b1cd5a33e?auto=format&fit=crop&w=1400&q=80",
    cycling: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=1400&q=80",
    strength: "https://images.unsplash.com/photo-1483721310020-03333e577078?auto=format&fit=crop&w=1400&q=80",
  };
  const imgForType = (type) => heroImages[normalizeText(type)] || heroImages.strength;

  const classTypes = await gymService.listClassTypes().catch(() => []);
  const classes = await gymService.listClasses().catch(() => []);
  const sortedClasses = classes
    .slice()
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  const recommendationParams = buildRecommendationParams(me?.profile || {});
  const recommendationProfile = buildRecommendationProfile(recommendationParams);
  const initialRecResult = await trainingService
    .getMyRecommendation(recommendationParams)
    .catch(() => ({ recommendation: null, cached: false }));
  const initialRecDoc = initialRecResult.recommendation;
  const initialRecPayload = getRecommendationPayload(initialRecDoc);
  const initialRecState = {
    classes: normalizeRecommendedSessions(initialRecPayload, classTypes),
    diets: normalizeDietRecommendations(initialRecPayload, recommendationParams.goal),
    notes: String(firstFilled(initialRecPayload, ["notes", "note", "advice", "summary", "tips"], "")).trim(),
    meta: formatRecommendationMeta(initialRecDoc, initialRecResult.cached),
  };
  const initialRecommendedTypeSet = toRecommendedTypeSet(initialRecState);

  const fmtDate = (iso) =>
    new Date(iso).toLocaleString("es-ES", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  const renderMemberClassCard = (cls, recommendedTypeSet) => {
    const capacity = Number(cls.capacity || 0);
    const booked = Number(cls.booked_count || 0);
    const free = Math.max(capacity - booked, 0);
    const full = capacity > 0 && booked >= capacity;
    const occupancy = capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;
    const recommended = isClassRecommended(cls, recommendedTypeSet);
    const demand = getDemandMeta(occupancy);
    const progressColor =
      occupancy >= 85 ? "rgba(255,122,89,.92)" : occupancy >= 60 ? "rgba(253,188,46,.92)" : "rgba(40,205,180,.95)";

    return `
      <article class="class-card member-class-card ${demand.className}" data-class-id="${cls.id}" data-demand="${demand.key}" style="min-height:250px;">
        <div class="backdrop" style="background-image:url('${imgForType(cls.class_type_name)}')"></div>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
          <div class="tag ${full ? "red" : "green"}">${escapeHtml(cls.class_type_name || "Clase")}</div>
          ${recommended ? `<span class="badge blue">Sugerida por IA</span>` : `<span class="badge">${occupancy}% aforo</span>`}
        </div>

        <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
          <div>
            <div style="font-weight:1000; font-size:18px;">${escapeHtml(fmtDate(cls.starts_at))}</div>
            <div class="dim">${escapeHtml(cls.location || "Centro")} · ${
      cls.instructor_name ? `Coach ${escapeHtml(cls.instructor_name)}` : "Coach por asignar"
    }</div>
          </div>
          <span class="pill">${full ? "Completa" : `${free} libres`}</span>
        </div>

        ${cls.description ? `<p class="sub" style="margin:2px 0 0; color:#0b0f19;">${escapeHtml(cls.description)}</p>` : ""}

        <div style="display:flex; flex-direction:column; gap:6px; margin-top:4px;">
          <div style="display:flex; justify-content:space-between; gap:8px; align-items:center;">
            <div class="dim" style="font-weight:800;">Aforo ${booked}/${capacity}</div>
            <span class="member-demand-badge ${demand.className}">${demand.label}</span>
          </div>
          <div style="height:8px; width:100%; border-radius:999px; background:rgba(13,26,45,.12); overflow:hidden;">
            <span style="display:block; height:100%; width:${occupancy}%; background:${progressColor};"></span>
          </div>
        </div>

        <div class="cta-inline" style="margin-top:auto;">
          <button class="btn btn-primary" data-action="reserve" data-id="${cls.id}" ${full ? "disabled" : ""}>Reservar</button>
          <button class="btn btn-ghost" data-action="cancel" data-id="${cls.id}">Cancelar</button>
        </div>
        <div class="dim" id="member-msg-${cls.id}"></div>
      </article>
    `;
  };

  const renderRecommendationClassCard = (item) => {
    const chips = item.exercises.length
      ? `<div class="chip-row" style="margin-top:8px;">${item.exercises
          .map((ex) => `<span class="chip">${escapeHtml(ex)}</span>`)
          .join("")}</div>`
      : "";

    return `
      <article class="card member-rec-card" style="padding:14px; border-color:rgba(40,205,180,.35); background:linear-gradient(180deg, rgba(40,205,180,.12), rgba(255,255,255,.92)); box-shadow:none; display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
          <div>
            <div class="kicker">${escapeHtml(item.day)}</div>
            <div style="font-weight:900; font-size:16px;">${escapeHtml(item.focus)}</div>
          </div>
          <span class="badge green">${escapeHtml(item.duration)}</span>
        </div>
        <div class="dim">Clase objetivo: ${escapeHtml(item.classType)}</div>
        ${chips}
      </article>
    `;
  };

  const renderRecommendationDietCard = (item) => `
    <article class="card member-rec-card" style="padding:14px; border-color:rgba(92,123,255,.35); background:linear-gradient(180deg, rgba(92,123,255,.10), rgba(255,255,255,.92)); box-shadow:none; display:flex; flex-direction:column; gap:6px;">
      <div class="kicker">Nutricion</div>
      <div style="font-weight:900; font-size:15px;">${escapeHtml(item.title)}</div>
      <p class="sub" style="margin:0;">${escapeHtml(item.detail || "Sin detalle adicional")}</p>
    </article>
  `;

  const renderRecommendationClasses = (items) =>
    items.length
      ? items.map((item) => renderRecommendationClassCard(item)).join("")
      : "<p class='sub'>No hay clases recomendadas en este momento.</p>";

  const renderRecommendationDiets = (items) =>
    items.length
      ? items.map((item) => renderRecommendationDietCard(item)).join("")
      : "<p class='sub'>No hay dieta recomendada en este momento.</p>";

  const initialClassCards = sortedClasses.length
    ? sortedClasses.map((cls) => renderMemberClassCard(cls, initialRecommendedTypeSet)).join("")
    : `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff5b2e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/><path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/><path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z"/><path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"/></svg>
        </div>
        <p class="empty-title">No hay clases disponibles</p>
        <p class="empty-sub">El equipo no ha programado clases próximas. Vuelve más tarde o contacta con recepción.</p>
      </div>`;
  const initialRecClassCards = renderRecommendationClasses(initialRecState.classes);
  const initialRecDietCards = renderRecommendationDiets(initialRecState.diets);
  const initialRecNotes = initialRecState.notes ? `Nota IA: ${escapeHtml(initialRecState.notes)}` : "";

  setTimeout(() => {
    const listEl = document.querySelector("#member-classes");
    const statusEl = document.querySelector("#member-status");
    const refreshBtn = document.querySelector("#member-refresh");
    const searchEl = document.querySelector("#member-search");
    const filterButtons = Array.from(document.querySelectorAll("[data-class-filter]"));
    const visibleCountEl = document.querySelector("#member-visible-count");
    const nextClassEl = document.querySelector("#member-next-class");
    const freeTodayEl = document.querySelector("#member-free-today");
    const aiMatchesEl = document.querySelector("#member-ai-matches");

    const recClassEl = document.querySelector("#member-rec-classes");
    const recDietEl = document.querySelector("#member-rec-diets");
    const recStatusEl = document.querySelector("#member-rec-status");
    const recMetaEl = document.querySelector("#member-rec-meta");
    const recNotesEl = document.querySelector("#member-rec-notes");
    const recSaveBtn = document.querySelector("#member-rec-save");
    const recRefreshBtn = document.querySelector("#member-rec-refresh");

    let currentClasses = sortedClasses.slice();
    let currentRecommendations = { ...initialRecState };
    let currentRecommendationDoc = initialRecDoc || null;
    let currentRecommendedTypeSet = toRecommendedTypeSet(currentRecommendations);
    let currentFilter = "available";
    let currentSearch = "";

    const setStatus = (txt, isError = false) => {
      if (!statusEl) return;
      statusEl.textContent = txt;
      statusEl.style.color = isError ? "#b42318" : "var(--muted)";
    };

    const setRecStatus = (txt, isError = false) => {
      if (!recStatusEl) return;
      recStatusEl.textContent = txt;
      recStatusEl.style.color = isError ? "#b42318" : "var(--muted)";
    };

    const applyFilters = (items) =>
      items.filter((cls) => {
        if (!asDate(cls.starts_at)) return false;
        const capacity = Number(cls.capacity || 0);
        const booked = Number(cls.booked_count || 0);
        const hasSpace = booked < capacity;
        const occupancy = capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;
        const aiMatch = isClassRecommended(cls, currentRecommendedTypeSet);

        if (currentFilter === "available" && !hasSpace) return false;
        if (currentFilter === "today" && !isToday(cls.starts_at)) return false;
        if (currentFilter === "week" && !isWithinNextDays(cls.starts_at, 7)) return false;
        if (currentFilter === "ai" && !aiMatch) return false;
        if (currentFilter === "high" && occupancy < 85) return false;

        if (!currentSearch) return true;
        const haystack = normalizeText(
          [cls.class_type_name, cls.location, cls.instructor_name, cls.description].join(" ")
        );
        return haystack.includes(currentSearch);
      });

    const updateTopMetrics = (visibleItems) => {
      if (visibleCountEl) visibleCountEl.textContent = `${visibleItems.length} clases`;
      const nextClass = visibleItems[0];
      if (nextClassEl) nextClassEl.textContent = nextClass ? fmtDate(nextClass.starts_at) : "Sin clases con el filtro";

      if (freeTodayEl) {
        const todaySlots = currentClasses
          .filter((cls) => isToday(cls.starts_at))
          .reduce((acc, cls) => {
            const cap = Number(cls.capacity || 0);
            const booked = Number(cls.booked_count || 0);
            return acc + Math.max(cap - booked, 0);
          }, 0);
        freeTodayEl.textContent = `${todaySlots} plazas`;
      }

      if (aiMatchesEl) {
        const matches = currentClasses.filter((cls) => isClassRecommended(cls, currentRecommendedTypeSet)).length;
        aiMatchesEl.textContent = `${matches} compatibles`;
      }
    };

    const paintFilterButtons = () => {
      filterButtons.forEach((btn) => {
        const active = btn.dataset.classFilter === currentFilter;
        btn.classList.toggle("active", active);
      });
    };

    const animateCards = (selector) => {
      const cards = Array.from(document.querySelectorAll(selector));
      if (!cards.length) return;
      cards.forEach((card) => card.classList.remove("is-visible"));
      requestAnimationFrame(() => {
        cards.forEach((card, index) => {
          window.setTimeout(() => {
            card.classList.add("is-visible");
          }, Math.min(index * 40, 320));
        });
      });
    };

    const renderClassList = () => {
      if (!listEl) return;
      const visible = applyFilters(currentClasses);
      listEl.innerHTML = visible.length
        ? visible.map((cls) => renderMemberClassCard(cls, currentRecommendedTypeSet)).join("")
        : "<p class='sub'>No hay clases con los filtros actuales.</p>";
      updateTopMetrics(visible);
      paintFilterButtons();
      setStatus(`Mostrando ${visible.length} de ${currentClasses.length} clases.`);
      animateCards("#member-classes .member-class-card");
    };

   const renderRecommendations = (state) => {
      if (recClassEl) recClassEl.innerHTML = renderRecommendationClasses(state.classes);
      if (recDietEl && isPremium) recDietEl.innerHTML = renderRecommendationDiets(state.diets);  // ← solo actualiza si es premium
      if (recMetaEl) recMetaEl.textContent = state.meta || "Recomendacion IA";
      if (recNotesEl) recNotesEl.textContent = state.notes ? `Nota IA: ${state.notes}` : "";
      animateCards("#member-rec-classes .member-rec-card");
      animateCards("#member-rec-diets .member-rec-card");
    };

    const loadClasses = async () => {
      setStatus("Cargando clases...");
      if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.textContent = "Actualizando...";
      }
      // Skeleton mientras carga
      if (listEl) {
        listEl.innerHTML = Array.from({ length: 3 }, () => `
          <div class="skeleton-card">
            <div class="skeleton skeleton-thumb"></div>
            <div class="skeleton skeleton-badge"></div>
            <div class="skeleton skeleton-line med"></div>
            <div class="skeleton skeleton-line short"></div>
            <div class="skeleton skeleton-line full"></div>
          </div>`).join("");
      }
      try {
        const data = await gymService.listClasses();
        currentClasses = data
          .slice()
          .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
        renderClassList();
      } catch (err) {
        console.error(err);
        setStatus(err.message || "No se pudieron cargar las clases.", true);
      } finally {
        if (refreshBtn) {
          refreshBtn.disabled = false;
          refreshBtn.textContent = "Actualizar clases";
        }
      }
    };

    const loadRecommendations = async () => {
      setRecStatus("Generando recomendacion IA...");
      if (recRefreshBtn) {
        recRefreshBtn.disabled = true;
        recRefreshBtn.textContent = "Actualizando...";
      }
      try {
        const res = await trainingService.getMyRecommendation(recommendationParams);
        const recDoc = res.recommendation;
        const recPayload = getRecommendationPayload(recDoc);
        currentRecommendationDoc = recDoc;
        currentRecommendations = {
          classes: normalizeRecommendedSessions(recPayload, classTypes),
          diets: normalizeDietRecommendations(recPayload, recommendationParams.goal),
          notes: String(firstFilled(recPayload, ["notes", "note", "advice", "summary", "tips"], "")).trim(),
          meta: formatRecommendationMeta(recDoc, res.cached),
        };
        currentRecommendedTypeSet = toRecommendedTypeSet(currentRecommendations);
        renderRecommendations(currentRecommendations);
        renderClassList();
        setRecStatus(
          res.cached
            ? "Mostrando recomendacion en cache (vigencia 7 dias)."
            : "Recomendacion IA actualizada."
        );
      } catch (err) {
        console.error(err);
        setRecStatus(err.message || "No se pudo cargar la recomendacion IA.", true);
      } finally {
        if (recRefreshBtn) {
          recRefreshBtn.disabled = false;
          recRefreshBtn.textContent = "Actualizar recomendacion";
        }
      }
    };

    const saveRecommendation = async () => {
      const recPayload = getRecommendationPayload(currentRecommendationDoc);
      const hasPayload =
        recPayload &&
        typeof recPayload === "object" &&
        !Array.isArray(recPayload) &&
        Object.keys(recPayload).length > 0;
      if (!hasPayload) {
        setRecStatus("Primero genera una recomendacion antes de guardarla.", true);
        return;
      }

      setRecStatus("Guardando plan en recommendations...");
      if (recSaveBtn) {
        recSaveBtn.disabled = true;
        recSaveBtn.textContent = "Guardando...";
      }

      try {
        const saveRes = await trainingService.saveMyRecommendation({
          _id: currentRecommendationDoc?._id || undefined,
          recommendation: recPayload,
          profile: recommendationProfile,
          level: recommendationProfile.experience_level,
          source: currentRecommendationDoc?.source || "manual_save",
        });
        if (saveRes.recommendation) {
          currentRecommendationDoc = saveRes.recommendation;
          currentRecommendations = {
            ...currentRecommendations,
            meta: formatRecommendationMeta(saveRes.recommendation, false),
          };
          renderRecommendations(currentRecommendations);
        }
        localStorage.setItem("smartgym_saved_recommendation_updated_at", new Date().toISOString());
        window.dispatchEvent(new Event("smartgym:recommendation-saved"));
        setRecStatus(saveRes.message || "Plan guardado correctamente.");
      } catch (err) {
        console.error(err);
        setRecStatus(err.message || "No se pudo guardar el plan.", true);
      } finally {
        if (recSaveBtn) {
          recSaveBtn.disabled = false;
          recSaveBtn.textContent = "Guardar plan";
        }
      }
    };

    refreshBtn?.addEventListener("click", () => loadClasses());
    recRefreshBtn?.addEventListener("click", () => loadRecommendations());
    recSaveBtn?.addEventListener("click", () => saveRecommendation());
    filterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        currentFilter = btn.dataset.classFilter || "available";
        renderClassList();
      });
    });

    searchEl?.addEventListener("input", () => {
      currentSearch = normalizeText(searchEl.value);
      renderClassList();
    });

    listEl?.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      const action = btn.dataset.action;
      const msgEl = document.querySelector(`#member-msg-${id}`);
      const toggle = (isLoading, label) => {
        btn.disabled = isLoading;
        if (!btn.dataset.label) btn.dataset.label = btn.textContent;
        btn.textContent = isLoading ? label : btn.dataset.label;
      };
      try {
        if (action === "reserve") {
          toggle(true, "Reservando...");
          await gymService.reserveClass(id);
          if (msgEl) msgEl.textContent = "Reserva confirmada.";
        }
        if (action === "cancel") {
          toggle(true, "Cancelando...");
          await gymService.cancelReservation(id);
          if (msgEl) msgEl.textContent = "Reserva cancelada.";
        }
        await loadClasses();
      } catch (err) {
        if (msgEl) msgEl.textContent = err.message || "Error al procesar.";
      } finally {
        toggle(false);
      }
    });

    renderRecommendations(currentRecommendations);
    renderClassList();
  }, 0);

  return `
    <div class="bg-blobs"></div>
    <div class="screen">
      ${Navbar()}
      <main class="container" style="padding-bottom:28px;">
        <section class="hero">
          <div class="card" style="display:flex; flex-direction:column; gap:16px;">
            <div style="display:flex; justify-content:space-between; gap:14px; align-items:flex-start; flex-wrap:wrap;">
              <div>
                <div class="kicker member-hero-kicker">MEMBER AREA</div>
                <h1 class="member-hero-title">Hola, <span>${escapeHtml(name)}</span></h1>
                <p class="sub member-hero-sub">Reserva en menos clics: filtra rapido, ve aforo y sigue sugerencias personalizadas.</p>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <a class="btn btn-ghost" href="#/mis-reservas">Mis reservas</a>
                <button class="btn btn-primary" id="member-refresh" type="button">Actualizar clases</button>
              </div>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px;">
              <div class="card" style="padding:14px; box-shadow:none; background:var(--surface-2); border-color:var(--border);">
                <div class="kicker">Visibles</div>
                <div style="font-size:22px; font-weight:1000;" id="member-visible-count">${sortedClasses.length} clases</div>
              </div>
              <div class="card" style="padding:14px; box-shadow:none; background:var(--surface-2); border-color:var(--border);">
                <div class="kicker">Proxima clase</div>
                <div style="font-size:15px; font-weight:900;" id="member-next-class">${sortedClasses[0] ? escapeHtml(fmtDate(sortedClasses[0].starts_at)) : "Sin clases"}</div>
              </div>
              <div class="card" style="padding:14px; box-shadow:none; background:var(--surface-2); border-color:var(--border);">
                <div class="kicker">Plazas hoy</div>
                <div style="font-size:22px; font-weight:1000;" id="member-free-today">--</div>
              </div>
              <div class="card" style="padding:14px; box-shadow:none; background:var(--surface-2); border-color:var(--border);">
                <div class="kicker">Compatibles IA</div>
                <div style="font-size:22px; font-weight:1000;" id="member-ai-matches">--</div>
              </div>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:14px; align-items:start;">
              <section class="card" style="display:flex; flex-direction:column; gap:12px; background:var(--surface-2); border-color:var(--border); box-shadow:none;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                  <div>
                    <div class="kicker">Clases disponibles</div>
                    <div class="dim" id="member-status">Conectado al servicio de clases.</div>
                  </div>
                  <input id="member-search" type="text" placeholder="Buscar por tipo, coach o sala..." style="max-width:280px; width:100%;" />
                </div>

                <div style="display:flex; flex-wrap:wrap; gap:8px;">
                  <button class="tab-btn active" type="button" data-class-filter="available">Con plazas</button>
                  <button class="tab-btn" type="button" data-class-filter="today">Hoy</button>
                  <button class="tab-btn" type="button" data-class-filter="week">Semana</button>
                  <button class="tab-btn" type="button" data-class-filter="high">Alta demanda</button>
                  <button class="tab-btn" type="button" data-class-filter="ai">Sugeridas IA</button>
                  <button class="tab-btn" type="button" data-class-filter="all">Todas</button>
                </div>

                <div class="member-demand-legend">
                  <span class="member-demand-badge member-demand-low">Baja demanda</span>
                  <span class="member-demand-badge member-demand-medium">Demanda media</span>
                  <span class="member-demand-badge member-demand-high">Alta demanda</span>
                </div>

                <div id="member-classes" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:12px;">
                  ${initialClassCards}
                </div>
              </section>

              <aside class="card" style="display:flex; flex-direction:column; gap:12px; background:var(--surface-2); border-color:var(--border); box-shadow:none;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                  <div>
                    <div class="kicker">Recomendacion personalizada</div>
                    <div class="dim" id="member-rec-meta">${escapeHtml(initialRecState.meta || "Sin metadatos")}</div>
                  </div>
                  <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="btn btn-primary" id="member-rec-save" type="button">Guardar plan</button>
                    <button class="btn btn-ghost" id="member-rec-refresh" type="button">Actualizar recomendacion</button>
                  </div>
                </div>

                <div class="dim" id="member-rec-status">Plan IA listo para revisar.</div>

                <div style="display:flex; flex-direction:column; gap:10px;">
                  <div class="kicker">Clases objetivo</div>
                  <div id="member-rec-classes" style="display:grid; gap:10px;">
                    ${initialRecClassCards}
                  </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:10px;">
                  <div class="kicker">Dieta sugerida</div>
                  ${isPremium
                    ? `<div id="member-rec-diets" style="display:grid; gap:10px;">${initialRecDietCards}</div>`
                    : `<div id="member-rec-diets" style="display:grid; gap:10px;">
                        <div style="padding:18px; border-radius:12px; background:linear-gradient(135deg,rgba(92,123,255,.12),rgba(40,205,180,.10)); border:1.5px dashed rgba(92,123,255,.4); text-align:center; display:flex; flex-direction:column; gap:10px; align-items:center;">
                          <span style="font-size:28px;">🔒</span>
                          <div style="font-weight:900; font-size:15px;">Contenido Premium</div>
                          <p class="sub" style="margin:0;">La nutrición personalizada está disponible para usuarios Premium. <a href="#/suscripcion" style="color:var(--accent); font-weight:700;">Actualizar plan →</a></p>
                        </div>
                      </div>`
                  }
                </div>

                <p class="sub" id="member-rec-notes" style="margin:0;">${initialRecNotes}</p>
              </aside>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}