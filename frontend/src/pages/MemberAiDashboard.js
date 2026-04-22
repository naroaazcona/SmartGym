import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { authService } from "../services/authService.js";
import { navigate, showToast } from "../router.js";
import { gymService } from "../services/gymService.js";
import { trainingService } from "../services/trainingService.js";
import { apiFetch } from "../api/client.js";
import {
  buildRecommendationParams,
  buildRecommendationProfile,
  escapeHtml,
  firstFilled,
  formatRecommendationMeta,
  getRecommendationPayload,
  normalizeDietRecommendations,
  normalizeRecommendedSessions,
  normalizeText,
  repairText,
} from "./memberHelpers.js";

const GOAL_OPTIONS = [
  { value: "perder_peso", label: "Perder peso" },
  { value: "ganar_musculo", label: "Ganar musculo" },
  { value: "mejorar_resistencia", label: "Mejorar resistencia" },
  { value: "mantenerse_en_forma", label: "Mantenerse en forma" },
  { value: "reducir_estres", label: "Reducir estres" },
  { value: "mejorar_condicion_fisica", label: "Mejorar condicion fisica" },
];

const PREFERRED_TRAINING_OPTIONS = [
  { value: "fuerza", label: "Fuerza" },
  { value: "cardio", label: "Cardio" },
  { value: "hiit", label: "HIIT" },
  { value: "yoga_pilates", label: "Yoga / Pilates" },
  { value: "funcional", label: "Funcional" },
  { value: "crossfit", label: "CrossFit" },
];

const INJURY_OPTIONS = [
  { value: "ninguna", label: "Ninguna" },
  { value: "rodilla", label: "Rodilla" },
  { value: "espalda", label: "Espalda" },
  { value: "hombro", label: "Hombro" },
  { value: "tobillo", label: "Tobillo / Pie" },
  { value: "muneca", label: "Muneca / Codo" },
];

const EQUIPMENT_OPTIONS = [
  { value: "gimnasio_completo", label: "Gimnasio completo" },
  { value: "mancuernas", label: "Mancuernas" },
  { value: "bandas_elasticas", label: "Bandas elasticas" },
  { value: "peso_corporal", label: "Solo peso corporal" },
  { value: "bicicleta", label: "Bicicleta / Cinta" },
];

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
          <div class="field-label">${escapeHtml(item.day)}</div>
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
    <div class="kicker">Nutrición</div>
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

const toValueArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[;,]+/)
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeInjuryValue = (value) => {
  const normalized = normalizeText(value).replace(/\s+/g, "_");
  if (normalized === "muneca" || normalized === "muneca_codo") return "muneca";
  if (normalized === "ninguno" || normalized === "ningun") return "ninguna";
  return normalized;
};

const normalizeTrainingPreferences = (doc, recommendationParams = {}) => {
  const source =
    doc && typeof doc === "object" && doc.preferences && typeof doc.preferences === "object"
      ? doc.preferences
      : doc && typeof doc === "object"
      ? doc
      : {};

  const goal = String(source.goal || recommendationParams.goal || "mejorar_condicion_fisica");
  const experienceLevel = String(source.experience_level || source.level || recommendationParams.level || "beginner");
  const daysNum = Number(source.days_per_week || source.days || recommendationParams.days || 3);
  const daysPerWeek = Number.isFinite(daysNum) && daysNum > 0 ? Math.round(daysNum) : 3;

  const preferredTraining = Array.from(
    new Set(toValueArray(source.preferred_training).map((value) => normalizeText(value).replace(/\s+/g, "_")))
  );

  const injurySet = new Set(
    toValueArray(source.injuries)
      .map((value) => normalizeInjuryValue(value))
      .filter(Boolean)
  );
  if (!injurySet.size) injurySet.add("ninguna");
  if (injurySet.has("ninguna") && injurySet.size > 1) injurySet.delete("ninguna");

  const availableEquipment = Array.from(
    new Set(toValueArray(source.available_equipment).map((value) => normalizeText(value).replace(/\s+/g, "_")))
  );

  return {
    goal,
    experience_level: experienceLevel,
    days_per_week: daysPerWeek,
    preferred_training: preferredTraining,
    injuries: Array.from(injurySet),
    available_equipment: availableEquipment,
  };
};

