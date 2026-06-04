jest.mock('../../src/database/db', () => ({
  query: jest.fn(),
}));

const pool = require('../../src/database/db');
const ClassType = require('../../src/models/ClassType');

describe('ClassType model', () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    test('solo devuelve activos por defecto', async () => {
      const rows = [{ id: 1, name: 'Yoga', is_active: true }];
      pool.query.mockResolvedValue({ rows });

      const result = await ClassType.findAll();

      const sql = pool.query.mock.calls[0][0];
      expect(sql).toContain('WHERE is_active = TRUE');
      expect(result).toEqual(rows);
    });

    test('incluye inactivos cuando includeInactive=true', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await ClassType.findAll({ includeInactive: true });

      const sql = pool.query.mock.calls[0][0];
      expect(sql).not.toContain('WHERE is_active');
    });
  });

  // ─── findById ───────────────────────────────────────────────────────────────

  describe('findById', () => {
    test('devuelve el tipo de clase cuando existe', async () => {
      const row = { id: 5, name: 'HIIT', is_active: true };
      pool.query.mockResolvedValue({ rows: [row] });

      const result = await ClassType.findById(5);

      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1'), [5]);
      expect(result).toEqual(row);
    });

    test('devuelve null cuando no existe', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await ClassType.findById(999);

      expect(result).toBeNull();
    });
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    test('inserta y devuelve la fila creada', async () => {
      const row = { id: 1, name: 'Spinning', description: null, is_active: true };
      pool.query.mockResolvedValue({ rows: [row] });

      const result = await ClassType.create({ name: 'Spinning', description: null });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO class_types'),
        ['Spinning', null],
      );
      expect(result).toEqual(row);
    });

    test('pasa description null cuando no se proporciona', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 2 }] });

      await ClassType.create({ name: 'Cardio' });

      expect(pool.query.mock.calls[0][1][1]).toBeNull();
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    test('actualiza name y description', async () => {
      const row = { id: 1, name: 'Nuevo', description: 'desc' };
      pool.query.mockResolvedValue({ rows: [row] });

      const result = await ClassType.update(1, { name: 'Nuevo', description: 'desc' });

      const sql = pool.query.mock.calls[0][0];
      expect(sql).toContain('UPDATE class_types');
      expect(result).toEqual(row);
    });

    test('llama a findById cuando no hay campos que actualizar', async () => {
      const row = { id: 1, name: 'Yoga' };
      pool.query.mockResolvedValue({ rows: [row] });

      const result = await ClassType.update(1, {});

      // findById lanza una sola query SELECT
      const sql = pool.query.mock.calls[0][0];
      expect(sql).toContain('SELECT');
      expect(result).toEqual(row);
    });

    test('devuelve null cuando el id no existe', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await ClassType.update(999, { name: 'X' });

      expect(result).toBeNull();
    });
  });

  // ─── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    test('hace soft-delete y devuelve la fila', async () => {
      const row = { id: 1, name: 'Yoga', is_active: false };
      pool.query.mockResolvedValue({ rows: [row] });

      const result = await ClassType.remove(1);

      const sql = pool.query.mock.calls[0][0];
      expect(sql).toContain('is_active = FALSE');
      expect(result).toEqual(row);
    });

    test('devuelve null cuando el id no existe', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await ClassType.remove(999);

      expect(result).toBeNull();
    });
  });
});
