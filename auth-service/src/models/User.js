const pool = require('../database/db');
const bcrypt = require('bcryptjs');

class User {
    static async create(userData) {
        const { email, password, name, role = 'member' } = userData;
        
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            
            const query = `
                INSERT INTO users (email, password, name, role) 
                VALUES ($1, $2, $3, $4) 
                RETURNING id, email, name, role, created_at
            `;
            
            const result = await pool.query(query, [email, hashedPassword, name, role]);
            return result.rows[0];
        } catch (error) {
            if (error.code === '23505') { // Unique violation
                throw new Error('El usuario ya existe');
            }
            throw error;
        }
    }

    //MÉTODOS ADICIONALES PARA INTERACTUAR CON LA TABLA DE USUARIOS
    static async findByEmail(email) {
        const query = 'SELECT * FROM users WHERE email = $1';
        const result = await pool.query(query, [email]);
        return result.rows[0];
    }

    static async findById(id) {
        const query = 'SELECT id, email, name, role, created_at FROM users WHERE id = $1';
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    static async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }
}

module.exports = User;