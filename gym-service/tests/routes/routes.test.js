const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET;

function getRouteLayer(router, path, method) {
  return router.stack.find(
    (layer) => layer.route && layer.route.path === path && layer.route.methods[method]
  );
}

function loadRouters() {
  jest.resetModules();
  process.env.JWT_SECRET = "test-jwt-secret";

  const classesRoutes = require("../../src/routes/ClassesRoutes");
  const classTypesRoutes = require("../../src/routes/ClassTypesRoutes");

  return { classesRoutes, classTypesRoutes };
}

afterEach(() => {
  if (ORIGINAL_JWT_SECRET === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
  }
});

describe("ClassesRoutes", () => {
  test("define /me/reservations antes de /:id para evitar colisión", () => {
    const { classesRoutes } = loadRouters();
    const getPaths = classesRoutes.stack
      .filter((layer) => layer.route && layer.route.methods.get)
      .map((layer) => layer.route.path);

    expect(getPaths.indexOf("/me/reservations")).toBeGreaterThan(-1);
    expect(getPaths.indexOf("/:id")).toBeGreaterThan(-1);
    expect(getPaths.indexOf("/me/reservations")).toBeLessThan(getPaths.indexOf("/:id"));
  });

  test("protege /me/reservations con auth y rol", () => {
    const { classesRoutes } = loadRouters();
    const layer = getRouteLayer(classesRoutes, "/me/reservations", "get");

    expect(layer).toBeDefined();
    expect(layer.route.stack).toHaveLength(3);
  });

  test("deja GET /:id público", () => {
    const { classesRoutes } = loadRouters();
    const layer = getRouteLayer(classesRoutes, "/:id", "get");

    expect(layer).toBeDefined();
    expect(layer.route.stack).toHaveLength(1);
  });

  test("protege endpoints de escritura y reservas", () => {
    const { classesRoutes } = loadRouters();
    const protectedEndpoints = [
      ["/", "post"],
      ["/:id/reservations", "get"],
      ["/:id/reservations/:reservationId/status", "patch"],
      ["/:id/reserve", "post"],
      ["/:id/cancel", "post"],
      ["/:id", "put"],
      ["/:id", "delete"],
    ];

    for (const [path, method] of protectedEndpoints) {
      const layer = getRouteLayer(classesRoutes, path, method);
      expect(layer).toBeDefined();
      expect(layer.route.stack).toHaveLength(3);
    }
  });
});

describe("ClassTypesRoutes", () => {
  test("protege GET / con authenticateToken", () => {
    const { classTypesRoutes } = loadRouters();
    const layer = getRouteLayer(classTypesRoutes, "/", "get");

    expect(layer).toBeDefined();
    expect(layer.route.stack).toHaveLength(2);
  });

  test("protege escrituras con auth + authorizeRoles('admin')", () => {
    const { classTypesRoutes } = loadRouters();
    const protectedEndpoints = [
      ["/", "post"],
      ["/:id", "put"],
      ["/:id", "delete"],
    ];

    for (const [path, method] of protectedEndpoints) {
      const layer = getRouteLayer(classTypesRoutes, path, method);
      expect(layer).toBeDefined();
      expect(layer.route.stack).toHaveLength(3);
    }
  });
});
