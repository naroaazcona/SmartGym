const pool = require('../database/db');

class ClassType {
  static async findAll({ includeInactive = false } = {}) {
    const where = includeInactive ? '' : 'WHERE is_active = TRUE';
    const result = await pool.query(
      `SELECT id, name, description, is_active, created_at, updated_at
       FROM class_types
       ${where}
       ORDER BY name ASC`
    );
    return result.rows;
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT id, name, description, is_active, created_at, updated_at
       FROM class_types
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    return result.rows[0] || null;
  }

  static async create({ name, description }) {
    const result = await pool.query(
      `INSERT INTO class_types (name, description)
       VALUES ($1, $2)
       RETURNING id, name, description, is_active, created_at, updated_at`,
      [name, description || null]
    );
    return result.rows[0];
  }

  static async update(id, { name, description }) {
    const updates = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(name);
    }

    if (description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(description || null);
    }

    if (!updates.length) {
      return this.findById(id);
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE class_types
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${idx}
       RETURNING id, name, description, is_active, created_at, updated_at`,
      values
    );
    return result.rows[0] || null;
  }

  static async remove(id) {
    const result = await pool.query(
      `UPDATE class_types
       SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, description, is_active, created_at, updated_at`,
      [id]
    );
    return result.rows[0] || null;
  }
}

module.exports = ClassType;
