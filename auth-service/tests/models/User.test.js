const bcrypt = require('bcryptjs');
const User = require('../../src/models/User');
const pool = require('../../src/database/db');

jest.mock('../../src/database/db', () => ({
  query: jest.fn(),
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
});


