const bcrypt = require('bcryptjs');
const User = require('../../src/models/User');
const pool = require('../../src/database/db');

jest.mock('../../src/database/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

describe('User model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('verifyPassword returns true for valid password', async () => {
    const hash = await bcrypt.hash('miPassword123', 10);
    const result = await User.verifyPassword('miPassword123', hash);
    expect(result).toBe(true);
  });

  test('verifyPassword returns false for invalid password', async () => {
    const hash = await bcrypt.hash('miPassword123', 10);
    const result = await User.verifyPassword('otraPassword', hash);
    expect(result).toBe(false);
  });

  test('create inserts user with hashed password', async () => {
    pool.query.mockResolvedValue({
      rows: [{ id: 1, email: 'ana@test.com', name: 'Ana Ruiz', role: 'member' }],
    });

    const created = await User.create({
      email: 'ana@test.com',
      password: 'secreto123',
      name: 'Ana Ruiz',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO users');
    expect(params[0]).toBe('ana@test.com');
    expect(params[2]).toBe('Ana Ruiz');
    expect(params[3]).toBe('member');
    expect(params[1]).not.toBe('secreto123');
    await expect(bcrypt.compare('secreto123', params[1])).resolves.toBe(true);
    expect(created).toEqual({ id: 1, email: 'ana@test.com', name: 'Ana Ruiz', role: 'member' });
  });

  test('create throws duplicate user message on unique violation', async () => {
    pool.query.mockRejectedValue({ code: '23505' });

    await expect(
      User.create({ email: 'repetido@test.com', password: 'clave123', name: 'Duplicado' })
    ).rejects.toThrow('El usuario ya existe');
  });

  test('createProfile stores null optional fields and default level', async () => {
    pool.query.mockResolvedValue({
      rows: [{ user_id: 10, first_name: 'Ana', last_name: 'Ruiz', experience_level: 'beginner' }],
    });

    await User.createProfile(10, {
      firstName: 'Ana',
      lastName: 'Ruiz',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO user_profiles');
    expect(params).toEqual([10, 'Ana', 'Ruiz', null, null, null, null, null, 'beginner']);
  });

  test('findByEmail returns first row', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 4, email: 'user@test.com' }] });

    const found = await User.findByEmail('user@test.com');

    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE email = $1', ['user@test.com']);
    expect(found).toEqual({ id: 4, email: 'user@test.com' });
  });

  test('updateProfile without fields returns current profile', async () => {
    pool.query.mockResolvedValue({
      rows: [{ user_id: 7, first_name: 'Luis', experience_level: 'intermediate' }],
    });

    const updated = await User.updateProfile(7, {});

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('SELECT user_id, first_name, last_name');
    expect(params).toEqual([7]);
    expect(updated).toEqual({ user_id: 7, first_name: 'Luis', experience_level: 'intermediate' });
  });

  test('updateProfile with fields builds dynamic query', async () => {
    pool.query.mockResolvedValue({ rows: [{ user_id: 9, first_name: 'Marta', height_cm: 168 }] });

    const updated = await User.updateProfile(9, {
      firstName: 'Marta',
      heightCm: 168,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('UPDATE user_profiles');
    expect(sql).toContain('first_name = $1');
    expect(sql).toContain('height_cm = $2');
    expect(params).toEqual(['Marta', 168, 9]);
    expect(updated).toEqual({ user_id: 9, first_name: 'Marta', height_cm: 168 });
  });

  test('findById returns user with profile joined', async () => {
    const fila = {
      id: 3, email: 'carlos@test.com', name: 'Carlos', role: 'trainer',
      created_at: new Date(), first_name: 'Carlos', last_name: 'López',
      phone: null, birth_date: null, gender: null,
      height_cm: null, weight_kg: null, experience_level: 'advanced',
      subscription_plan: null,
    };
    pool.query.mockResolvedValue({ rows: [fila] });

    const result = await User.findById(3);

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('SELECT');
    expect(params).toEqual([3]);
    expect(result).toEqual(fila);
  });

  test('findById returns undefined when user does not exist', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await User.findById(999);

    expect(result).toBeUndefined();
  });

  test('findByRole returns list of users with that role', async () => {
    const trainers = [
      { id: 2, email: 'trainer@test.com', name: 'Sara', role: 'trainer', first_name: 'Sara', last_name: 'Gómez' },
    ];
    pool.query.mockResolvedValue({ rows: trainers });

    const result = await User.findByRole('trainer');

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('WHERE u.role = $1');
    expect(params).toEqual(['trainer']);
    expect(result).toEqual(trainers);
  });

  test('findByRole returns empty array when no users match', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await User.findByRole('admin');

    expect(result).toEqual([]);
  });

  // ─── helper de transacciones ─────────────────────────────────────────────

  function mockClient(queryResponses = []) {
    let callIndex = 0;
    const client = {
      query: jest.fn(() => {
        const response = queryResponses[callIndex] ?? { rows: [], rowCount: 0 };
        callIndex++;
        return Promise.resolve(response);
      }),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(client);
    return client;
  }

  // ─── createPasswordRecoveryRequest ──────────────────────────────────────

  describe('createPasswordRecoveryRequest', () => {
    test('invalida peticiones previas e inserta una nueva', async () => {
      const nuevaPeticion = { id: 1, user_id: 5, code_expires_at: new Date(), created_at: new Date() };
      const client = mockClient([
        { rows: [], rowCount: 0 },           // BEGIN
        { rows: [], rowCount: 0 },           // UPDATE used_at peticiones anteriores
        { rows: [nuevaPeticion], rowCount: 1 }, // INSERT nueva peticion
        { rows: [], rowCount: 0 },           // COMMIT
      ]);

      const result = await User.createPasswordRecoveryRequest(5, '123456', new Date());

      expect(client.query).toHaveBeenCalledWith('BEGIN');
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE password_recovery_requests'),
        [5]
      );
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO password_recovery_requests'),
        expect.arrayContaining([5])
      );
      expect(client.release).toHaveBeenCalled();
      expect(result).toEqual(nuevaPeticion);
    });

    test('hace ROLLBACK y relanza el error si la transaccion falla', async () => {
      const client = mockClient([
        { rows: [] },                        // BEGIN
      ]);
      client.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('DB error')); // UPDATE falla

      await expect(
        User.createPasswordRecoveryRequest(5, '123456', new Date())
      ).rejects.toThrow('DB error');

      expect(client.release).toHaveBeenCalled();
    });
  });

  // ─── verifyPasswordRecoveryCode ──────────────────────────────────────────

  describe('verifyPasswordRecoveryCode', () => {
    test('devuelve not_found si la peticion no existe', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await User.verifyPasswordRecoveryCode(99, '123456', 'token', new Date());

      expect(result).toEqual({ ok: false, reason: 'not_found' });
    });

    test('devuelve expired si el codigo ha caducado', async () => {
      const expirado = new Date(Date.now() - 60000).toISOString(); // hace 1 minuto
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, code_hash: 'hash', attempts: 0, max_attempts: 5, code_expires_at: expirado }] })
        .mockResolvedValueOnce({ rows: [] }); // UPDATE used_at

      const result = await User.verifyPasswordRecoveryCode(1, '123456', 'token', new Date());

      expect(result).toEqual({ ok: false, reason: 'expired' });
    });

    test('devuelve max_attempts si se superaron los intentos', async () => {
      const futuro = new Date(Date.now() + 60000).toISOString();
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, code_hash: 'hash', attempts: 5, max_attempts: 5, code_expires_at: futuro }] })
        .mockResolvedValueOnce({ rows: [] }); // UPDATE used_at

      const result = await User.verifyPasswordRecoveryCode(1, '123456', 'token', new Date());

      expect(result).toEqual({ ok: false, reason: 'max_attempts' });
    });

    test('devuelve invalid_code y suma intento si el codigo es incorrecto', async () => {
      const futuro = new Date(Date.now() + 60000).toISOString();
      const codeHash = await bcrypt.hash('correcto', 10);
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, code_hash: codeHash, attempts: 0, max_attempts: 5, code_expires_at: futuro }] })
        .mockResolvedValueOnce({ rows: [{ attempts: 1, max_attempts: 5 }] }); // UPDATE attempts

      const result = await User.verifyPasswordRecoveryCode(1, 'incorrecto', 'token', new Date());

      expect(result).toEqual({ ok: false, reason: 'invalid_code' });
    });

    test('devuelve ok true si el codigo es correcto', async () => {
      const futuro = new Date(Date.now() + 60000).toISOString();
      const codeHash = await bcrypt.hash('123456', 10);
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, code_hash: codeHash, attempts: 0, max_attempts: 5, code_expires_at: futuro }] })
        .mockResolvedValueOnce({ rows: [] }); // UPDATE verified_at + reset_token_hash

      const result = await User.verifyPasswordRecoveryCode(1, '123456', 'tokenreset', new Date());

      expect(result).toEqual({ ok: true });
    });
  });

  // ─── resetPasswordWithRecovery ───────────────────────────────────────────

  describe('resetPasswordWithRecovery', () => {
    test('devuelve invalid_request si la peticion no existe o no esta verificada', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await User.resetPasswordWithRecovery(99, 'token', 'nuevaClave123');

      expect(result).toEqual({ ok: false, reason: 'invalid_request' });
    });

    test('devuelve expired si el reset_token ha caducado', async () => {
      const expirado = new Date(Date.now() - 60000).toISOString();
      const tokenHash = await bcrypt.hash('token', 10);
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 5, verified_at: new Date(), reset_token_hash: tokenHash, reset_expires_at: expirado }] })
        .mockResolvedValueOnce({ rows: [] }); // UPDATE used_at

      const result = await User.resetPasswordWithRecovery(1, 'token', 'nuevaClave123');

      expect(result).toEqual({ ok: false, reason: 'expired' });
    });

    test('devuelve invalid_token si el token no coincide', async () => {
      const futuro = new Date(Date.now() + 60000).toISOString();
      const tokenHash = await bcrypt.hash('tokenCorrecto', 10);
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, user_id: 5, verified_at: new Date(), reset_token_hash: tokenHash, reset_expires_at: futuro }],
      });

      const result = await User.resetPasswordWithRecovery(1, 'tokenIncorrecto', 'nuevaClave123');

      expect(result).toEqual({ ok: false, reason: 'invalid_token' });
    });

    test('actualiza la contrasena correctamente y devuelve ok true', async () => {
      const futuro = new Date(Date.now() + 60000).toISOString();
      const tokenHash = await bcrypt.hash('tokenCorrecto', 10);
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, user_id: 5, verified_at: new Date(), reset_token_hash: tokenHash, reset_expires_at: futuro }],
      });

      const client = mockClient([
        { rows: [] }, // BEGIN
        { rows: [] }, // UPDATE users password
        { rows: [] }, // UPDATE recovery used_at
        { rows: [] }, // COMMIT
      ]);

      const result = await User.resetPasswordWithRecovery(1, 'tokenCorrecto', 'nuevaClave123');

      expect(result).toEqual({ ok: true });
      expect(client.query).toHaveBeenCalledWith('BEGIN');
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining([5])
      );
      expect(client.release).toHaveBeenCalled();
    });

    test('hace ROLLBACK y relanza el error si la transaccion falla', async () => {
      const futuro = new Date(Date.now() + 60000).toISOString();
      const tokenHash = await bcrypt.hash('tokenCorrecto', 10);
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, user_id: 5, verified_at: new Date(), reset_token_hash: tokenHash, reset_expires_at: futuro }],
      });

      const client = mockClient([]);
      client.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('DB error')); // UPDATE falla

      await expect(
        User.resetPasswordWithRecovery(1, 'tokenCorrecto', 'nuevaClave123')
      ).rejects.toThrow('DB error');

      expect(client.release).toHaveBeenCalled();
    });
  });
});