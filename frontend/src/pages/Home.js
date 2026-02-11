import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { navigate } from "../router.js";
import { gymService } from "../services/gymService.js";

export async function HomePage() {
  const role = authStore.role ?? "visitante";
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
    const key = type.toLowerCase();
    if (key.includes("cross")) return "https://images.unsplash.com/photo-1558611848-73f7eb4001a1?auto=format&fit=crop&w=1400&q=80";
    if (key.includes("hiit")) return "https://images.unsplash.com/photo-1554284126-aa88f22d8b74?auto=format&fit=crop&w=1400&q=80";
    if (key.includes("spin") || key.includes("cycle"))
      return "https://images.unsplash.com/photo-1546484475-7e0b1cd5a33e?auto=format&fit=crop&w=1400&q=80";
    if (key.includes("mob") || key.includes("yoga"))
      return "https://images.unsplash.com/photo-1546484959-f9a9c6c4b4c1?auto=format&fit=crop&w=1400&q=80";
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

  /* === Datos en vivo === */
  let weekStart = startOfWeek(new Date());
  const initialClasses = await fetchWeekClasses(weekStart).catch(() => []);

  /* === Copys fijos === */
  const facilityShots = [
    {
      title: "Sala de fuerza",
      text: "Plataformas, racks y discos calibrados para levantamientos pesados.",
      img: "https://images.unsplash.com/photo-1483721310020-03333e577078?auto=format&fit=crop&w=1400&q=80",
    },
    {
      title: "Zona cardio",
      text: "Cintas Woodway, remos Concept2 y assault bikes listas.",
      img: "https://images.unsplash.com/photo-1517960413843-0aee8e2b3285?auto=format&fit=crop&w=1600&q=80",
    },
    {
      title: "Estudio funcional",
      text: "Kettlebells, mancuernas, slam balls y turf para sled.",
      img: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
    },
  ];

  const quickPlans = [
    {
      title: "Fullbody 3x/sem",
      focus: "Fuerza + core",
      time: "45-55 min",
      tip: "Base: sentadilla, press, remo.",
      img: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1400&q=80",
    },
    {
      title: "HIIT + movilidad",
      focus: "Cardio + stretch",
      time: "30 min",
      tip: "4 bloques 40/20 + 10' movilidad.",
      img: "https://images.unsplash.com/photo-1521805103424-d8f8430e8933?auto=format&fit=crop&w=1400&q=80",
    },
    {
      title: "Dieta flex",
      focus: "300 kcal déficit",
      time: "Plan semanal",
      tip: "30/30/40 proteína/grasas/carbs.",
      img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1400&q=80",
    },
    {
      title: "Post-entreno",
      focus: "Recuperación",
      time: "Snack",
      tip: "20-30g proteína + fruta.",
      img: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1400&q=80",
    },
  ];

  /* === Render helpers === */
  const classCards = initialClasses.length
    ? initialClasses
        .map(
          (c) => `
      <article class="class-card">
        <div class="backdrop" style="background-image:url('${c.image}')"></div>
        <div class="tag red">${c.type}</div>
        <div style="display:flex; justify-content:space-between; gap:8px; align-items:center;">
          <div style="font-weight:1000; font-size:20px;">${c.title}</div>
          <span class="badge green">${c.booked}/${c.capacity || "?"} reservas</span>
        </div>
        <div class="dim">${c.dateLabel} · ${c.location} · ${c.capacity} plazas</div>
        ${c.description ? `<p class="sub" style="margin:0; color:#0b0f19;">${c.description}</p>` : ""}
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
    : "<p class='sub'>No hay clases programadas esta semana.</p>";

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
        <div class="card plan-card">
          <div class="plan-thumb" style="background-image:url('${p.img}')"></div>
          <div class="plan-body">
            <div class="kicker">${p.focus}</div>
            <div style="font-weight:1000; font-size:18px;">${p.title}</div>
            <div class="dim">${p.time}</div>
            <p class="sub" style="margin:0;">${p.tip}</p>
          </div>
        </div>
      `
    )
    .join("");

  /* === Listeners diferidos === */
  setTimeout(() => {
    document.querySelectorAll(".js-go-login").forEach((btn) => {
      btn.addEventListener("click", () => navigate("/login"));
    });
    document.querySelectorAll(".js-go-area").forEach((btn) => {
      btn.addEventListener("click", () => {
        const r = authStore.role;
        if (r === "admin") navigate("/admin");
        else if (r === "trainer") navigate("/trainer");
        else if (r === "member") navigate("/member");
        else navigate("/login");
      });
    });

    const calendarRoot = document.querySelector("#hero-calendar");
    if (!calendarRoot) return;

    const statusEl = () => calendarRoot.querySelector(".cal-status");
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
      if (statusEl()) statusEl().textContent = "Cargando clases...";
      try {
        const data = await fetchWeekClasses(currentWeek);
        calendarRoot.innerHTML = renderWeekCalendar(currentWeek, data);
        wireNav();
      } catch (err) {
        if (statusEl()) statusEl().textContent = err?.message || "No se pudieron cargar las clases.";
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
              <div class="cta-row">
                <button class="btn btn-primary js-go-area">Entrar ahora</button>
              </div>
            </div>

            <div class="hero-visual">
              <div id="hero-calendar">
                ${renderWeekCalendar(weekStart, initialClasses)}
              </div>
            </div>
          </div>
        </section>

        <section class="container" style="display:flex; flex-direction:column; gap:16px;">
          <div class="panel-card spotlight">
            <h3>Clases creadas</h3>
            <p class="sub">Elige viendo la sala, aforo y coach antes de reservar.</p>
            <div class="class-gallery" style="margin-top:12px;">
              ${classCards}
            </div>
          </div>

          <div class="panel-card">
            <div class="label">Rutinas & dieta</div>
            <h3>Ideas rápidas para hoy</h3>
            <p class="sub">Combina clases con planes cortos de entrenamiento y nutrición.</p>
            <div class="class-gallery" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
              ${planCards}
            </div>
          </div>

          <div class="feature-grid">
            ${facilityShots
              .map(
                (f) => `
                <div class="feature-card">
                  <img src="${f.img}" alt="${f.title}" loading="lazy" />
                  <div class="content">
                    <div class="kicker">Espacio</div>
                    <h3 style="margin:0; font-size:20px;">${f.title}</h3>
                    <p class="sub" style="margin:0;">${f.text}</p>
                  </div>
                </div>
              `
              )
              .join("")}
          </div>
        </section>
      </main>
    </div>
  `;
}
