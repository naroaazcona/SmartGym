process.env.JWT_SECRET = 'test-jwt-secret';

jest.mock('../../src/database/db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
}));

jest.mock('../../src/models/User', () => ({
  create: jest.fn(),
  createProfile: jest.fn(),
  findByEmail: jest.fn(),
  verifyPassword: jest.fn(),
  findByEmailWithPhone: jest.fn(),
  createPasswordRecoveryRequest: jest.fn(),
  verifyPasswordRecoveryCode: jest.fn(),
  resetPasswordWithRecovery: jest.fn(),
  findById: jest.fn(),
  updateProfile: jest.fn(),
  findByRole: jest.fn(),
}));

const User = require('../../src/models/User');
const AuthController = require('../../src/controllers/authController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('AuthController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test('register returns 400 when required fields are missing', async () => {
    const req = { body: { email: 'ana@test.com' } };
    const res = mockRes();

    await AuthController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Email, password, firstName y lastName son requeridos' })
    );
  });

  test('register returns 400 for invalid email', async () => {
    const req = {
      body: {
        email: 'correo-invalido',
        password: 'clave123',
        firstName: 'Ana',
        lastName: 'Ruiz',
      },
    };
    const res = mockRes();

    await AuthController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(String(payload?.error || '')).toContain('formato del email');
  });

  test('register returns 403 when role is not member', async () => {
    const req = {
      body: {
        email: 'ana@test.com',
        password: 'clave123',
        firstName: 'Ana',
        lastName: 'Ruiz',
        role: 'admin',
      },
    };
    const res = mockRes();

    await AuthController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    const payload = res.json.mock.calls[0][0];
    expect(String(payload?.error || '')).toContain('registrarse con ese rol');
  });

  test('register returns 201 and token on success', async () => {
    User.create.mockResolvedValue({
      id: 3,
      email: 'ana@test.com',
      name: 'Ana Ruiz',
      role: 'member',
    });
    User.createProfile.mockResolvedValue({ user_id: 3 });

    const req = {
      body: {
        email: 'ana@test.com',
        password: 'clave123',
        firstName: 'Ana',
        lastName: 'Ruiz',
        phone: '+34 600123123',
      },
    };
    const res = mockRes();

    await AuthController.register(req, res);

    expect(User.create).toHaveBeenCalledWith({
      email: 'ana@test.com',
      password: 'clave123',
      name: 'Ana Ruiz',
      role: 'member',
    });
    expect(User.createProfile).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);

    const payload = res.json.mock.calls[0][0];
    expect(payload.user.id).toBe(3);
    expect(typeof payload.token).toBe('string');
    expect(payload.token.length).toBeGreaterThan(10);
  });

  test('register returns 409 on duplicate user', async () => {
    User.create.mockRejectedValue(new Error('El usuario ya existe'));

    const req = {
      body: {
        email: 'dup@test.com',
        password: 'clave123',
        firstName: 'Ana',
        lastName: 'Ruiz',
      },
    };
    const res = mockRes();

    await AuthController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'El usuario ya existe' }));
  });

  test('login returns 400 when credentials are missing', async () => {
    const req = { body: { email: '' } };
    const res = mockRes();

    await AuthController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Email y password son requeridos' }));
  });

  test('login returns 401 when user does not exist', async () => {
    User.findByEmail.mockResolvedValue(null);

    const req = { body: { email: 'ana@test.com', password: 'clave123' } };
    const res = mockRes();

    await AuthController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    const payload = res.json.mock.calls[0][0];
    expect(String(payload?.error || '')).toContain('Credenciales');
  });

  test('login returns 401 when password is invalid', async () => {
    User.findByEmail.mockResolvedValue({ id: 1, email: 'ana@test.com', password: 'hash', role: 'member' });
    User.verifyPassword.mockResolvedValue(false);

    const req = { body: { email: 'ana@test.com', password: 'incorrecta' } };
    const res = mockRes();

    await AuthController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    const payload = res.json.mock.calls[0][0];
    expect(String(payload?.error || '')).toContain('Credenciales');
  });

  test('login returns token on success', async () => {
    User.findByEmail.mockResolvedValue({
      id: 11,
      email: 'ana@test.com',
      password: 'hash',
      role: 'member',
      name: 'Ana Ruiz',
    });
    User.verifyPassword.mockResolvedValue(true);

    const req = { body: { email: 'ana@test.com', password: 'clave123' } };
    const res = mockRes();

    await AuthController.login(req, res);

    expect(res.json).toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.user.id).toBe(11);
    expect(payload.user.role).toBe('member');
    expect(typeof payload.token).toBe('string');
  });

  test('startPasswordRecovery returns 400 when email or phone missing', async () => {
    const req = { body: { email: 'ana@test.com' } };
    const res = mockRes();

    await AuthController.startPasswordRecovery(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Email y telefono son requeridos' }));
  });

  test('startPasswordRecovery returns 400 for invalid recovery data', async () => {
    const req = { body: { email: 'invalido', phone: '123' } };
    const res = mockRes();

    await AuthController.startPasswordRecovery(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Datos de recuperacion invalidos' }));
  });

  test('startPasswordRecovery returns 404 when user and phone mismatch', async () => {
    User.findByEmailWithPhone.mockResolvedValue(null);

    const req = { body: { email: 'ana@test.com', phone: '+34 600123123' } };
    const res = mockRes();

    await AuthController.startPasswordRecovery(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'No existe ninguna cuenta con ese email y telefono' })
    );
  });

  test('startPasswordRecovery returns request id and challenge code on success', async () => {
    User.findByEmailWithPhone.mockResolvedValue({
      id: 42,
      phone: '+34 600123123',
    });
    User.createPasswordRecoveryRequest.mockResolvedValue({ id: 777 });

    const req = { body: { email: 'ana@test.com', phone: '600123123' } };
    const res = mockRes();

    await AuthController.startPasswordRecovery(req, res);

    expect(User.createPasswordRecoveryRequest).toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.requestId).toBe(777);
    expect(payload.challengeCode).toMatch(/^\d{6}$/);
    expect(payload.expiresAt instanceof Date).toBe(true);
  });

  test('verifyPasswordRecovery returns 400 for invalid code', async () => {
    User.verifyPasswordRecoveryCode.mockResolvedValue({ ok: false, reason: 'invalid_code' });

    const req = { body: { requestId: 1, code: '000000' } };
    const res = mockRes();

    await AuthController.verifyPasswordRecovery(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Codigo incorrecto' }));
  });

  test('verifyPasswordRecovery returns 429 for max attempts', async () => {
    User.verifyPasswordRecoveryCode.mockResolvedValue({ ok: false, reason: 'max_attempts' });

    const req = { body: { requestId: 1, code: '000000' } };
    const res = mockRes();

    await AuthController.verifyPasswordRecovery(req, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Has agotado los intentos del codigo' }));
  });

  test('verifyPasswordRecovery returns reset token when code is valid', async () => {
    User.verifyPasswordRecoveryCode.mockResolvedValue({ ok: true });

    const req = { body: { requestId: 8, code: '123456' } };
    const res = mockRes();

    await AuthController.verifyPasswordRecovery(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.requestId).toBe(8);
    expect(typeof payload.resetToken).toBe('string');
    expect(payload.resetToken.length).toBe(64);
  });

  test('resetPassword returns 400 when new password is too short', async () => {
    const req = { body: { requestId: 1, resetToken: 'abc', newPassword: '123' } };
    const res = mockRes();

    await AuthController.resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'La nueva contrasena debe tener al menos 6 caracteres' })
    );
  });

  test('resetPassword returns 400 when request is expired', async () => {
    User.resetPasswordWithRecovery.mockResolvedValue({ ok: false, reason: 'expired' });

    const req = { body: { requestId: 5, resetToken: 'abc', newPassword: 'nueva123' } };
    const res = mockRes();

    await AuthController.resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'La solicitud de recuperacion ha expirado' })
    );
  });

  test('resetPassword returns success message when password changes', async () => {
    User.resetPasswordWithRecovery.mockResolvedValue({ ok: true });

    const req = { body: { requestId: 5, resetToken: 'abc', newPassword: 'nueva123' } };
    const res = mockRes();

    await AuthController.resetPassword(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Contrasena actualizada correctamente' })
    );
  });

  // ─── login ──────────────────────────────────────────────────────────────────

  test('login returns 400 when email or password missing', async () => {
    const req = { body: { email: 'ana@gmail.com' } };
    const res = mockRes();

    await AuthController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Email y password son requeridos' })
    );
  });

  test('login returns 401 when user does not exist', async () => {
    User.findByEmail.mockResolvedValue(null);

    const req = { body: { email: 'noexiste@gmail.com', password: 'clave123' } };
    const res = mockRes();

    await AuthController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Credenciales inválidas' })
    );
  });

  test('login returns 401 when password is wrong', async () => {
    User.findByEmail.mockResolvedValue({ id: 1, email: 'ana@gmail.com', password: 'hash', role: 'member' });
    User.verifyPassword.mockResolvedValue(false);

    const req = { body: { email: 'ana@gmail.com', password: 'incorrecta' } };
    const res = mockRes();

    await AuthController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('login returns token on success', async () => {
    User.findByEmail.mockResolvedValue({ id: 1, email: 'ana@gmail.com', name: 'Ana', password: 'hash', role: 'member' });
    User.verifyPassword.mockResolvedValue(true);

    const req = { body: { email: 'ana@gmail.com', password: 'correcta' } };
    const res = mockRes();

    await AuthController.login(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.message).toBe('Login exitoso');
    expect(typeof payload.token).toBe('string');
    expect(payload.token.length).toBeGreaterThan(10);
  });

  // ─── getProfile ─────────────────────────────────────────────────────────────

  test('getProfile returns 404 when user does not exist', async () => {
    User.findById.mockResolvedValue(null);

    const req = { userId: 99 };
    const res = mockRes();

    await AuthController.getProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Usuario no encontrado' })
    );
  });

  test('getProfile returns user data on success', async () => {
    User.findById.mockResolvedValue({
      id: 1, email: 'ana@gmail.com', name: 'Ana', role: 'member', created_at: new Date(),
      first_name: 'Ana', last_name: 'Ruiz', phone: null, birth_date: null,
      gender: null, height_cm: null, weight_kg: null, experience_level: 'beginner',
      subscription_plan: null,
    });

    const req = { userId: 1 };
    const res = mockRes();

    await AuthController.getProfile(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.user.email).toBe('ana@gmail.com');
    expect(payload.user.profile).not.toBeNull();
  });

  // ─── logout ─────────────────────────────────────────────────────────────────

  test('logout returns success message', async () => {
    const req = { headers: { authorization: 'Bearer sometoken' } };
    const res = mockRes();

    await AuthController.logout(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Logout exitoso' })
    );
  });

  test('logout works even without authorization header', async () => {
    const req = { headers: {} };
    const res = mockRes();

    await AuthController.logout(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Logout exitoso' })
    );
  });

  // ─── updateProfile ───────────────────────────────────────────────────────────

  test('updateProfile returns 400 when firstName is empty string', async () => {
    const req = { userId: 1, body: { firstName: '   ' } };
    const res = mockRes();

    await AuthController.updateProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'firstName no puede estar vacío' })
    );
  });

  test('updateProfile returns 404 when profile not found', async () => {
    User.updateProfile.mockResolvedValue(null);

    const req = { userId: 99, body: { firstName: 'Ana' } };
    const res = mockRes();

    await AuthController.updateProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('updateProfile returns updated profile on success', async () => {
    User.updateProfile.mockResolvedValue({
      user_id: 1, first_name: 'Ana', last_name: 'Ruiz',
      phone: null, birth_date: null, gender: null,
      height_cm: null, weight_kg: null, experience_level: 'beginner',
    });

    const req = { userId: 1, body: { firstName: 'Ana', lastName: 'Ruiz' } };
    const res = mockRes();

    await AuthController.updateProfile(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.message).toBe('Perfil actualizado exitosamente');
    expect(payload.profile.firstName).toBe('Ana');
  });

  // ─── createStaff ────────────────────────────────────────────────────────────

  test('createStaff returns 400 when required fields are missing', async () => {
    const req = { body: { email: 'trainer@smartgym.com' } };
    const res = mockRes();

    await AuthController.createStaff(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('createStaff creates trainer by default', async () => {
    User.create.mockResolvedValue({ id: 5, email: 'trainer@smartgym.com', name: 'Carlos López', role: 'trainer' });
    User.createProfile.mockResolvedValue({});

    const req = {
      body: { email: 'trainer@smartgym.com', password: 'pass123', firstName: 'Carlos', lastName: 'López' },
    };
    const res = mockRes();

    await AuthController.createStaff(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'trainer' })
    );
  });

  test('createStaff returns 409 when user already exists', async () => {
    User.create.mockRejectedValue(new Error('El usuario ya existe'));

    const req = {
      body: { email: 'existente@smartgym.com', password: 'pass123', firstName: 'Juan', lastName: 'García' },
    };
    const res = mockRes();

    await AuthController.createStaff(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  // ─── listByRole ──────────────────────────────────────────────────────────────

  test('listByRole returns 400 when role param is missing', async () => {
    const req = { query: {} };
    const res = mockRes();

    await AuthController.listByRole(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'El parámetro role es requerido' })
    );
  });

  test('listByRole returns users list', async () => {
    const trainers = [{ id: 2, email: 'trainer@smartgym.com', role: 'trainer' }];
    User.findByRole.mockResolvedValue(trainers);

    const req = { query: { role: 'trainer' } };
    const res = mockRes();

    await AuthController.listByRole(req, res);

    expect(res.json).toHaveBeenCalledWith({ users: trainers });
  });
});