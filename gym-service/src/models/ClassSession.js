const pool = require('../database/db');

const RESERVATION_STATUS = Object.freeze({
  BOOKED: 'booked',
  CANCELLED: 'cancelled',
  PRESENT: 'present',
  LATE: 'late',
  ABSENT: 'absent',
  NO_SHOW: 'no_show'
});

const ATTENDANCE_STATUSES = new Set([
  RESERVATION_STATUS.PRESENT,
  RESERVATION_STATUS.LATE,
  RESERVATION_STATUS.ABSENT,
  RESERVATION_STATUS.NO_SHOW
]);

class ClassSession {
  static isAttendanceStatus(status) {
    return ATTENDANCE_STATUSES.has(status);
  }

  // Obtener clase por id
  static async findById(id) {
    const result = await pool.query(
      `SELECT c.*,
              ct.name AS class_type_name,
              (SELECT COUNT(*)::int
               FROM class_reservations r
               WHERE r.class_id = c.id AND r.status <> 'cancelled') AS booked_count
       FROM classes c
       JOIN class_types ct ON ct.id = c.class_type_id
       WHERE c.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  // Listar todas las clases con filtros opcionales de fecha
  static async findAll({ from, to }) {
    const values = [];
    const where = [];
    let idx = 1;

    if (from) {
      where.push(`c.starts_at >= $${idx++}`);
      values.push(from);
    }
    if (to) {
      where.push(`c.starts_at <= $${idx++}`);
      values.push(to);
    }

    const result = await pool.query(
      `SELECT c.*,
              ct.name AS class_type_name,
              (SELECT COUNT(*)::int
               FROM class_reservations r
               WHERE r.class_id = c.id AND r.status <> 'cancelled') AS booked_count
       FROM classes c
       JOIN class_types ct ON ct.id = c.class_type_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY c.starts_at ASC`,
      values
    );

    return result.rows;
  }

  // Crear nueva clase
  static async create(data) {
    const {
      class_type_id,
      trainer_user_id,
      starts_at,
      ends_at,
      capacity,
      instructor_name,
      location,
      description
    } = data;

    const result = await pool.query(
      `INSERT INTO classes (class_type_id, trainer_user_id, starts_at, ends_at, capacity, instructor_name, location, description)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [
        class_type_id,
        trainer_user_id ?? null,
        starts_at,
        ends_at,
        capacity,
        instructor_name || null,
        location || null,
        description || null
      ]
    );

    return result.rows[0];
  }

  // Reserva con transaccion + lock para evitar overbooking
  static async reserve(classId, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // lock de la clase
      const classRes = await client.query(
        `SELECT id, capacity, starts_at
         FROM classes
         WHERE id = $1
         FOR UPDATE`,
        [classId]
      );

      if (classRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'Clase no encontrada' };
      }

