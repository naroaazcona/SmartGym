jest.mock('../../src/models/ClassSession', () => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  reserve: jest.fn(),
  cancel: jest.fn(),
  listReservations: jest.fn(),
  listUserReservations: jest.fn(),
  updateReservationStatus: jest.fn(),
  isAttendanceStatus: jest.fn(),
}));

const ClassSession = require('../../src/models/ClassSession');
const ClassesController = require('../../src/controllers/ClassesController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

describe('ClassesController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  // ─── list ───────────────────────────────────────────────────────────────────

  describe('list', () => {
    test('devuelve la lista de clases correctamente', async () => {
      const clases = [{ id: 1, class_type_name: 'Yoga' }];
      ClassSession.findAll.mockResolvedValue(clases);

      const req = { query: {} };
      const res = mockRes();

      await ClassesController.list(req, res);

      expect(res.json).toHaveBeenCalledWith({ classes: clases });
    });

    test('devuelve 500 si el modelo lanza un error', async () => {
      ClassSession.findAll.mockRejectedValue(new Error('DB error'));

      const req = { query: {} };
      const res = mockRes();

      await ClassesController.list(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error al listar clases' });
    });
  });

  // ─── get ────────────────────────────────────────────────────────────────────

  describe('get', () => {
    test('devuelve la clase cuando existe', async () => {
      const clase = { id: 1, class_type_name: 'Spinning' };
      ClassSession.findById.mockResolvedValue(clase);

      const req = { params: { id: '1' } };
      const res = mockRes();

      await ClassesController.get(req, res);

      expect(res.json).toHaveBeenCalledWith({ class: clase });
    });

    test('devuelve 404 si la clase no existe', async () => {
      ClassSession.findById.mockResolvedValue(null);

      const req = { params: { id: '99' } };
      const res = mockRes();

      await ClassesController.get(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Clase no encontrada' });
    });
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    test('devuelve 400 si faltan campos obligatorios', async () => {
      const req = {
        body: { class_type_id: 1 }, // faltan starts_at, ends_at, capacity
        user: { role: 'admin' },
      };
      const res = mockRes();

      await ClassesController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('trainer crea clase asignándose a sí mismo', async () => {
      const nueva = { id: 5, class_type_id: 2, trainer_user_id: 10 };
      ClassSession.create.mockResolvedValue(nueva);

      const req = {
        body: { class_type_id: 2, starts_at: '2026-06-01T10:00:00Z', ends_at: '2026-06-01T11:00:00Z', capacity: 15 },
        user: { role: 'trainer', id: 10 },
      };
      const res = mockRes();

      await ClassesController.create(req, res);

      expect(ClassSession.create).toHaveBeenCalledWith(
        expect.objectContaining({ trainer_user_id: 10 })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('admin requiere trainer_user_id', async () => {
      const req = {
        body: { class_type_id: 2, starts_at: '2026-06-01T10:00:00Z', ends_at: '2026-06-01T11:00:00Z', capacity: 15 },
        user: { role: 'admin' }, // sin trainer_user_id en body
      };
      const res = mockRes();

      await ClassesController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'id del entrenador es obligatorio cuando crea un admin' })
      );
    });

    test('admin crea clase con trainer_user_id correcto', async () => {
      const nueva = { id: 6, trainer_user_id: 3 };
      ClassSession.create.mockResolvedValue(nueva);

      const req = {
        body: { class_type_id: 1, starts_at: '2026-06-01T10:00:00Z', ends_at: '2026-06-01T11:00:00Z', capacity: 20, trainer_user_id: 3 },
        user: { role: 'admin', id: 1 },
      };
      const res = mockRes();

      await ClassesController.create(req, res);

      expect(ClassSession.create).toHaveBeenCalledWith(
        expect.objectContaining({ trainer_user_id: 3 })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  // ─── reserve ────────────────────────────────────────────────────────────────

  describe('reserve', () => {
    test('confirma la reserva correctamente', async () => {
      const reserva = { id: 1, class_id: 2, user_id: 5, status: 'booked' };
      ClassSession.reserve.mockResolvedValue({ ok: true, reservation: reserva });

      const req = { params: { id: '2' }, user: { id: 5 } };
      const res = mockRes();

      await ClassesController.reserve(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Reserva confirmada' })
      );
    });

    test('devuelve 400 si el modelo indica error (clase llena, ya reservado, etc.)', async () => {
      ClassSession.reserve.mockResolvedValue({ ok: false, error: 'No hay plazas disponibles' });

      const req = { params: { id: '2' }, user: { id: 5 } };
      const res = mockRes();

      await ClassesController.reserve(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'No hay plazas disponibles' });
    });
  });

  // ─── cancel ─────────────────────────────────────────────────────────────────

  describe('cancel', () => {
    test('cancela la reserva correctamente', async () => {
      const reserva = { id: 1, status: 'cancelled' };
      ClassSession.cancel.mockResolvedValue({ ok: true, reservation: reserva });

      const req = { params: { id: '2' }, user: { id: 5 } };
      const res = mockRes();

      await ClassesController.cancel(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Reserva cancelada' })
      );
    });

    test('devuelve 400 si no se puede cancelar', async () => {
      ClassSession.cancel.mockResolvedValue({ ok: false, error: 'No tienes reserva en esta clase' });

      const req = { params: { id: '2' }, user: { id: 5 } };
      const res = mockRes();

      await ClassesController.cancel(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ─── reservations ───────────────────────────────────────────────────────────

  describe('reservations', () => {
    test('admin puede ver reservas de cualquier clase', async () => {
      ClassSession.findById.mockResolvedValue({ id: 1, trainer_user_id: 3 });
      ClassSession.listReservations.mockResolvedValue([{ id: 1, user_id: 5 }]);

      const req = { params: { id: '1' }, query: {}, user: { role: 'admin', id: 1 } };
      const res = mockRes();

      await ClassesController.reservations(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ reservations: expect.any(Array) }));
    });

    test('trainer solo puede ver reservas de sus clases', async () => {
      ClassSession.findById.mockResolvedValue({ id: 1, trainer_user_id: 10 });

      const req = { params: { id: '1' }, query: {}, user: { role: 'trainer', id: 99 } }; // trainer distinto
      const res = mockRes();

      await ClassesController.reservations(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('devuelve 404 si la clase no existe', async () => {
      ClassSession.findById.mockResolvedValue(null);

      const req = { params: { id: '999' }, query: {}, user: { role: 'admin', id: 1 } };
      const res = mockRes();

      await ClassesController.reservations(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    test('trainer no puede editar una clase que no es suya', async () => {
      ClassSession.findById.mockResolvedValue({ id: 1, trainer_user_id: 3 });

      const req = { params: { id: '1' }, body: { capacity: 20 }, user: { role: 'trainer', id: 99 } };
      const res = mockRes();

      await ClassesController.update(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('admin puede editar cualquier clase', async () => {
      const clase = { id: 1, trainer_user_id: 3 };
      const actualizada = { id: 1, capacity: 25 };
      ClassSession.findById.mockResolvedValue(clase);
      ClassSession.update.mockResolvedValue(actualizada);

      const req = { params: { id: '1' }, body: { capacity: 25 }, user: { role: 'admin', id: 1 } };
      const res = mockRes();

      await ClassesController.update(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Clase actualizada' })
      );
    });
  });

  // ─── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    test('devuelve 404 si la clase no existe', async () => {
      ClassSession.findById.mockResolvedValue(null);

      const req = { params: { id: '99' }, user: { role: 'admin', id: 1 } };
      const res = mockRes();

      await ClassesController.remove(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('trainer no puede borrar una clase que no es suya', async () => {
      ClassSession.findById.mockResolvedValue({ id: 1, trainer_user_id: 3 });

      const req = { params: { id: '1' }, user: { role: 'trainer', id: 99 } };
      const res = mockRes();

      await ClassesController.remove(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('admin elimina la clase y devuelve 204', async () => {
      ClassSession.findById.mockResolvedValue({ id: 1, trainer_user_id: 3 });
      ClassSession.remove.mockResolvedValue();

      const req = { params: { id: '1' }, user: { role: 'admin', id: 1 } };
      const res = mockRes();

      await ClassesController.remove(req, res);

      expect(res.status).toHaveBeenCalledWith(204);
    });
  });

  // ─── myReservations ─────────────────────────────────────────────────────────

  describe('myReservations', () => {
    test('devuelve las reservas del usuario autenticado', async () => {
      const reservas = [{ id: 1, class_id: 2 }];
      ClassSession.listUserReservations.mockResolvedValue(reservas);

      const req = { user: { id: 5 } };
      const res = mockRes();

      await ClassesController.myReservations(req, res);

      expect(res.json).toHaveBeenCalledWith({ reservations: reservas });
    });
  });
});

  // ─── catch blocks (error 500) ────────────────────────────────────────────

  describe('errores 500 en catch', () => {
    test('get devuelve 500 si el modelo lanza un error', async () => {
      ClassSession.findById.mockRejectedValue(new Error('DB error'));
      const req = { params: { id: '1' } };
      const res = mockRes();
      await ClassesController.get(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener la clase' });
    });

    test('create devuelve 403 si el rol no es admin ni trainer', async () => {
      const req = {
        body: { class_type_id: 1, starts_at: '2026-06-01T10:00:00Z', ends_at: '2026-06-01T11:00:00Z', capacity: 10 },
        user: { role: 'member', id: 5 },
      };
      const res = mockRes();
      await ClassesController.create(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'No tienes permisos para crear clases' });
    });

    test('create devuelve 500 si el modelo lanza un error', async () => {
      ClassSession.create.mockRejectedValue(new Error('DB error'));
      const req = {
        body: { class_type_id: 1, starts_at: '2026-06-01T10:00:00Z', ends_at: '2026-06-01T11:00:00Z', capacity: 10, trainer_user_id: 3 },
        user: { role: 'admin', id: 1 },
      };
      const res = mockRes();
      await ClassesController.create(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error al crear la clase' });
    });

    test('reserve devuelve 500 si el modelo lanza un error', async () => {
      ClassSession.reserve.mockRejectedValue(new Error('DB error'));
      const req = { params: { id: '1' }, user: { id: 5 } };
      const res = mockRes();
      await ClassesController.reserve(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error al reservar plaza' });
    });

    test('cancel devuelve 500 si el modelo lanza un error', async () => {
      ClassSession.cancel.mockRejectedValue(new Error('DB error'));
      const req = { params: { id: '1' }, user: { id: 5 } };
      const res = mockRes();
      await ClassesController.cancel(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error al cancelar la reserva' });
    });

    test('reservations devuelve 500 si el modelo lanza un error', async () => {
      ClassSession.findById.mockRejectedValue(new Error('DB error'));
      const req = { params: { id: '1' }, query: {}, user: { role: 'admin', id: 1 } };
      const res = mockRes();
      await ClassesController.reservations(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener reservas' });
    });

    test('update devuelve 500 si el modelo lanza un error', async () => {
      ClassSession.findById.mockRejectedValue(new Error('DB error'));
      const req = { params: { id: '1' }, body: {}, user: { role: 'admin', id: 1 } };
      const res = mockRes();
      await ClassesController.update(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error al actualizar la clase' });
    });

    test('remove devuelve 500 si el modelo lanza un error', async () => {
      ClassSession.findById.mockRejectedValue(new Error('DB error'));
      const req = { params: { id: '1' }, user: { role: 'admin', id: 1 } };
      const res = mockRes();
      await ClassesController.remove(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error al eliminar la clase' });
    });

    test('myReservations devuelve 500 si el modelo lanza un error', async () => {
      ClassSession.listUserReservations.mockRejectedValue(new Error('DB error'));
      const req = { user: { id: 5 } };
      const res = mockRes();
      await ClassesController.myReservations(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener tus reservas' });
    });
  });

  // ─── updateReservationStatus ─────────────────────────────────────────────

  describe('updateReservationStatus', () => {
    test('devuelve 400 si faltan classId, reservationId o status', async () => {
      const req = { params: { id: '1', reservationId: '0' }, body: {}, user: { role: 'admin', id: 1 } };
      const res = mockRes();
      await ClassesController.updateReservationStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'classId, reservationId y status son obligatorios' });
    });

    test('devuelve 400 si el estado de asistencia no es válido', async () => {
      ClassSession.isAttendanceStatus.mockReturnValue(false);
      const req = { params: { id: '1', reservationId: '2' }, body: { status: 'inventado' }, user: { role: 'admin', id: 1 } };
      const res = mockRes();
      await ClassesController.updateReservationStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Estado de asistencia no valido' });
    });

    test('devuelve 404 si la clase no existe', async () => {
      ClassSession.isAttendanceStatus.mockReturnValue(true);
      ClassSession.findById.mockResolvedValue(null);
      const req = { params: { id: '99', reservationId: '2' }, body: { status: 'present' }, user: { role: 'admin', id: 1 } };
      const res = mockRes();
      await ClassesController.updateReservationStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('devuelve 403 si el trainer no es el asignado', async () => {
      ClassSession.isAttendanceStatus.mockReturnValue(true);
      ClassSession.findById.mockResolvedValue({ id: 1, trainer_user_id: 3 });
      const req = { params: { id: '1', reservationId: '2' }, body: { status: 'present' }, user: { role: 'trainer', id: 99 } };
      const res = mockRes();
      await ClassesController.updateReservationStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('actualiza el estado correctamente', async () => {
      ClassSession.isAttendanceStatus.mockReturnValue(true);
      ClassSession.findById.mockResolvedValue({ id: 1, trainer_user_id: 3 });
      ClassSession.updateReservationStatus.mockResolvedValue({ ok: true, reservation: { id: 2, status: 'present' } });
      const req = { params: { id: '1', reservationId: '2' }, body: { status: 'present' }, user: { role: 'admin', id: 1 } };
      const res = mockRes();
      await ClassesController.updateReservationStatus(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Estado de asistencia actualizado' }));
    });

    test('devuelve 500 si el modelo lanza un error', async () => {
      ClassSession.isAttendanceStatus.mockReturnValue(true);
      ClassSession.findById.mockRejectedValue(new Error('DB error'));
      const req = { params: { id: '1', reservationId: '2' }, body: { status: 'present' }, user: { role: 'admin', id: 1 } };
      const res = mockRes();
      await ClassesController.updateReservationStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });