const pool = require('../database/db');

class ClassSession {
  // Obtener clase por id
  static async findById(id) {
    const result = await pool.query(
      `SELECT c.*,
              ct.name AS class_type_name,
              (SELECT COUNT(*)::int
               FROM class_reservations r
               WHERE r.class_id = c.id AND r.status = 'booked') AS booked_count
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
               WHERE r.class_id = c.id AND r.status = 'booked') AS booked_count
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


  // Reserva con transacción + lock para evitar overbooking
  static async reserve(classId, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // lock de la clase
      const classRes = await client.query(
        `SELECT id, capacity
         FROM classes
         WHERE id = $1
         FOR UPDATE`,
        [classId]
      );

      if (classRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'Clase no encontrada' };
      }

      const capacity = classRes.rows[0].capacity;

      const bookedRes = await client.query(
        `SELECT COUNT(*)::int AS booked
         FROM class_reservations
         WHERE class_id = $1 AND status = 'booked'`,
        [classId]
      );

      const booked = bookedRes.rows[0].booked;
      if (booked >= capacity) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'Aforo completo' };
      }

      // idempotente: inserta o reactiva si ya existía (status cancelado)
      const upsertRes = await client.query(
        `INSERT INTO class_reservations (class_id, user_id, status)
         VALUES ($1,$2,'booked')
         ON CONFLICT (class_id, user_id)
         DO UPDATE SET status = 'booked', cancelled_at = NULL
         RETURNING id, class_id, user_id, status, created_at, cancelled_at`,
        [classId, userId]
      );

      await client.query('COMMIT');
      return { ok: true, reservation: upsertRes.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Error reservando plaza' };
    } finally {
      client.release();
    }
  }

  // Cancelar reserva
  static async cancel(classId, userId) {
    const result = await pool.query(
      `UPDATE class_reservations
       SET status = 'cancelled', cancelled_at = NOW()
       WHERE class_id = $1 AND user_id = $2 AND status = 'booked'
       RETURNING id, class_id, user_id, status, cancelled_at`,
      [classId, userId]
    );

    return result.rows[0] || null;
  }

  // Listar reservas de una clase
  static async listReservations(classId) {
    const result = await pool.query(
      `SELECT id, class_id, user_id, status, created_at, cancelled_at
       FROM class_reservations
       WHERE class_id = $1
       ORDER BY created_at ASC`,
      [classId]
    );
    return result.rows;
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
               WHERE r2.class_id = c.id AND r2.status = 'booked') AS booked_count
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