      const capacity = Number(classRes.rows[0].capacity || 0);
      const startsAt = new Date(classRes.rows[0].starts_at);
      if (startsAt.getTime() <= Date.now()) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'La clase ya ha comenzado. No puedes reservar.' };
      }

      const existingRes = await client.query(
        `SELECT id, class_id, user_id, status, created_at, cancelled_at
         FROM class_reservations
         WHERE class_id = $1 AND user_id = $2
         FOR UPDATE`,
        [classId, userId]
      );

      if (existingRes.rowCount > 0 && existingRes.rows[0].status !== RESERVATION_STATUS.CANCELLED) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'Ya tienes una reserva activa para esta clase' };
      }

      const bookedRes = await client.query(
        `SELECT COUNT(*)::int AS booked
         FROM class_reservations
         WHERE class_id = $1 AND status <> 'cancelled'`,
        [classId]
      );

      const booked = Number(bookedRes.rows[0].booked || 0);
      if (booked >= capacity) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'Aforo completo' };
      }

      let reservation;
      if (existingRes.rowCount > 0 && existingRes.rows[0].status === RESERVATION_STATUS.CANCELLED) {
        const reactivatedRes = await client.query(
          `UPDATE class_reservations
           SET status = $3, cancelled_at = NULL
           WHERE class_id = $1 AND user_id = $2
           RETURNING id, class_id, user_id, status, created_at, cancelled_at`,
          [classId, userId, RESERVATION_STATUS.BOOKED]
        );
        reservation = reactivatedRes.rows[0];
      } else {
        const insertRes = await client.query(
          `INSERT INTO class_reservations (class_id, user_id, status)
           VALUES ($1, $2, $3)
           RETURNING id, class_id, user_id, status, created_at, cancelled_at`,
          [classId, userId, RESERVATION_STATUS.BOOKED]
        );
        reservation = insertRes.rows[0];
      }

      await client.query('COMMIT');
      return { ok: true, reservation };
    } catch (error) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Error reservando plaza' };
    } finally {
      client.release();
    }
  }

  // Cancelar reserva
  static async cancel(classId, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const reservationRes = await client.query(
        `SELECT r.id, r.class_id, r.user_id, r.status, r.created_at, r.cancelled_at, c.starts_at
         FROM class_reservations r
         JOIN classes c ON c.id = r.class_id
         WHERE r.class_id = $1 AND r.user_id = $2
         FOR UPDATE`,
        [classId, userId]
      );

      if (reservationRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'No tienes una reserva hecha para cancelar' };
      }

      const reservation = reservationRes.rows[0];
      if (reservation.status !== RESERVATION_STATUS.BOOKED) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'Solo puedes cancelar reservas en estado booked' };
      }

      const startsAt = new Date(reservation.starts_at);
      const limit = new Date(startsAt.getTime() - 15 * 60 * 1000);
      if (Date.now() > limit.getTime()) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'Solo puedes cancelar hasta 15 minutos antes del inicio' };
      }

      const result = await client.query(
        `UPDATE class_reservations
         SET status = $3, cancelled_at = NOW()
         WHERE class_id = $1 AND user_id = $2
         RETURNING id, class_id, user_id, status, cancelled_at`,
        [classId, userId, RESERVATION_STATUS.CANCELLED]
      );

      await client.query('COMMIT');
      return { ok: true, reservation: result.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Error al cancelar la reserva' };
    } finally {
      client.release();
    }
  }

  // Listar reservas de una clase
  static async listReservations(classId, { includeCancelled = false } = {}) {
    const result = await pool.query(
      `SELECT id, class_id, user_id, status, created_at, cancelled_at
       FROM class_reservations
       WHERE class_id = $1
       ${includeCancelled ? '' : "AND status <> 'cancelled'"}
       ORDER BY created_at ASC`,
      [classId]
    );
    return result.rows;
  }

  // Actualizar estado de asistencia de una reserva
  static async updateReservationStatus(classId, reservationId, status) {
    if (!ATTENDANCE_STATUSES.has(status)) {
      return { ok: false, error: 'Estado de asistencia no valido' };
    }

    const result = await pool.query(
      `UPDATE class_reservations
       SET status = $3
       WHERE id = $1
         AND class_id = $2
         AND status <> $4
       RETURNING id, class_id, user_id, status, created_at, cancelled_at`,
      [reservationId, classId, status, RESERVATION_STATUS.CANCELLED]
    );

    if (result.rowCount === 0) {
      return { ok: false, error: 'Reserva no encontrada o cancelada' };
    }

    return { ok: true, reservation: result.rows[0] };
  }

  // Actualizar clase
  static async update(classId, data) {
    const {
      name,
      description,
      schedule,
      capacity,
      class_type_id
    } = data;

    const result = await pool.query(
      `UPDATE classes
       SET name = $1,
           description = $2,
           schedule = $3,
           capacity = $4,
           class_type_id = $5
       WHERE id = $6
       RETURNING *`,
      [name, description, schedule, capacity, class_type_id, classId]
    );

    return result.rows[0];
  }

  // Eliminar clase
  static async remove(classId) {
    const result = await pool.query(
      `DELETE FROM classes
       WHERE id = $1
       RETURNING *`,
      [classId]
    );
    return result.rows[0] || null;
  }

  // Listar reservas por usuario con info de clase
  static async listUserReservations(userId) {
    const result = await pool.query(
      `SELECT r.id as reservation_id,
              r.status,
              r.created_at,
              r.cancelled_at,
              c.*,
              ct.name AS class_type_name,
              (SELECT COUNT(*)::int
               FROM class_reservations r2
               WHERE r2.class_id = c.id AND r2.status <> 'cancelled') AS booked_count
       FROM class_reservations r
       JOIN classes c ON c.id = r.class_id
       JOIN class_types ct ON ct.id = c.class_type_id
       WHERE r.user_id = $1
       ORDER BY c.starts_at DESC`,
      [userId]
    );
    return result.rows;
  }
}

module.exports = ClassSession;