const renderPreferenceCheckboxes = (name, options, selectedValues = []) => {
  const selected = new Set(Array.isArray(selectedValues) ? selectedValues : []);
  return options
    .map(
      (option) => `
        <label class="member-pref-option">
          <input type="checkbox" name="${name}" value="${option.value}" ${selected.has(option.value) ? "checked" : ""} />
          <span>${escapeHtml(option.label)}</span>
        </label>
      `
    )
    .join("");
};

const formatLogDate = (value) => {
  if (!value) return "Fecha sin registrar";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Fecha invalida";
  return parsed.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const renderTrainingLogs = (logs = []) => {
  if (!logs.length) {
    return `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff5b2e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18"/><path d="M6 11h12"/><path d="M9 15h6"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
        </div>
        <p class="empty-title">Sin entrenamientos registrados</p>
        <p class="empty-sub">Usa el formulario para registrar tu primera sesion.</p>
      </div>
    `;
  }

  return `
    <ul class="list" style="margin:0;">
      ${logs
        .map((log) => {
          const title = repairText(log?.title || "Entrenamiento");
          const notes = repairText(log?.notes || "");
          const dateLabel = formatLogDate(log?.date || log?.createdAt);
          const duration = Number(log?.duration_min || 0);
          return `
            <li class="row" style="align-items:flex-start; justify-content:space-between; gap:12px;">
              <div style="flex:1; min-width:0;">
                <div style="font-weight:1000;">${escapeHtml(title)}</div>
                <div class="dim">${escapeHtml(dateLabel)}</div>
                ${notes ? `<div class="dim" style="margin-top:4px;">${escapeHtml(notes)}</div>` : ""}
              </div>
              ${duration > 0 ? `<span class="badge">${duration} min</span>` : ""}
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
};

const toLocalDateTimeValue = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

export async function MemberAiDashboard() {
  const me = await authService.loadSession().catch(() => authStore.me);

  if (!authStore.token || !me) {
    navigate("/login");
    return "";
  }
  if (me.role && me.role !== "member") {
    navigate("/");
    return "";
  }

  let currentSubscription = null;
  try {
    const res = await apiFetch("/auth/subscription/me");
    currentSubscription = res?.subscription || null;
  } catch {
    currentSubscription = null;
  }

  const name = me?.profile?.firstName || me?.firstName || me?.name || me?.email || "Socio";
  const profilePlan = me?.profile?.subscriptionPlan || me?.subscriptionPlan || null;
  const activePlan = currentSubscription?.status === "active" ? currentSubscription?.plan : profilePlan;
  const isPremium = String(activePlan || "").toLowerCase() === "premium";
  const classTypes = await gymService.listClassTypes().catch(() => []);

  const recommendationParams = buildRecommendationParams(me?.profile || {});
  const recommendationProfile = buildRecommendationProfile(recommendationParams);
  const [initialPreferencesDoc, initialLogsResult] = await Promise.all([
    trainingService.getMyPreferences().catch(() => null),
    trainingService.getMyLogs(1, 8).catch(() => ({ logs: [], pagination: null })),
  ]);
  const initialPreferences = normalizeTrainingPreferences(initialPreferencesDoc, recommendationParams);
  const initialDaysNum = Number(initialPreferences.days_per_week || recommendationParams.days || 3);
  const initialDays = Number.isFinite(initialDaysNum) && initialDaysNum > 0 ? Math.round(initialDaysNum) : 3;
  const initialInjuries = Array.isArray(initialPreferences.injuries)
    ? initialPreferences.injuries.join(", ")
    : String(initialPreferences.injuries || recommendationParams.injuries || "ninguna");
  const initialPreferredTraining = Array.isArray(initialPreferences.preferred_training)
    ? initialPreferences.preferred_training.join(", ")
    : String(initialPreferences.preferred_training || "");
  const initialEquipment = Array.isArray(initialPreferences.available_equipment)
    ? initialPreferences.available_equipment.join(", ")
    : String(initialPreferences.available_equipment || "");
  const initialRecommendationRequest = {
    ...recommendationParams,
    level: String(initialPreferences.experience_level || recommendationParams.level || "beginner"),
    goal: String(initialPreferences.goal || recommendationParams.goal || "mejorar_condicion_fisica"),
    days: initialDays,
    injuries: initialInjuries,
    preferred_training: initialPreferredTraining,
    available_equipment: initialEquipment,
  };
  const initialRecResult = await trainingService
    .getMyRecommendation(initialRecommendationRequest)
    .catch(() => ({ recommendation: null, cached: false }));
  const initialRecDoc = initialRecResult.recommendation;
  const initialRecPayload = getRecommendationPayload(initialRecDoc);
  const initialRecState = {
    classes: normalizeRecommendedSessions(initialRecPayload, classTypes),
    diets: normalizeDietRecommendations(initialRecPayload, initialRecommendationRequest.goal),
    notes: repairText(String(firstFilled(initialRecPayload, ["notes", "note", "advice", "summary", "tips"], "")).trim()),
    meta: formatRecommendationMeta(initialRecDoc, initialRecResult.cached),
  };

  const initialRecClassCards = renderRecommendationClasses(initialRecState.classes);
  const initialRecDietCards = renderRecommendationDiets(initialRecState.diets);
  const initialRecNotes = initialRecState.notes ? `Nota IA: ${escapeHtml(initialRecState.notes)}` : "";
  const initialLogs = Array.isArray(initialLogsResult?.logs) ? initialLogsResult.logs : [];
  const initialPagination = initialLogsResult?.pagination || {};
  const initialGoalOptions = GOAL_OPTIONS.map(
    (opt) => `<option value="${opt.value}" ${opt.value === initialPreferences.goal ? "selected" : ""}>${escapeHtml(opt.label)}</option>`
  ).join("");
  const initialPreferredTrainingCheckboxes = renderPreferenceCheckboxes(
    "member-pref-training",
    PREFERRED_TRAINING_OPTIONS,
    initialPreferences.preferred_training
  );
  const initialInjuryCheckboxes = renderPreferenceCheckboxes(
    "member-pref-injuries",
    INJURY_OPTIONS,
    initialPreferences.injuries
  );
  const initialEquipmentCheckboxes = renderPreferenceCheckboxes(
    "member-pref-equipment",
    EQUIPMENT_OPTIONS,
    initialPreferences.available_equipment
  );
  const initialLogsHtml = renderTrainingLogs(initialLogs);
  const initialLogsTotal = Number(initialPagination.total || initialLogs.length || 0);
  const initialLogsPage = Number(initialPagination.page || 1);
  const initialLogsTotalPages = Number(initialPagination.totalPages || 1);

  setTimeout(() => {
    const recClassEl = document.querySelector("#member-rec-classes");
    const recDietEl = document.querySelector("#member-rec-diets");
    const recStatusEl = document.querySelector("#member-rec-status");
    const recMetaEl = document.querySelector("#member-rec-meta");
    const recNotesEl = document.querySelector("#member-rec-notes");
    const recSaveBtn = document.querySelector("#member-rec-save");
    const recRefreshBtn = document.querySelector("#member-rec-refresh");
    const prefTabBtn = document.querySelector("#member-scroll-preferences");
    const prefHubEl = document.querySelector("#member-pref-hub");

    const prefGoalEl = document.querySelector("#member-pref-goal");
    const prefStatusEl = document.querySelector("#member-pref-status");
    const prefSaveBtn = document.querySelector("#member-pref-save");
    const prefReloadBtn = document.querySelector("#member-pref-reload");
    const prefFormEl = document.querySelector("#member-pref-form");

    const logFormEl = document.querySelector("#member-log-form");
    const logTitleEl = document.querySelector("#member-log-title");
    const logDateEl = document.querySelector("#member-log-date");
    const logDurationEl = document.querySelector("#member-log-duration");
    const logNotesEl = document.querySelector("#member-log-notes");
    const logSaveBtn = document.querySelector("#member-log-save");
    const logRefreshBtn = document.querySelector("#member-log-refresh");
    const logLoadMoreBtn = document.querySelector("#member-log-more");
    const logStatusEl = document.querySelector("#member-log-status");
    const logListEl = document.querySelector("#member-log-list");
    const logCountEl = document.querySelector("#member-log-count");

    let currentRecommendations = { ...initialRecState };
    let currentRecommendationDoc = initialRecDoc || null;
    let currentPreferences = { ...initialPreferences };
    let currentLogs = initialLogs.slice();
    let currentLogPage = initialLogsPage;
    let currentLogTotalPages = initialLogsTotalPages;
    let currentLogTotal = initialLogsTotal;
    let recommendationLoadSeq = 0;
    let prefRecRefreshTimer = null;
    let lastPrefRecSignature = "";

    const setRecStatus = (txt, isError = false) => {
      if (!recStatusEl) return;
      recStatusEl.textContent = txt;
      recStatusEl.style.color = isError ? "#b42318" : "var(--muted)";
    };

    const setPrefStatus = (txt, isError = false) => {
      if (!prefStatusEl) return;
      prefStatusEl.textContent = txt;
      prefStatusEl.style.color = isError ? "#b42318" : "var(--muted)";
    };

    const setLogStatus = (txt, isError = false) => {
      if (!logStatusEl) return;
      logStatusEl.textContent = txt;
      logStatusEl.style.color = isError ? "#b42318" : "var(--muted)";
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

    const renderRecommendations = (state) => {
      if (recClassEl) recClassEl.innerHTML = renderRecommendationClasses(state.classes);
      if (recDietEl && isPremium) recDietEl.innerHTML = renderRecommendationDiets(state.diets);
      if (recMetaEl) recMetaEl.textContent = state.meta || "Recomendacion IA";
      if (recNotesEl) recNotesEl.textContent = state.notes ? `Nota IA: ${state.notes}` : "";
      animateCards("#member-rec-classes .member-rec-card");
      animateCards("#member-rec-diets .member-rec-card");
    };

    const loadRecommendations = async ({
      params = null,
      loadingText = "Generando recomendacion IA...",
      successText = "",
    } = {}) => {
      const requestId = ++recommendationLoadSeq;
      const requestParams = params && typeof params === "object" ? params : buildRecommendationRequestParams();
      const goalForDiet = String(firstFilled(requestParams, ["goal"], recommendationParams.goal) || recommendationParams.goal);

      setRecStatus(loadingText);
      if (recRefreshBtn) {
        recRefreshBtn.disabled = true;
        recRefreshBtn.textContent = "Actualizando...";
      }
      try {
        const res = await trainingService.getMyRecommendation(requestParams);
        if (requestId !== recommendationLoadSeq) return;
        const recDoc = res.recommendation;
        const recPayload = getRecommendationPayload(recDoc);
        currentRecommendationDoc = recDoc;
        currentRecommendations = {
          classes: normalizeRecommendedSessions(recPayload, classTypes),
          diets: normalizeDietRecommendations(recPayload, goalForDiet),
          notes: repairText(String(firstFilled(recPayload, ["notes", "note", "advice", "summary", "tips"], "")).trim()),
          meta: formatRecommendationMeta(recDoc, res.cached),
        };
        renderRecommendations(currentRecommendations);
        setRecStatus(
          successText ||
            (res.cached
              ? "Mostrando recomendacion en cache (vigencia 7 dias)."
              : "Recomendacion IA actualizada.")
        );
      } catch (err) {
        if (requestId !== recommendationLoadSeq) return;
        console.error(err);
        setRecStatus(err.message || "No se pudo cargar la recomendacion IA.", true);
      } finally {
        if (requestId === recommendationLoadSeq && recRefreshBtn) {
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

      setRecStatus("Guardando plan en recomendaciones...");
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
        showToast("Plan de entrenamiento guardado.", "success");
      } catch (err) {
        console.error(err);
        setRecStatus(err.message || "No se pudo guardar el plan.", true);
        showToast(err.message || "No se pudo guardar el plan.", "error");
      } finally {
        if (recSaveBtn) {
          recSaveBtn.disabled = false;
          recSaveBtn.textContent = "Guardar plan";
        }
      }
    };

    const readCheckedValues = (name) =>
      Array.from(document.querySelectorAll(`input[name='${name}']:checked`)).map((input) => input.value);

    const applyPreferencesToForm = (prefs) => {
      if (prefGoalEl) prefGoalEl.value = prefs.goal;

      const setChecked = (name, values) => {
        const selected = new Set(Array.isArray(values) ? values : []);
        document.querySelectorAll(`input[name='${name}']`).forEach((input) => {
          input.checked = selected.has(input.value);
        });
      };

      setChecked("member-pref-training", prefs.preferred_training);
      const injuries = prefs.injuries && prefs.injuries.length ? prefs.injuries : ["ninguna"];
      setChecked("member-pref-injuries", injuries);
      setChecked("member-pref-equipment", prefs.available_equipment);
    };

    const normalizeInjurySelection = (values = []) => {
      const normalized = Array.from(new Set(values.map((value) => normalizeInjuryValue(value)).filter(Boolean)));
      if (!normalized.length) return ["ninguna"];
      if (normalized.includes("ninguna") && normalized.length > 1) {
        return normalized.filter((value) => value !== "ninguna");
      }
      return normalized;
    };

    const collectPreferencePayload = () => {
      const goal = prefGoalEl?.value || currentPreferences.goal || "mejorar_condicion_fisica";
      const preferredTraining = readCheckedValues("member-pref-training");
      const injuries = normalizeInjurySelection(readCheckedValues("member-pref-injuries"));
      const availableEquipment = readCheckedValues("member-pref-equipment");

      return {
        ...currentPreferences,
        goal,
        preferred_training: preferredTraining,
        injuries: injuries.join(", "),
        available_equipment: availableEquipment,
        completedAt: new Date().toISOString(),
      };
    };

    const buildRecommendationRequestParams = (preferences = currentPreferences) => {
      const source = preferences && typeof preferences === "object" ? preferences : {};
      const daysValue = Number(source.days_per_week || recommendationParams.days || 3);
      const days = Number.isFinite(daysValue) && daysValue > 0 ? Math.round(daysValue) : 3;
      const injuryValues = normalizeInjurySelection(
        Array.isArray(source.injuries) ? source.injuries : toValueArray(source.injuries)
      );
      const preferredTraining = Array.isArray(source.preferred_training)
        ? source.preferred_training
        : toValueArray(source.preferred_training);
      const availableEquipment = Array.isArray(source.available_equipment)
        ? source.available_equipment
        : toValueArray(source.available_equipment);

      return {
        ...recommendationParams,
        level: String(source.experience_level || recommendationParams.level || "beginner"),
        goal: String(source.goal || recommendationParams.goal || "mejorar_condicion_fisica"),
        days,
        injuries: injuryValues.join(", "),
        preferred_training: preferredTraining.join(", "),
        available_equipment: availableEquipment.join(", "),
      };
    };

    const scheduleRecommendationRefreshFromPreferences = () => {
      const draftPayload = collectPreferencePayload();
      const draftPreferences = normalizeTrainingPreferences(draftPayload, recommendationParams);
      const params = buildRecommendationRequestParams(draftPreferences);
      const signature = JSON.stringify(params);

      if (signature === lastPrefRecSignature) return;
      if (prefRecRefreshTimer) window.clearTimeout(prefRecRefreshTimer);

      setRecStatus("Detectados cambios en preferencias. Actualizando recomendacion IA...");
      prefRecRefreshTimer = window.setTimeout(() => {
        prefRecRefreshTimer = null;
        lastPrefRecSignature = signature;
        loadRecommendations({
          params,
          loadingText: "Actualizando recomendacion segun tus preferencias...",
          successText: "Recomendacion IA ajustada a los cambios del formulario.",
        }).catch(() => {});
      }, 850);
    };

    const savePreferences = async () => {
      const payload = collectPreferencePayload();
      setPrefStatus("Guardando preferencias...");
      if (prefSaveBtn) {
        prefSaveBtn.disabled = true;
        prefSaveBtn.textContent = "Guardando...";
      }
      try {
        const res = await trainingService.saveMyPreferences(payload);
        currentPreferences = normalizeTrainingPreferences(res?.preferences || payload, recommendationParams);
        applyPreferencesToForm(currentPreferences);
        setPrefStatus(res?.message || "Preferencias guardadas.");
        showToast("Preferencias de entrenamiento actualizadas.", "success");
        if (prefRecRefreshTimer) {
          window.clearTimeout(prefRecRefreshTimer);
          prefRecRefreshTimer = null;
        }
        const params = buildRecommendationRequestParams(currentPreferences);
        lastPrefRecSignature = JSON.stringify(params);
        loadRecommendations({
          params,
          loadingText: "Generando recomendacion con preferencias guardadas...",
        }).catch(() => {});
      } catch (err) {
        console.error(err);
        setPrefStatus(err.message || "No se pudieron guardar las preferencias.", true);
        showToast(err.message || "No se pudieron guardar las preferencias.", "error");
      } finally {
        if (prefSaveBtn) {
          prefSaveBtn.disabled = false;
          prefSaveBtn.textContent = "Guardar preferencias";
        }
      }
    };

    const reloadPreferences = async () => {
      setPrefStatus("Cargando preferencias...");
      if (prefReloadBtn) {
        prefReloadBtn.disabled = true;
        prefReloadBtn.textContent = "Recargando...";
      }
      try {
        const freshDoc = await trainingService.getMyPreferences();
        currentPreferences = normalizeTrainingPreferences(freshDoc, recommendationParams);
        applyPreferencesToForm(currentPreferences);
        const params = buildRecommendationRequestParams(currentPreferences);
        lastPrefRecSignature = JSON.stringify(params);
        loadRecommendations({
          params,
          loadingText: "Actualizando recomendacion con preferencias sincronizadas...",
          successText: "Recomendacion IA sincronizada.",
        }).catch(() => {});
        setPrefStatus("Preferencias sincronizadas con el servidor.");
      } catch (err) {
        console.error(err);
        setPrefStatus(err.message || "No se pudieron cargar las preferencias.", true);
      } finally {
        if (prefReloadBtn) {
          prefReloadBtn.disabled = false;
          prefReloadBtn.textContent = "Recargar";
        }
      }
    };

    const renderLogs = () => {
      if (logListEl) logListEl.innerHTML = renderTrainingLogs(currentLogs);
      if (logCountEl) logCountEl.textContent = `${currentLogs.length}/${currentLogTotal} entrenamientos`;
      if (logLoadMoreBtn) {
        const hasMore = currentLogPage < currentLogTotalPages;
        logLoadMoreBtn.style.display = hasMore ? "inline-flex" : "none";
        logLoadMoreBtn.disabled = false;
        logLoadMoreBtn.textContent = "Cargar mas";
      }
    };

    const loadLogs = async ({ page = 1, append = false, silent = false } = {}) => {
      if (!silent) setLogStatus("Cargando historial...");
      try {
        const res = await trainingService.getMyLogs(page, 8);
        const logs = Array.isArray(res?.logs) ? res.logs : [];
        const pagination = res?.pagination || {};

        currentLogPage = Number(pagination.page || page || 1);
        currentLogTotalPages = Number(pagination.totalPages || 1);
        currentLogTotal = Number(pagination.total || logs.length || 0);
        currentLogs = append ? currentLogs.concat(logs) : logs;
        renderLogs();
        setLogStatus(`Mostrando ${currentLogs.length} de ${currentLogTotal} entrenamientos.`);
      } catch (err) {
        console.error(err);
        setLogStatus(err.message || "No se pudo cargar el historial.", true);
      } finally {
        if (logRefreshBtn) {
          logRefreshBtn.disabled = false;
          logRefreshBtn.textContent = "Actualizar historial";
        }
      }
    };

    const setDefaultLogDate = () => {
      if (!logDateEl) return;
      if (!logDateEl.value) {
        logDateEl.value = toLocalDateTimeValue(new Date());
      }
    };

    const submitLog = async (event) => {
      event.preventDefault();
      const title = String(logTitleEl?.value || "").trim();
      if (!title) {
        setLogStatus("El titulo del entrenamiento es obligatorio.", true);
        return;
      }

      const payload = { title };
      const rawDate = String(logDateEl?.value || "").trim();
      if (rawDate) {
        const parsed = new Date(rawDate);
        if (!Number.isNaN(parsed.getTime())) payload.date = parsed.toISOString();
      }

      const rawDuration = Number(logDurationEl?.value || 0);
      if (Number.isFinite(rawDuration) && rawDuration > 0) {
        payload.duration_min = Math.round(rawDuration);
      }

      const notes = String(logNotesEl?.value || "").trim();
      if (notes) payload.notes = notes;

      setLogStatus("Registrando entrenamiento...");
      if (logSaveBtn) {
        logSaveBtn.disabled = true;
        logSaveBtn.textContent = "Guardando...";
      }

      try {
        const res = await trainingService.createLog(payload);
        if (logFormEl) logFormEl.reset();
        setDefaultLogDate();
        await loadLogs({ page: 1, append: false, silent: true });
        setLogStatus(res?.message || "Entrenamiento registrado.");
        showToast("Entrenamiento registrado en el historial.", "success");
        loadRecommendations({
          params: buildRecommendationRequestParams(),
          loadingText: "Actualizando recomendacion con tu nuevo entrenamiento...",
          successText: "Recomendacion IA actualizada tras registrar entrenamiento.",
        }).catch(() => {});
      } catch (err) {
        console.error(err);
        setLogStatus(err.message || "No se pudo registrar el entrenamiento.", true);
        showToast(err.message || "No se pudo registrar el entrenamiento.", "error");
      } finally {
        if (logSaveBtn) {
          logSaveBtn.disabled = false;
          logSaveBtn.textContent = "Registrar entrenamiento";
        }
      }
    };

    recRefreshBtn?.addEventListener("click", () => loadRecommendations());
    recSaveBtn?.addEventListener("click", () => saveRecommendation());
    prefSaveBtn?.addEventListener("click", () => savePreferences());
    prefReloadBtn?.addEventListener("click", () => reloadPreferences());
    prefFormEl?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;

      if (target instanceof HTMLInputElement && target.name === "member-pref-injuries") {
        const allInjuries = Array.from(document.querySelectorAll("input[name='member-pref-injuries']"));
        if (target.value === "ninguna" && target.checked) {
          allInjuries.forEach((item) => {
            if (item.value !== "ninguna") item.checked = false;
          });
        }
        if (target.value !== "ninguna" && target.checked) {
          const noneInput = allInjuries.find((item) => item.value === "ninguna");
          if (noneInput) noneInput.checked = false;
        }
        const anyChecked = allInjuries.some((item) => item.checked);
        if (!anyChecked) {
          const noneInput = allInjuries.find((item) => item.value === "ninguna");
          if (noneInput) noneInput.checked = true;
        }
      }

      scheduleRecommendationRefreshFromPreferences();
    });
    logFormEl?.addEventListener("submit", submitLog);
    logRefreshBtn?.addEventListener("click", async () => {
      if (logRefreshBtn) {
        logRefreshBtn.disabled = true;
        logRefreshBtn.textContent = "Actualizando...";
      }
      await loadLogs({ page: 1, append: false, silent: false });
    });
    logLoadMoreBtn?.addEventListener("click", async () => {
      if (currentLogPage >= currentLogTotalPages) return;
      logLoadMoreBtn.disabled = true;
      logLoadMoreBtn.textContent = "Cargando...";
      await loadLogs({ page: currentLogPage + 1, append: true, silent: true });
    });
    prefTabBtn?.addEventListener("click", () => {
      prefHubEl?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    renderRecommendations(currentRecommendations);
    applyPreferencesToForm(currentPreferences);
    lastPrefRecSignature = JSON.stringify(buildRecommendationRequestParams(currentPreferences));
    renderLogs();
    setDefaultLogDate();
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
                <h2 class="h2" style="margin:0;">Entrenamientos y Dieta para <span>${escapeHtml(name)}</span></h2>
                <p class="sub member-hero-sub">Genera, revisa y guarda tu plan personalizado. La dieta se muestra en plan Premium.</p>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <a class="btn btn-ghost" href="#/member">Clases</a>
                <a class="btn btn-ghost" href="#/mis-reservas">Mis reservas</a>
              </div>
            </div>

            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              <span class="tab-btn active" style="display:inline-flex; align-items:center;">Entrenamientos y Dieta</span>
              <button
                class="tab-btn member-tab-link"
                id="member-scroll-preferences"
                type="button"
                style="display:inline-flex; align-items:center;"
              >
                Preferencias e historial
              </button>
            </div>

            <aside class="card" style="display:flex; flex-direction:column; gap:12px; background:var(--surface-2); border-color:var(--border); box-shadow:none;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                <div>
                  <div class="kicker card-start-kicker">Recomendación personalizada</div>
                  <div class="dim" id="member-rec-meta">${escapeHtml(initialRecState.meta || "Sin metadatos")}</div>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  <button class="btn btn-primary" id="member-rec-save" type="button">Guardar plan</button>
                  <button class="btn btn-ghost" id="member-rec-refresh" type="button">Actualizar recomendación</button>
                </div>
              </div>

              <div class="dim" id="member-rec-status">Plan IA listo para revisar.</div>

              <div style="display:flex; flex-direction:column; gap:10px;">
                <div class="kicker">Entrenamientos objetivo</div>
                <div id="member-rec-classes" style="display:grid; gap:10px;">
                  ${initialRecClassCards}
                </div>
              </div>

              <div style="display:flex; flex-direction:column; gap:10px;">
                <div class="kicker">Dieta sugerida</div>
                ${
                  isPremium
                    ? `<div id="member-rec-diets" style="display:grid; gap:10px;">${initialRecDietCards}</div>`
                    : `<div id="member-rec-diets" style="display:grid; gap:10px;">
                        <div style="padding:18px; border-radius:12px; background:linear-gradient(135deg,rgba(92,123,255,.12),rgba(40,205,180,.10)); border:1.5px dashed rgba(92,123,255,.4); text-align:center; display:flex; flex-direction:column; gap:10px; align-items:center;">
                          <div style="font-weight:900; font-size:15px;">Contenido Premium</div>
                          <p class="sub" style="margin:0;">La nutrición personalizada está disponible para usuarios Premium. <a href="#/suscripcion" style="color:var(--accent); font-weight:700;">Actualizar plan -></a></p>
                        </div>
                      </div>`
                }
              </div>

              <p class="sub" id="member-rec-notes" style="margin:0;">${initialRecNotes}</p>
            </aside>

            <aside
              class="card member-pref-card"
              id="member-pref-hub"
              style="display:flex; flex-direction:column; gap:12px; background:var(--surface-2); border-color:var(--border); box-shadow:none;"
            >
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                <div>
                  <div class="kicker card-start-kicker">Preferencias de entrenamiento</div>
                  <div class="dim">Puedes cambiar objetivo, lesiones y equipamiento en cualquier momento.</div>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  <button class="btn btn-primary" id="member-pref-save" type="button">Guardar preferencias</button>
                  <button class="btn btn-ghost" id="member-pref-reload" type="button">Recargar</button>
                </div>
              </div>

              <form id="member-pref-form" class="member-pref-form" style="display:flex; flex-direction:column; gap:12px;">
                <label class="member-pref-field" style="display:flex; flex-direction:column; gap:6px;">
                  <span class="field-label">Objetivo</span>
                  <select id="member-pref-goal">${initialGoalOptions}</select>
                </label>

                <div class="member-pref-section" style="display:flex; flex-direction:column; gap:8px;">
                  <span class="field-label">Entrenamiento preferido</span>
                  <div class="member-pref-options-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:8px;">
                    ${initialPreferredTrainingCheckboxes}
                  </div>
                </div>

                <div class="member-pref-section" style="display:flex; flex-direction:column; gap:8px;">
                  <span class="field-label">Lesiones o limitaciones</span>
                  <div class="member-pref-options-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:8px;">
                    ${initialInjuryCheckboxes}
                  </div>
                </div>

                <div class="member-pref-section" style="display:flex; flex-direction:column; gap:8px;">
                  <span class="field-label">Equipamiento disponible</span>
                  <div class="member-pref-options-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:8px;">
                    ${initialEquipmentCheckboxes}
                  </div>
                </div>
              </form>

              <div class="dim" id="member-pref-status">Preferencias cargadas.</div>
            </aside>

            <aside class="card" style="display:flex; flex-direction:column; gap:12px; background:var(--surface-2); border-color:var(--border); box-shadow:none;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                <div>
                  <div class="kicker card-start-kicker">Registro de entrenamientos</div>
                  <div class="dim">Registra tus sesiones y consulta el historial.</div>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  <button class="btn btn-ghost" id="member-log-refresh" type="button">Actualizar historial</button>
                </div>
              </div>

              <form id="member-log-form" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; align-items:end;">
                <label style="display:flex; flex-direction:column; gap:6px; min-width:180px;">
                  <span class="field-label">Entrenamiento</span>
                  <input id="member-log-title" type="text" required maxlength="120" placeholder="Ej: Fuerza tren superior" />
                </label>
                <label style="display:flex; flex-direction:column; gap:6px; min-width:180px;">
                  <span class="field-label">Fecha y hora</span>
                  <input id="member-log-date" type="datetime-local" />
                </label>
                <label style="display:flex; flex-direction:column; gap:6px; min-width:140px;">
                  <span class="field-label">Duracion (min)</span>
                  <input id="member-log-duration" type="number" min="1" max="480" step="1" placeholder="45" />
                </label>
                <label style="display:flex; flex-direction:column; gap:6px; min-width:220px; grid-column:1/-1;">
                  <span class="field-label">Notas (opcional)</span>
                  <textarea id="member-log-notes" rows="2" maxlength="400" placeholder="Sensaciones, carga usada, etc."></textarea>
                </label>
                <div style="display:flex; justify-content:flex-end; grid-column:1/-1;">
                  <button class="btn btn-primary" id="member-log-save" type="submit">Registrar entrenamiento</button>
                </div>
              </form>

              <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                <div class="dim" id="member-log-status">Historial listo.</div>
                <div class="dim" id="member-log-count">${initialLogs.length}/${initialLogsTotal} entrenamientos</div>
              </div>

              <div id="member-log-list">
                ${initialLogsHtml}
              </div>

              <div style="display:flex; justify-content:center;">
                <button class="btn btn-ghost" id="member-log-more" type="button" ${initialLogsPage < initialLogsTotalPages ? "" : "style='display:none;'"}>Cargar mas</button>
              </div>
            </aside>
          </div>
        </section>
      </main>
    </div>
  `;
}
