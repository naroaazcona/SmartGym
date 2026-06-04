const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET;

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function loadMiddleware({
  jwtSecret = "test-jwt-secret",
  verifyImpl = () => ({ userId: 3, role: "member", email: "member@test.com" }),
} = {}) {
  jest.resetModules();

  if (jwtSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = jwtSecret;
  }

  const verify = jest.fn(verifyImpl);
  jest.doMock("jsonwebtoken", () => ({ verify }));

  const middleware = require("../../src/middleware/auth");
  return { ...middleware, verify };
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

    expect(() => require("../../src/middleware/auth")).toThrow(exitError);
    expect(exitSpy).toHaveBeenCalledWith(1);

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });
});

describe("authenticateToken", () => {
  test("devuelve 401 si falta Bearer token", () => {
    const { authenticateToken, verify } = loadMiddleware();
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Token de acceso requerido" });
    expect(verify).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("devuelve 403 si jwt.verify falla", () => {
    const { authenticateToken } = loadMiddleware({
      verifyImpl: () => {
        throw new Error("invalid");
      },
    });
    const req = { headers: { authorization: "Bearer invalid-token" } };
    const res = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("Token") })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("adjunta req.user y llama next con token válido", () => {
    const decoded = { userId: 9, role: "trainer", email: "trainer@test.com" };
    const { authenticateToken, verify } = loadMiddleware({
      verifyImpl: () => decoded,
    });
    const req = { headers: { authorization: "Bearer ok-token" } };
    const res = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(verify).toHaveBeenCalledWith("ok-token", "test-jwt-secret");
    expect(req.user).toEqual({ id: 9, role: "trainer", email: "trainer@test.com" });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("authorizeRoles", () => {
  test("permite cuando el rol está autorizado", () => {
    const { authorizeRoles } = loadMiddleware();
    const middleware = authorizeRoles("admin", "trainer");
    const req = { user: { role: "trainer" } };
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("devuelve 403 cuando req.user no existe", () => {
    const { authorizeRoles } = loadMiddleware();
    const middleware = authorizeRoles("admin");
    const req = {};
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("No tienes permisos") })
    );
    expect(next).not.toHaveBeenCalled();
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
