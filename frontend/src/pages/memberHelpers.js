export const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const BROKEN_UTF8_RE = /[\u00C3\u00C2\u00E2]/;

const decodeUtf8FromLatin1 = (value) => {
  const bytes = new Uint8Array(Array.from(value).map((ch) => ch.charCodeAt(0) & 0xff));
  return new TextDecoder("utf-8").decode(bytes);
};

export const repairText = (value) => {
  const raw = String(value ?? "");
  if (!raw || !BROKEN_UTF8_RE.test(raw)) return raw;

  let fixed = raw;
  for (let i = 0; i < 2; i += 1) {
    if (!BROKEN_UTF8_RE.test(fixed)) break;
    try {
      const candidate = decodeUtf8FromLatin1(fixed);
      if (!candidate || candidate === fixed) break;
      fixed = candidate;
    } catch {
      break;
    }
  }

  return fixed.replace(/\u00C2/g, "");
};

export const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export const firstFilled = (obj, keys = [], fallback = "") => {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

export const firstArray = (obj, keys = []) => {
  for (const key of keys) {
    const value = obj?.[key];
    if (Array.isArray(value)) return value;
  }
  return [];
};

export const toPositiveInt = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
};

export const asDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const isToday = (value) => {
  const d = asDate(value);
  if (!d) return false;
  const start = startOfToday();
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return d >= start && d < end;
};

export const isWithinNextDays = (value, days = 7) => {
  const d = asDate(value);
  if (!d) return false;
  const start = startOfToday();
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return d >= start && d < end;
};

export const formatClassDate = (iso) =>
  new Date(iso).toLocaleString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export const buildRecommendationParams = (profile = {}) => ({
  level: firstFilled(profile, ["experienceLevel", "experience_level", "level"], "beginner"),
  goal: firstFilled(profile, ["goal", "fitnessGoal"], "mejorar condicion fisica"),
  days: toPositiveInt(firstFilled(profile, ["daysPerWeek", "days_per_week", "days"], 3), 3),
  injuries: firstFilled(profile, ["injuries", "limitations"], "ninguna"),
  gender: firstFilled(profile, ["gender"], ""),
  weight: firstFilled(profile, ["weightKg", "weight_kg"], ""),
  height: firstFilled(profile, ["heightCm", "height_cm"], ""),
});

export const buildRecommendationProfile = (params = {}) => ({
  experience_level: firstFilled(params, ["experience_level", "level"], "beginner"),
  goal: firstFilled(params, ["goal"], "mejorar condicion fisica"),
  days_per_week: toPositiveInt(firstFilled(params, ["days_per_week", "days"], 3), 3),
  injuries: firstFilled(params, ["injuries"], "ninguna"),
  gender: firstFilled(params, ["gender"], ""),
  weight_kg: firstFilled(params, ["weight_kg", "weight"], ""),
  height_cm: firstFilled(params, ["height_cm", "height"], ""),
});

export const getRecommendationPayload = (doc = null) => {
  if (!doc || typeof doc !== "object") return {};
  if (doc.recommendation && typeof doc.recommendation === "object") return doc.recommendation;
  if (doc.plan && typeof doc.plan === "object") return doc.plan;
  return doc;
};

export const suggestClassType = (focus = "", classTypes = []) => {
  const names = classTypes
    .map((item) => repairText(String(item?.name || item?.class_type_name || "").trim()))
    .filter(Boolean);
  if (!names.length) return "Clase funcional";
  const text = normalizeText(focus);
  const direct = names.find((name) => text.includes(normalizeText(name)) || normalizeText(name).includes(text));
  if (direct) return direct;
  return names[0];
};

export const normalizeRecommendedSessions = (payload = {}, classTypes = []) => {
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
        ? exercisesRaw.map((x) => repairText(String(x).trim())).filter(Boolean).slice(0, 4)
        : String(exercisesRaw || "")
            .split(/[;,]+/)
            .map((x) => repairText(x.trim()))
            .filter(Boolean)
            .slice(0, 4);
      return {
        day: repairText(String(firstFilled(item, ["day", "dia", "weekday", "date"], `Dia ${idx + 1}`)).trim()),
        focus: repairText(String(firstFilled(item, ["focus", "title", "name", "type"], "Sesion personalizada")).trim()),
        duration:
          Number.isFinite(durationVal) && durationVal > 0 ? `${Math.round(durationVal)} min` : "Duracion flexible",
        exercises,
        classType: repairText(
          String(firstFilled(item, ["recommended_class", "class_type", "classType"], "")).trim() ||
            suggestClassType(item.focus, classTypes)
        ),
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

export const normalizeDietRecommendations = (payload = {}, goal = "") => {
  let rawDiet = firstFilled(payload, ["diet_tips", "diets", "diet", "nutrition", "meal_plan", "meals"], []);
  if (!Array.isArray(rawDiet)) {
    if (rawDiet && typeof rawDiet === "object") {
      if (Array.isArray(rawDiet.items)) rawDiet = rawDiet.items;
      else if (Array.isArray(rawDiet.plan)) rawDiet = rawDiet.plan;
      else rawDiet = Object.entries(rawDiet).map(([title, detail]) => ({ title, detail }));
    } else if (typeof rawDiet === "string" && rawDiet.trim()) {
      rawDiet = [{ title: "Plan nutricional", detail: rawDiet }];
    } else {
      rawDiet = [];
    }
  }
  const parsed = rawDiet
    .map((raw, idx) => {
      const item = typeof raw === "string" ? { title: raw } : raw;
      if (!item || typeof item !== "object") return null;
      const title = repairText(
        String(firstFilled(item, ["title", "name", "meal", "moment"], `Sugerencia ${idx + 1}`)).trim()
      );
      const detail = repairText(String(firstFilled(item, ["description", "detail", "notes", "tip", "advice"], "")).trim());
      return { title, detail: detail || "Sin detalle adicional" };
    })
    .filter(Boolean);
  return parsed.length ? parsed.slice(0, 6) : buildDietFallback(goal);
};

export const formatRecommendationMeta = (doc, cached) => {
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

export const toRecommendedTypeSet = (recommendationState) =>
  new Set(
    (recommendationState?.classes || [])
      .map((item) => normalizeText(item?.classType))
      .filter(Boolean)
  );

export const isClassRecommended = (cls, recommendedTypeSet) =>
  recommendedTypeSet.has(normalizeText(cls?.class_type_name || cls?.type || ""));

export const getDemandMeta = (occupancy = 0) => {
  if (occupancy >= 85) {
    return { key: "high", label: "Alta demanda", className: "member-demand-high" };
  }
  if (occupancy >= 60) {
    return { key: "medium", label: "Demanda media", className: "member-demand-medium" };
  }
  return { key: "low", label: "Baja demanda", className: "member-demand-low" };
};
