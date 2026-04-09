const ClassSession = require('../../src/models/ClassSession');
const pool = require('../../src/database/db');

// mock del pool para evitar conexión real a BD
jest.mock('../../src/database/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

// Helper que construye un cliente de transacción simulado
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

describe('ClassSession model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── isAttendanceStatus ────────────────────────────────────────────────────

  describe('isAttendanceStatus', () => {
    test('devuelve true para estados de asistencia válidos', () => {
      expect(ClassSession.isAttendanceStatus('present')).toBe(true);
      expect(ClassSession.isAttendanceStatus('late')).toBe(true);
      expect(ClassSession.isAttendanceStatus('absent')).toBe(true);
      expect(ClassSession.isAttendanceStatus('no_show')).toBe(true);
    });

    test('devuelve false para estados no permitidos', () => {
      expect(ClassSession.isAttendanceStatus('booked')).toBe(false);
      expect(ClassSession.isAttendanceStatus('cancelled')).toBe(false);
      expect(ClassSession.isAttendanceStatus('inventado')).toBe(false);
      expect(ClassSession.isAttendanceStatus('')).toBe(false);
    });
  });

  // ─── reserve ───────────────────────────────────────────────────────────────

  describe('reserve', () => {
    test('devuelve error si la clase no existe', async () => {
      mockClient([
        { rowCount: 0, rows: [] }, // BEGIN
        { rowCount: 0, rows: [] }, // SELECT clase FOR UPDATE — no encontrada
        { rowCount: 0, rows: [] }, // ROLLBACK
      ]);

      const result = await ClassSession.reserve(99, 1);

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Clase no encontrada');
    });

    test('devuelve error si la clase ya ha comenzado', async () => {
      const pasado = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // hace 1 hora
      mockClient([
        { rowCount: 0 },                                                         // BEGIN
        { rowCount: 1, rows: [{ id: 1, capacity: 10, starts_at: pasado }] },    // SELECT clase
        { rowCount: 0 },                                                         // ROLLBACK
      ]);

      const result = await ClassSession.reserve(1, 1);

      expect(result.ok).toBe(false);
      expect(result.error).toBe('La clase ya ha comenzado. No puedes reservar.');
    });

    test('devuelve error si el usuario ya tiene reserva activa', async () => {
      const futuro = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      mockClient([
        { rowCount: 0 },
        { rowCount: 1, rows: [{ id: 1, capacity: 10, starts_at: futuro }] },        // clase existe
        { rowCount: 1, rows: [{ id: 5, status: 'booked' }] },                       // reserva activa ya existe
        { rowCount: 0 },                                                             // ROLLBACK
      ]);

      const result = await ClassSession.reserve(1, 1);

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Ya tienes una reserva activa para esta clase');
    });

    test('devuelve error si el aforo está completo', async () => {
      const futuro = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      mockClient([
        { rowCount: 0 },
        { rowCount: 1, rows: [{ id: 1, capacity: 2, starts_at: futuro }] },    // capacity: 2
        { rowCount: 0, rows: [] },                                              // sin reserva previa
        { rowCount: 1, rows: [{ booked: 2 }] },                                // booked === capacity
        { rowCount: 0 },                                                        // ROLLBACK
      ]);

      const result = await ClassSession.reserve(1, 1);

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Aforo completo');
    });

    test('crea reserva nueva correctamente', async () => {
      const futuro = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const reserva = { id: 10, class_id: 1, user_id: 1, status: 'booked' };
      mockClient([
        { rowCount: 0 },
        { rowCount: 1, rows: [{ id: 1, capacity: 10, starts_at: futuro }] },   // clase existe
        { rowCount: 0, rows: [] },                                              // sin reserva previa
        { rowCount: 1, rows: [{ booked: 3 }] },                                // hay plazas
        { rowCount: 1, rows: [reserva] },                                      // INSERT reserva
        { rowCount: 0 },                                                        // COMMIT
      ]);

      const result = await ClassSession.reserve(1, 1);

      expect(result.ok).toBe(true);
      expect(result.reservation).toEqual(reserva);
    });

    test('reactiva una reserva previamente cancelada', async () => {
      const futuro = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const reservaReactivada = { id: 10, class_id: 1, user_id: 1, status: 'booked' };
      mockClient([
        { rowCount: 0 },
        { rowCount: 1, rows: [{ id: 1, capacity: 10, starts_at: futuro }] },
        { rowCount: 1, rows: [{ id: 10, status: 'cancelled' }] },              // reserva cancelada existe
        { rowCount: 1, rows: [{ booked: 2 }] },
        { rowCount: 1, rows: [reservaReactivada] },                            // UPDATE reactivación
        { rowCount: 0 },                                                        // COMMIT
      ]);

      const result = await ClassSession.reserve(1, 1);

      expect(result.ok).toBe(true);
      expect(result.reservation.status).toBe('booked');
    });
  });

  // ─── updateReservationStatus ───────────────────────────────────────────────

  describe('updateReservationStatus', () => {
    test('devuelve error si el estado no es válido', async () => {
      const result = await ClassSession.updateReservationStatus(1, 1, 'inventado');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Estado de asistencia no valido');
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('devuelve error si la reserva no existe o está cancelada', async () => {
      pool.query.mockResolvedValue({ rowCount: 0, rows: [] });

      const result = await ClassSession.updateReservationStatus(1, 1, 'present');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Reserva no encontrada o cancelada');
    });

    test('actualiza el estado correctamente', async () => {
      const reserva = { id: 1, class_id: 1, user_id: 5, status: 'present' };
      pool.query.mockResolvedValue({ rowCount: 1, rows: [reserva] });

      const result = await ClassSession.updateReservationStatus(1, 1, 'present');

      expect(result.ok).toBe(true);
      expect(result.reservation.status).toBe('present');
    });
  });
});