const pool = require('../database/db');
const bcrypt = require('bcryptjs');

class User {
    //Creamos el usuario en la tabla users
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

    //Creación del perfil del usuario en la tabla user_profiles
    static async createProfile(userId, profileData) {
        const {
            firstName,
            lastName,
            phone,
            birthDate,
            gender,
            heightCm,
            weightKg,
            experienceLevel
        } = profileData;

        const query = `
            INSERT INTO user_profiles (
                user_id, first_name, last_name, phone, birth_date, gender,
                height_cm, weight_kg, experience_level
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING user_id, first_name, last_name, phone, birth_date, gender,
                    height_cm, weight_kg, experience_level
        `;

        try{
            const result = await pool.query(query, [
                userId,
                firstName,
                lastName,
                phone || null,
                birthDate || null,
                gender || null,
                heightCm ?? null,
                weightKg ?? null,
                experienceLevel || 'beginner'
            ]);
            return result.rows[0];
        } catch (error) {
             if (error.code === '23505') {
            //Unico numero de teléfono
            throw new Error('El teléfono ya existe');
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
        const query = `
        SELECT 
            u.id, u.email, u.name, u.role, u.created_at,
            p.first_name, p.last_name, p.phone, p.birth_date, p.gender,
            p.height_cm, p.weight_kg, p.experience_level
        FROM users u
        LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE u.id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
    }

    static async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }

    static async updateProfile(userId, profileData) {
    const fields = [];
    const values = [];
    let idx = 1;

    const map = {
        firstName: 'first_name',
        lastName: 'last_name',
        phone: 'phone',
        birthDate: 'birth_date',
        gender: 'gender',
        heightCm: 'height_cm',
        weightKg: 'weight_kg',
        experienceLevel: 'experience_level',
    };

    for (const [key, col] of Object.entries(map)) {
        if (profileData[key] !== undefined) {
            fields.push(`${col} = $${idx++}`);
            values.push(profileData[key]);
        }
    }

    // Si no hay nada que actualizar
    if (fields.length === 0) {
        const current = await pool.query(
            `SELECT user_id, first_name, last_name, phone, birth_date, gender,
                    height_cm, weight_kg, experience_level
             FROM user_profiles WHERE user_id = $1`,
            [userId]
        );
        return current.rows[0] || null;
    }

    // updated_at siempre
    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `
        UPDATE user_profiles
        SET ${fields.join(', ')}
        WHERE user_id = $${idx}
        RETURNING user_id, first_name, last_name, phone, birth_date, gender,
                  height_cm, weight_kg, experience_level
    `;

    values.push(userId);

    const result = await pool.query(query, values);
    return result.rows[0] || null;
}

}

module.exports = User;