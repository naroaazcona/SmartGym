jest.mock('../../src/models/ClassType', () => ({
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
}));

const ClassType = require('../../src/models/ClassType');
const ClassTypesController = require('../../src/controllers/ClassTypesController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('ClassTypesController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  // ─── list ───────────────────────────────────────────────────────────────────

  describe('list', () => {
    test('devuelve todos los tipos de clase', async () => {
      const items = [{ id: 1, name: 'Yoga' }];
      ClassType.findAll.mockResolvedValue(items);

      const req = { query: {}, user: { role: 'member' } };
      const res = mockRes();

      await ClassTypesController.list(req, res);

      expect(ClassType.findAll).toHaveBeenCalledWith({ includeInactive: false });
      expect(res.json).toHaveBeenCalledWith({ classTypes: items });
    });

    test('admin con include_inactive=true obtiene todos', async () => {
      ClassType.findAll.mockResolvedValue([]);

      const req = { query: { include_inactive: 'true' }, user: { role: 'admin' } };
      const res = mockRes();

      await ClassTypesController.list(req, res);

      expect(ClassType.findAll).toHaveBeenCalledWith({ includeInactive: true });
    });

    test('no-admin con include_inactive=true sigue filtrando inactivos', async () => {
      ClassType.findAll.mockResolvedValue([]);

      const req = { query: { include_inactive: 'true' }, user: { role: 'member' } };
      const res = mockRes();

      await ClassTypesController.list(req, res);

      expect(ClassType.findAll).toHaveBeenCalledWith({ includeInactive: false });
    });

    test('devuelve 500 en error', async () => {
      ClassType.findAll.mockRejectedValue(new Error('DB error'));

      const req = { query: {}, user: { role: 'member' } };
      const res = mockRes();

      await ClassTypesController.list(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    test('devuelve 400 si name falta', async () => {
      const req = { body: {} };
      const res = mockRes();

      await ClassTypesController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'name es requerido' });
    });

    test('devuelve 400 si name es cadena vacía', async () => {
      const req = { body: { name: '   ' } };
      const res = mockRes();

      await ClassTypesController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('crea el tipo de clase correctamente', async () => {
      const created = { id: 1, name: 'Spinning', description: null };
      ClassType.create.mockResolvedValue(created);

      const req = { body: { name: ' Spinning ', description: null } };
      const res = mockRes();

      await ClassTypesController.create(req, res);

      expect(ClassType.create).toHaveBeenCalledWith({ name: 'Spinning', description: null });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ message: 'Tipo de clase creado', classType: created });
    });

    test('devuelve 409 en duplicado', async () => {
      const err = new Error('duplicate');
      err.code = '23505';
      ClassType.create.mockRejectedValue(err);

      const req = { body: { name: 'Yoga' } };
      const res = mockRes();

      await ClassTypesController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    test('devuelve 500 en error genérico', async () => {
      ClassType.create.mockRejectedValue(new Error('DB fail'));

      const req = { body: { name: 'Yoga' } };
      const res = mockRes();

      await ClassTypesController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    test('devuelve 400 para id no numérico', async () => {
      const req = { params: { id: 'abc' }, body: {} };
      const res = mockRes();

      await ClassTypesController.update(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('devuelve 400 si name es cadena vacía', async () => {
      const req = { params: { id: '1' }, body: { name: '' } };
      const res = mockRes();

      await ClassTypesController.update(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'name no puede estar vacio' });
    });

    test('actualiza correctamente', async () => {
      const updated = { id: 1, name: 'Pilates' };
      ClassType.update.mockResolvedValue(updated);

      const req = { params: { id: '1' }, body: { name: 'Pilates' } };
      const res = mockRes();

      await ClassTypesController.update(req, res);

      expect(ClassType.update).toHaveBeenCalledWith(1, { name: 'Pilates' });
      expect(res.json).toHaveBeenCalledWith({ message: 'Tipo de clase actualizado', classType: updated });
    });

    test('devuelve 404 cuando el modelo devuelve null', async () => {
      ClassType.update.mockResolvedValue(null);

      const req = { params: { id: '99' }, body: { name: 'X' } };
      const res = mockRes();

      await ClassTypesController.update(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('devuelve 409 en duplicado', async () => {
      const err = new Error('dup');
      err.code = '23505';
      ClassType.update.mockRejectedValue(err);

      const req = { params: { id: '1' }, body: { name: 'Yoga' } };
      const res = mockRes();

      await ClassTypesController.update(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  // ─── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    test('devuelve 400 para id inválido', async () => {
      const req = { params: { id: '0' } };
      const res = mockRes();

      await ClassTypesController.remove(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('elimina correctamente', async () => {
      const removed = { id: 1, name: 'Yoga', is_active: false };
      ClassType.remove.mockResolvedValue(removed);

      const req = { params: { id: '1' } };
      const res = mockRes();

      await ClassTypesController.remove(req, res);

      expect(ClassType.remove).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith({ message: 'Tipo de clase eliminado', classType: removed });
    });

    test('devuelve 404 cuando el modelo devuelve null', async () => {
      ClassType.remove.mockResolvedValue(null);

      const req = { params: { id: '99' } };
      const res = mockRes();

      await ClassTypesController.remove(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('devuelve 500 en error genérico', async () => {
      ClassType.remove.mockRejectedValue(new Error('DB fail'));

      const req = { params: { id: '1' } };
      const res = mockRes();

      await ClassTypesController.remove(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
