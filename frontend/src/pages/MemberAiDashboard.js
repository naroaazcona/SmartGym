import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { authService } from "../services/authService.js";
import { navigate } from "../router.js";
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
  repairText,
} from "./memberHelpers.js";

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
  const initialRecResult = await trainingService
    .getMyRecommendation(recommendationParams)
    .catch(() => ({ recommendation: null, cached: false }));
  const initialRecDoc = initialRecResult.recommendation;
  const initialRecPayload = getRecommendationPayload(initialRecDoc);
  const initialRecState = {
    classes: normalizeRecommendedSessions(initialRecPayload, classTypes),
    diets: normalizeDietRecommendations(initialRecPayload, recommendationParams.goal),
    notes: repairText(String(firstFilled(initialRecPayload, ["notes", "note", "advice", "summary", "tips"], "")).trim()),
    meta: formatRecommendationMeta(initialRecDoc, initialRecResult.cached),
  };

  const initialRecClassCards = renderRecommendationClasses(initialRecState.classes);
  const initialRecDietCards = renderRecommendationDiets(initialRecState.diets);
  const initialRecNotes = initialRecState.notes ? `Nota IA: ${escapeHtml(initialRecState.notes)}` : "";

  setTimeout(() => {
    const recClassEl = document.querySelector("#member-rec-classes");
    const recDietEl = document.querySelector("#member-rec-diets");
    const recStatusEl = document.querySelector("#member-rec-status");
    const recMetaEl = document.querySelector("#member-rec-meta");
    const recNotesEl = document.querySelector("#member-rec-notes");
    const recSaveBtn = document.querySelector("#member-rec-save");
    const recRefreshBtn = document.querySelector("#member-rec-refresh");

    let currentRecommendations = { ...initialRecState };
    let currentRecommendationDoc = initialRecDoc || null;

    const setRecStatus = (txt, isError = false) => {
      if (!recStatusEl) return;
      recStatusEl.textContent = txt;
      recStatusEl.style.color = isError ? "#b42318" : "var(--muted)";
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
      if (recMetaEl) recMetaEl.textContent = state.meta || "Recomendación IA";
      if (recNotesEl) recNotesEl.textContent = state.notes ? `Nota IA: ${state.notes}` : "";
      animateCards("#member-rec-classes .member-rec-card");
      animateCards("#member-rec-diets .member-rec-card");
    };

    const loadRecommendations = async () => {
      setRecStatus("Generando recomendación IA...");
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
          notes: repairText(String(firstFilled(recPayload, ["notes", "note", "advice", "summary", "tips"], "")).trim()),
          meta: formatRecommendationMeta(recDoc, res.cached),
        };
        renderRecommendations(currentRecommendations);
        setRecStatus(
          res.cached
            ? "Mostrando recomendación en caché (vigencia 7 días)."
            : "Recomendación IA actualizada."
        );
      } catch (err) {
        console.error(err);
        setRecStatus(err.message || "No se pudo cargar la recomendación IA.", true);
      } finally {
        if (recRefreshBtn) {
          recRefreshBtn.disabled = false;
          recRefreshBtn.textContent = "Actualizar recomendación";
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
        setRecStatus("Primero genera una recomendación antes de guardarla.", true);
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

    recRefreshBtn?.addEventListener("click", () => loadRecommendations());
    recSaveBtn?.addEventListener("click", () => saveRecommendation());
    renderRecommendations(currentRecommendations);
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
                <h1 class="member-hero-title">Entrenamientos y Dieta para <span>${escapeHtml(name)}</span></h1>
                <p class="sub member-hero-sub">Genera, revisa y guarda tu plan personalizado. La dieta se muestra en plan Premium.</p>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <a class="btn btn-ghost" href="#/mis-reservas">Mis reservas</a>
              </div>
            </div>

            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              <span class="tab-btn active" style="display:inline-flex; align-items:center;">Entrenamientos y Dieta</span>
            </div>

            <aside class="card" style="display:flex; flex-direction:column; gap:12px; background:var(--surface-2); border-color:var(--border); box-shadow:none;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                <div>
                  <div class="kicker">Recomendación personalizada</div>
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
          </div>
        </section>
      </main>
    </div>
  `;
}
