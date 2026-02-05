import { Navbar } from "../components/Navbar.js";
import { authStore } from "../state/authStore.js";
import { navigate } from "../router.js";

export async function HomePage() {
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
  }, 0);

  const role = authStore.role ?? "visitante";
  const isOnline = Boolean(authStore.token);

  const sampleClasses = [
    {
      title: "CrossFit Engine",
      time: "Hoy · 18:00",
      type: "CrossFit",
      capacity: "20",
      spots: 3,
      level: "Intenso",
      img: "https://images.unsplash.com/photo-1554344058-8d1d1bcdfaf8?auto=format&fit=crop&w=900&q=80",
      description: "Bloques de fuerza + WOD con barra y assault bike.",
    },
    {
      title: "HIIT 30'",
      time: "Hoy · 19:00",
      type: "HIIT",
      capacity: "16",
      spots: 5,
      level: "Cardio",
      img: "https://images.unsplash.com/photo-1556817411-31ae72fa3ea0?auto=format&fit=crop&w=900&q=80",
      description: "Intervals 40/20 con dumbbells y slide.",
    },
    {
      title: "Mobility Reset",
      time: "Mañana · 08:00",
      type: "Mobility",
      capacity: "14",
      spots: 7,
      level: "Recovery",
      img: "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=900&q=80",
      description: "Secuencia guiada para caderas y espalda.",
    },
    {
      title: "Spinning Night",
      time: "Mañana · 19:30",
      type: "Cycling",
      capacity: "24",
      spots: 4,
      level: "Cardio",
      img: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=900&q=80",
      description: "Sesión nocturna con playlist electrónica.",
    },
  ];

  const facilityShots = [
    {
      title: "Sala de fuerza",
      text: "Plataformas, racks y discos calibrados para levantamientos pesados.",
      img: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80",
    },
    {
      title: "Zona cardio",
      text: "Cintas Woodway, remos Concept2 y assault bikes listas.",
      img: "https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&w=1200&q=80",
    },
    {
      title: "Estudio funcional",
      text: "Kettlebells, mancuernas, slam balls y turf para sled.",
      img: "https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=1200&q=80",
    },
  ];

  const classCards = sampleClasses
    .map(
      (c) => `
      <article class="class-card">
        <div class="backdrop" style="background-image:url('${c.img}')"></div>
        <div class="tag red">${c.type}</div>
        <div style="display:flex; justify-content:space-between; gap:8px; align-items:center;">
          <div style="font-weight:1000; font-size:20px;">${c.title}</div>
          <span class="badge yellow">${c.level}</span>
        </div>
        <div class="dim">${c.time} · ${c.capacity} plazas · ${c.spots} libres</div>
        <p class="sub" style="margin:0; color:#e8edf6;">${c.description}</p>
        <div class="chip-row" style="margin-top:6px;">
          <span class="chip">Coach en sala</span>
          <span class="chip">${c.capacity - c.spots} reservadas</span>
        </div>
        <div class="cta-inline" style="margin-top:10px;">
          <button class="btn btn-primary js-go-area">Reservar</button>
          <button class="btn btn-ghost js-go-area">Ver detalles</button>
        </div>
      </article>`
    )
    .join("");

  const facilityCards = facilityShots
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
    .join("");

  const quickPlans = [
    { title: "Fullbody 3x/sem", focus: "Fuerza + core", time: "45-55 min", tip: "Base: sentadilla, press, remo." },
    { title: "HIIT + movilidad", focus: "Cardio + stretch", time: "30 min", tip: "4 bloques 40/20 + 10' movilidad." },
    { title: "Dieta flex", focus: "300 kcal déficit", time: "Plan semanal", tip: "30/30/40 proteína/grasas/carbs." },
    { title: "Post-entreno", focus: "Recuperación", time: "Snack", tip: "20-30g proteína + fruta." },
  ];

  const planCards = quickPlans
    .map(
      (p) => `
        <div class="card" style="display:flex; flex-direction:column; gap:8px;">
          <div class="kicker">${p.focus}</div>
          <div style="font-weight:1000; font-size:18px;">${p.title}</div>
          <div class="dim">${p.time}</div>
          <p class="sub" style="margin:0;">${p.tip}</p>
        </div>
      `
    )
    .join("");

  return `
    <div class="screen home-screen">
      ${Navbar()}

      <main class="home-main">
        <section class="hero">
          <div class="hero-block container">
            <div class="hero-copy">
              <div class="kicker">SmartGym · Real training club</div>
              <h1 class="h1">Clases con fotos, aforo en vivo y reservas en un click</h1>
              <p class="sub lead">Visualiza la sala, siente el ambiente y entra directo a tu panel según tu rol.</p>
              <div class="stat-grid" style="margin:10px 0 4px;">
                <div class="floating-stat"><span class="lbl">Estado</span><span class="val">${isOnline ? "Conectado" : "Modo demo"}</span></div>
                <div class="floating-stat"><span class="lbl">Tu rol</span><span class="val">${role}</span></div>
                <div class="floating-stat"><span class="lbl">Clases activas</span><span class="val">${sampleClasses.length}</span></div>
              </div>
              <div class="cta-row">
                <button class="btn btn-primary js-go-area">Entrar ahora</button>
                <button class="btn btn-ghost js-go-login">Acceder</button>
                <span class="pill status-pill"><span class="dot ${isOnline ? "" : "off"}"></span> ${isOnline ? `Online · ${role}` : "Modo demo"}</span>
              </div>
            </div>

            <div class="hero-visual">
              <div class="cover-photo"></div>
              <div class="hero-main-card">
                <div class="eyebrow">Clases destacadas</div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px;">
                  ${sampleClasses
                    .slice(0, 2)
                    .map(
                      (c) => `
                        <div class="card" style="padding:12px; gap:6px; display:flex; flex-direction:column; background: rgba(255,255,255,.04);">
                          <div class="kicker">${c.type}</div>
                          <div style="font-weight:1000;">${c.title}</div>
                          <div class="dim">${c.time}</div>
                          <span class="badge green">${c.capacity - c.spots} reservas</span>
                        </div>
                      `
                    )
                    .join("")}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="container" style="display:flex; flex-direction:column; gap:16px;">
          <div class="panel-card spotlight">
            <div class="label">Clases con foto real</div>
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
            ${facilityCards}
          </div>
        </section>
      </main>
    </div>
  `;
}
