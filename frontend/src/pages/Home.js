import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { navigate } from "../router.js";
import { gymService } from "../services/gymService.js";

export async function HomePage() {
  const isOnline = Boolean(authStore.token);

  /* === Helpers === */
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfWeek = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = (d.getDay() + 6) % 7; // lunes = 0
    d.setDate(d.getDate() - day);
    return d;
  };
  const fmtTime = (date) =>
    date ? date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "";
  const fmtDay = (date) =>
    date
      ? date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })
      : "";
  const formatWeekLabel = (start, end) => {
    const sameMonth = start.getMonth() === end.getMonth();
    const startTxt = start.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    const endTxt = end.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: start.getFullYear() === end.getFullYear() ? undefined : "numeric",
    });
    return sameMonth
      ? `${startTxt}-${end.getDate()} ${start.toLocaleDateString("es-ES", { month: "short", year: "numeric" })}`
      : `${startTxt} - ${endTxt}`;
  };
  const imgForType = (type = "") => {
    const key = String(type || "").toLowerCase();
    if (key.includes("cross")) return "https://images.unsplash.com/photo-1558611848-73f7eb4001a1?auto=format&fit=crop&w=1400&q=80";
    if (key.includes("hiit")) return "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1400&q=80";
    if (key.includes("spin") || key.includes("cycle"))
      return "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1400&q=80";
    if (key.includes("mob") || key.includes("yoga"))
      return "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1400&q=80";
    return "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1400&q=80";
  };
  const normalizeClass = (cls) => {
    const startsAt = cls?.starts_at ? new Date(cls.starts_at) : null;
    return {
      id: cls.id ?? cls.class_id ?? Math.random(),
      title: cls.title || cls.class_type_name || cls.type || "Clase",
      type: cls.class_type_name || cls.type || "Clase",
      capacity: Number(cls.capacity || 0),
      booked: Number(cls.booked_count || 0),
      description: cls.description || "",
      location: cls.location || "Centro",
      trainer: cls.instructor_name || cls.trainer_user_id || "",
      startsAt,
      timeLabel: fmtTime(startsAt),
      dateLabel: fmtDay(startsAt),
      dayKey: startsAt ? startsAt.toISOString().slice(0, 10) : null,
      slug: (cls.class_type_name || cls.type || "clase").toLowerCase().replace(/\s+/g, "-"),
      image: imgForType(cls.class_type_name || cls.type || ""),
    };
  };
  const fetchWeekClasses = async (startDate) => {
    const endDate = new Date(startDate.getTime() + 7 * dayMs - 1);
    const res = await gymService.listClasses({
      from: startDate.toISOString(),
      to: endDate.toISOString(),
    });
    return Array.isArray(res) ? res.map(normalizeClass).filter((c) => c.startsAt) : [];
  };
  const buildFallbackClasses = () => {
    const now = new Date();
    const templates = [
      { type: "Crossfit", title: "WOD Express", days: 1, hour: 18, minute: 30, capacity: 16, booked: 10, trainer: "Alex" },
      { type: "HIIT", title: "Cardio Blast", days: 2, hour: 19, minute: 0, capacity: 18, booked: 12, trainer: "Nora" },
      { type: "Spinning", title: "Sprint Session", days: 3, hour: 20, minute: 0, capacity: 20, booked: 14, trainer: "Mario" },
      { type: "Yoga", title: "Flow & Recovery", days: 4, hour: 8, minute: 30, capacity: 14, booked: 8, trainer: "Sara" },
      { type: "Fuerza", title: "Power Basics", days: 5, hour: 17, minute: 30, capacity: 12, booked: 7, trainer: "Laura" },
      { type: "Movilidad", title: "Mobility Reset", days: 6, hour: 9, minute: 30, capacity: 15, booked: 9, trainer: "Iker" },
    ];

    return templates.map((item, idx) => {
      const startsAt = new Date(now);
      startsAt.setDate(startsAt.getDate() + item.days);
      startsAt.setHours(item.hour, item.minute, 0, 0);
      return normalizeClass({
        id: `fallback-${idx + 1}`,
        class_type_name: item.type,
        title: item.title,
        capacity: item.capacity,
        booked_count: item.booked,
        description: "Horario orientativo visible en la home. Accede para reservar plaza.",
        location: "SmartGym Center",
        instructor_name: item.trainer,
        starts_at: startsAt.toISOString(),
      });
    });
  };

  /* === Datos en vivo === */
  let weekStart = startOfWeek(new Date());
  const weekClasses = await fetchWeekClasses(weekStart).catch(() => []);
  const showcaseClasses = weekClasses.sort((a, b) => a.startsAt - b.startsAt);
  const hasRealClasses = showcaseClasses.length > 0;

  /* === Copys fijos === */
  const quickPlans = [
    {
      title: "Fullbody 3x/sem",
      focus: "Fuerza + core",
      time: "45-55 min",
      tip: "Base: sentadilla, press, remo.",
      img: "https://images.unsplash.com/photo-1558611848-73f7eb4001a1?auto=format&fit=crop&w=1400&q=80",
    },
    {
      title: "HIIT + movilidad",
      focus: "Cardio + stretch",
      time: "30 min",
      tip: "4 bloques 40/20 + 10' movilidad.",
      img: "https://images.unsplash.com/photo-1554284126-aa88f22d8b74?auto=format&fit=crop&w=1400&q=80",
    },
    {
      title: "Torso potente",
      focus: "Pecho + espalda",
      time: "40-50 min",
      tip: "Superseries de empuje y traccion.",
      img: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1400&q=80",
    },
    {
      title: "Pierna y gluteo",
      focus: "Lower body",
      time: "50 min",
      tip: "Sentadilla, bisagra y zancadas pesadas.",
      img: "https://images.unsplash.com/photo-1579758629938-03607ccdbaba?auto=format&fit=crop&w=1400&q=80",
    },
  ];

  /* === Render helpers === */
  const classCards = hasRealClasses
    ? showcaseClasses
        .slice(0, 8)
        .map(
          (c) => `
          <article class="class-card">
            <div class="backdrop" style="background-image:url('${c.image}')"></div>
            <div class="tag">${c.type}</div>
            <div style="display:flex; justify-content:space-between; gap:8px; align-items:center;">
              <div style="font-weight:600; font-size:17px;">${c.title}</div>
              <span class="badge">${c.booked}/${c.capacity || "?"} reservas</span>
            </div>
            <div class="dim">${c.dateLabel} · ${c.location} · ${c.capacity} plazas</div>
            ${c.description ? `<p class="sub" style="margin:0;">${c.description}</p>` : ""}
            <div class="chip-row" style="margin-top:6px;">
              <span class="chip">${c.timeLabel}</span>
              ${c.trainer ? `<span class="chip">Coach ${c.trainer}</span>` : ""}
            </div>
            <div class="cta-inline" style="margin-top:10px;">
              <button class="btn btn-primary js-go-area">Reservar</button>
              <button class="btn btn-ghost js-go-area">Ver detalles</button>
            </div>
          </article>`
        )
        .join("")
    : `<div class="empty-state" style="width:100%; text-align:center; padding:40px 20px;">
        <p class="empty-title">No hay clases próximas programadas</p>
        <p class="empty-sub">Cuando el equipo añada clases aparecerán aquí con toda la información.</p>
      </div>`;

  const renderWeekCalendar = (startDate, items = []) => {
    const endDate = new Date(startDate.getTime() + 7 * dayMs - 1);
    const weekLabel = formatWeekLabel(startDate, endDate);
    const byDay = items.reduce((acc, c) => {
      if (!c.dayKey) return acc;
      acc[c.dayKey] = acc[c.dayKey] || [];
      acc[c.dayKey].push(c);
      return acc;
    }, {});

    const daysHtml = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(startDate.getTime() + i * dayMs);
      const key = day.toISOString().slice(0, 10);
      const dayClasses = (byDay[key] || []).sort((a, b) => a.startsAt - b.startsAt);
      const isToday = key === new Date().toISOString().slice(0, 10);
      const chips =
        dayClasses.length > 0
          ? dayClasses
              .map(
                (c) => `
            <div class="cal-chip type-${c.slug}">
              <span class="time">${c.timeLabel}</span>
              <span class="title">${c.title}</span>
            </div>`
              )
              .join("")
          : `<span class="cal-empty">Sin clases</span>`;

      const dayLabel = day.toLocaleDateString("es-ES", { weekday: "short" });
      return `
        <div class="cal-cell${isToday ? " today" : ""}">
          <div class="cal-day">
            <span class="cal-dow">${dayLabel}</span>
            <span class="cal-num">${day.getDate()}</span>
          </div>
          <div class="cal-classes">
            ${chips}
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="calendar-card">
        <div class="calendar-header">
          <div>
            <div class="calendar-kicker">Agenda semanal</div>
            <div class="calendar-title">${weekLabel}</div>
            <div class="cal-status">Clases cargadas: ${items.length}</div>
          </div>
          <div class="calendar-nav">
            <button class="cal-nav" id="cal-prev">‹ Anterior</button>
            <button class="cal-nav" id="cal-next">Siguiente ›</button>
          </div>
        </div>
        <div class="calendar-grid week">
          ${daysHtml}
        </div>
      </div>
    `;
  };

  const planCards = quickPlans
    .map(
      (p) => `
        <div class="card plan-card js-quick-login" role="button" tabindex="0">
          <div class="plan-thumb" style="background-image:url('${p.img}')"></div>
          <div class="plan-body">
            <div class="kicker">${p.focus}</div>
            <div style="font-weight:700; font-size:17px;">${p.title}</div>
            <div class="dim">${p.time}</div>
            <p class="sub" style="margin:0;">${p.tip}</p>
            <div class="dim" style="margin-top:8px; font-weight:700;">${isOnline ? "Clic para ver el plan completo" : "Accede para guardar esta idea"}</div>
          </div>
        </div>
      `
    )
    .join("");

  /* === Listeners diferidos === */
  setTimeout(() => {
    const goToUserArea = () => {
      const r = authStore.role;
      if (r === "admin") navigate("/admin");
      else if (r === "trainer") navigate("/trainer");
      else if (r === "member") navigate("/member");
      else navigate("/login");
    };

    document.querySelectorAll(".js-go-login").forEach((btn) => {
      btn.addEventListener("click", () => navigate("/login"));
    });
    document.querySelectorAll(".js-quick-login").forEach((card) => {
      const goToIdeas = () => {
        const r = authStore.role;
        if (r === "member") navigate("/ideas-rapidas");
        else if (r) goToUserArea();
        else navigate("/login");
      };
      card.addEventListener("click", () => goToIdeas());
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          goToIdeas();
        }
      });
    });
    document.querySelectorAll(".js-go-area").forEach((btn) => {
      btn.addEventListener("click", () => goToUserArea());
    });

    const calendarRoot = document.querySelector("#hero-calendar");
    if (!calendarRoot) return;

    let currentWeek = new Date(weekStart);
    let busy = false;

    const wireNav = () => {
      calendarRoot.querySelector("#cal-prev")?.addEventListener("click", () => changeWeek(-1));
      calendarRoot.querySelector("#cal-next")?.addEventListener("click", () => changeWeek(1));
    };

    const changeWeek = async (delta) => {
      if (busy) return;
      busy = true;
      currentWeek = new Date(currentWeek.getTime() + delta * 7 * dayMs);

      // Mostrar skeleton mientras carga
      calendarRoot.innerHTML = `
        <div style="padding:16px; display:flex; flex-direction:column; gap:10px;">
          <div class="skeleton skeleton-line short" style="height:12px; width:120px;"></div>
          <div class="skeleton skeleton-line med" style="height:18px; width:220px; margin-bottom:8px;"></div>
          <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:6px;">
            ${Array.from({length:7}, () => `<div class="skeleton" style="height:80px; border-radius:8px;"></div>`).join("")}
          </div>
        </div>`;

      try {
        const data = await fetchWeekClasses(currentWeek);
        calendarRoot.innerHTML = renderWeekCalendar(currentWeek, data);
        wireNav();
      } catch (err) {
        calendarRoot.innerHTML = `
          <div class="empty-state">
            <p class="empty-title">No se pudieron cargar las clases</p>
            <p class="empty-sub">${err?.message || "Revisa tu conexion e intentalo de nuevo."}</p>
            <button class="btn btn-ghost" onclick="document.querySelector('#cal-prev') && document.querySelector('#cal-prev').click()">← Volver</button>
          </div>`;
      } finally {
        busy = false;
      }
    };

    wireNav();
  }, 0);

  /* === Render === */
  return `
    <div class="screen home-screen">
      ${Navbar()}

      <main class="home-main">
        <section class="hero">
          <div class="hero-block container">
            <div class="hero-copy">
              <div class="kicker">SmartGym · Real training club</div>
              <h1 class="h1">Clases, aforo en vivo y reservas en un click</h1>
              <p class="sub lead">Visualiza la sala, siente el ambiente y entra directo.</p>
              ${!isOnline ? `
              <div class="cta-row">
                <button class="btn btn-primary js-go-area">Entrar ahora</button>
              </div>` : ""}
            </div>

            <div class="hero-visual">
              <div id="hero-calendar">
                ${renderWeekCalendar(weekStart, weekClasses)}
              </div>
            </div>
          </div>
        </section>

        <section class="container" style="display:flex; flex-direction:column; gap:16px;">
          <div class="panel-card spotlight">
            <h3>Clases disponibles</h3>
            <p class="sub">${hasRealClasses ? "Elige viendo la sala, aforo y coach antes de reservar." : "Aún no hay clases programadas próximamente."}</p>
            <div class="class-gallery" style="margin-top:12px;">
              ${classCards}
            </div>
          </div>

          <div class="panel-card">
            <div class="label">Rutinas</div>
            <h3>Ideas rápidas para hoy</h3>
            <p class="sub">Combina clases con planes cortos de entrenamiento.</p>
            <div class="class-gallery" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
              ${planCards}
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}
