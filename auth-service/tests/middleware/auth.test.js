const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET;

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function loadMiddleware({
  jwtSecret = "test-jwt-secret",
  verifyImpl = () => ({ userId: 7, role: "admin", email: "admin@test.com" }),
  queryImpl = async () => ({ rows: [] }),
} = {}) {
  jest.resetModules();

  if (jwtSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = jwtSecret;
  }

  const verify = jest.fn(verifyImpl);
  const query = jest.fn(queryImpl);

  jest.doMock("jsonwebtoken", () => ({ verify }));
  jest.doMock("../../src/database/db", () => ({ query }));

  const middleware = require("../../src/middleware/auth");
  return { ...middleware, verify, query };
}

afterEach(() => {
  if (ORIGINAL_JWT_SECRET === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
  }
  jest.clearAllMocks();
});

describe("auth middleware bootstrap", () => {
  test("aborta el arranque si falta JWT_SECRET", () => {
    jest.resetModules();
    delete process.env.JWT_SECRET;

    const exitError = new Error("process.exit called");
    const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
      throw exitError;
    });
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    jest.doMock("jsonwebtoken", () => ({ verify: jest.fn() }));
    jest.doMock("../../src/database/db", () => ({ query: jest.fn() }));

    expect(() => require("../../src/middleware/auth")).toThrow(exitError);
    expect(exitSpy).toHaveBeenCalledWith(1);

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });
});

describe("authenticateToken", () => {
  test("devuelve 401 si no llega token", async () => {
    const { authenticateToken, verify, query } = loadMiddleware();
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Token de acceso requerido" });
    expect(verify).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("devuelve 403 cuando jwt.verify falla", async () => {
    const { authenticateToken, query } = loadMiddleware({
      verifyImpl: () => {
        throw new Error("invalid token");
      },
    });
    const req = { headers: { authorization: "Bearer bad-token" } };
    const res = mockRes();
    const next = jest.fn();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("Token") })
    );
    expect(query).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("devuelve 403 cuando el token está en blacklist", async () => {
    const { authenticateToken, query } = loadMiddleware({
      queryImpl: async () => ({ rows: [{ id: 1 }] }),
    });
    const req = { headers: { authorization: "Bearer blocked-token" } };
    const res = mockRes();
    const next = jest.fn();

    await authenticateToken(req, res, next);

    expect(query).toHaveBeenCalledWith(
      "SELECT id FROM token_blacklist WHERE token = $1 AND expires_at > NOW()",
      ["blocked-token"]
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("Token") })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("devuelve 500 si falla la consulta de blacklist", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { authenticateToken } = loadMiddleware({
      queryImpl: async () => {
        throw new Error("db down");
      },
    });
    const req = { headers: { authorization: "Bearer token-1" } };
    const res = mockRes();
    const next = jest.fn();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Error interno del servidor" });
    expect(next).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  test("adjunta usuario y llama next para token válido", async () => {
    const decoded = { userId: 10, role: "trainer", email: "trainer@test.com" };
    const { authenticateToken, verify, query } = loadMiddleware({
      verifyImpl: () => decoded,
    });
    const req = { headers: { authorization: "Bearer valid-token" } };
    const res = mockRes();
    const next = jest.fn();

    await authenticateToken(req, res, next);

    expect(verify).toHaveBeenCalledWith("valid-token", "test-jwt-secret");
    expect(query).toHaveBeenCalled();
    expect(req.userId).toBe(10);
    expect(req.userRole).toBe("trainer");
    expect(req.user).toEqual({ id: 10, role: "trainer", email: "trainer@test.com" });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("authorizeRoles", () => {
  test("permite acceso cuando req.user.role está autorizado", () => {
    const { authorizeRoles } = loadMiddleware();
    const middleware = authorizeRoles("admin", "trainer");
    const req = { user: { role: "trainer" } };
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("usa req.userRole como fallback", () => {
    const { authorizeRoles } = loadMiddleware();
    const middleware = authorizeRoles("member");
    const req = { userRole: "member" };
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("devuelve 403 cuando el rol no está permitido", () => {
    const { authorizeRoles } = loadMiddleware();
    const middleware = authorizeRoles("admin");
    const req = { user: { role: "member" } };
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("No tienes permisos") })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
