const pool = require('../database/db');

class ClassType {
  static async findAll() {
    const result = await pool.query(
      `SELECT id, name, description, is_active, created_at, updated_at
       FROM class_types
       ORDER BY name ASC`
    );
    return result.rows;
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
}

module.exports = ClassType;
