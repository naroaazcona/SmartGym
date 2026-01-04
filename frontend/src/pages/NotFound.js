import { Navbar } from "../components/Navbar.js";

export async function NotFoundPage() {
  return `
    <!-- Fondo animado -->
    <div class="bg-blobs"></div>

    <!-- Contenido -->
    <div class="screen">
      ${Navbar()}
      <main class="container">
        <section class="hero">
          <div class="card center">
            <div class="kicker">404</div>
            <h2 class="h2">Ruta perdida en el limbo</h2>
            <p class="sub">Esa pantalla no existe (todavía). Vuelve al inicio.</p>
            <div class="mtop">
              <a class="btn btn-primary" href="#/">Ir a inicio</a>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}
