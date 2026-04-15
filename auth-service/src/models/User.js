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

    static async findByEmailWithPhone(email) {
        const query = `
            SELECT u.id, u.email, u.name, u.role, p.phone
            FROM users u
            LEFT JOIN user_profiles p ON p.user_id = u.id
            WHERE u.email = $1
            LIMIT 1
        `;
        const result = await pool.query(query, [email]);
        return result.rows[0];
    }

    static async findById(id) {
        const query = `
        SELECT 
            u.id, u.email, u.name, u.role, u.created_at,
            p.first_name, p.last_name, p.phone, p.birth_date, p.gender,
            p.height_cm, p.weight_kg, p.experience_level,
            s.plan AS subscription_plan, s.status AS subscription_status
        FROM users u
        LEFT JOIN user_profiles p ON p.user_id = u.id
        LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
        WHERE u.id = $1
        ORDER BY s.created_at DESC NULLS LAST
        LIMIT 1
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

static async findByRole(role) {
    const query = `
        SELECT 
            u.id, u.email, u.name, u.role,
            p.first_name, p.last_name
        FROM users u
        LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE u.role = $1
        ORDER BY u.name ASC
    `;
    const result = await pool.query(query, [role]);
    return result.rows;
}

static async findAll() {
    const query = `
        SELECT
            u.id,
            u.email,
            u.name,
            u.role,
            u.created_at,
            u.updated_at,
            p.first_name,
            p.last_name,
            p.phone,
            p.birth_date,
            p.gender,
            p.height_cm,
            p.weight_kg,
            p.experience_level,
            s.plan AS subscription_plan,
            s.status AS subscription_status,
            s.current_period_end AS subscription_current_period_end
        FROM users u
        LEFT JOIN user_profiles p ON p.user_id = u.id
        LEFT JOIN LATERAL (
            SELECT
                sub.plan,
                sub.status,
                sub.current_period_end,
                sub.created_at
            FROM subscriptions sub
            WHERE sub.user_id = u.id
            ORDER BY sub.created_at DESC
            LIMIT 1
        ) s ON TRUE
        ORDER BY
            CASE u.role
                WHEN 'admin' THEN 1
                WHEN 'trainer' THEN 2
                ELSE 3
            END,
            u.name ASC,
            u.id ASC
    `;
    const result = await pool.query(query);
    return result.rows;
}

static async findRegisteredBasic() {
    const query = `
        SELECT
            u.id,
            u.email,
            u.name,
            u.role,
            u.created_at,
            p.first_name,
            p.last_name
        FROM users u
        LEFT JOIN user_profiles p ON p.user_id = u.id
        ORDER BY u.created_at DESC, u.id DESC
    `;

    const result = await pool.query(query);
    return result.rows;
}

static async updateByAdmin(userId, data = {}) {
    const id = Number(userId);
    if (!Number.isInteger(id) || id <= 0) return null;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const currentResult = await client.query(
            `SELECT
                u.id,
                u.email,
                u.name,
                u.role,
                p.first_name,
                p.last_name,
                p.phone,
                p.birth_date,
                p.gender,
                p.height_cm,
                p.weight_kg,
                p.experience_level
             FROM users u
             LEFT JOIN user_profiles p ON p.user_id = u.id
             WHERE u.id = $1
             LIMIT 1`,
            [id]
        );

        const current = currentResult.rows[0];
        if (!current) {
            await client.query('ROLLBACK');
            return null;
        }

        const rawRole = data.role === undefined ? current.role : String(data.role || '').trim().toLowerCase();
        const allowedRoles = new Set(['admin', 'trainer', 'member']);
        if (!allowedRoles.has(rawRole)) {
            await client.query('ROLLBACK');
            throw new Error('invalid_role');
        }

        const nextEmail = data.email === undefined ? current.email : String(data.email || '').trim().toLowerCase();
        if (!nextEmail) {
            await client.query('ROLLBACK');
            throw new Error('invalid_email');
        }

        const nextFirstName =
            data.firstName === undefined ? String(current.first_name || '').trim() : String(data.firstName || '').trim();
        const nextLastName =
            data.lastName === undefined ? String(current.last_name || '').trim() : String(data.lastName || '').trim();

        const fallbackName = String(current.name || '').trim();
        const fallbackParts = fallbackName ? fallbackName.split(/\s+/) : [];
        const ensuredFirstName = nextFirstName || fallbackParts[0] || 'Usuario';
        const ensuredLastName = nextLastName || fallbackParts.slice(1).join(' ') || '-';

        const requestedName = data.name === undefined ? null : String(data.name || '').trim();
        const computedName = requestedName || `${ensuredFirstName} ${ensuredLastName}`.trim();

        await client.query(
            `UPDATE users
             SET email = $1,
                 name = $2,
                 role = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4`,
            [nextEmail, computedName, rawRole, id]
        );

        const nextPhone =
            data.phone === undefined ? (current.phone || null) : (String(data.phone || '').trim() || null);
        const nextBirthDate =
            data.birthDate === undefined ? (current.birth_date || null) : (data.birthDate || null);
        const nextGender =
            data.gender === undefined ? (current.gender || null) : (String(data.gender || '').trim() || null);
        const nextHeightCm =
            data.heightCm === undefined ? (current.height_cm ?? null) : (data.heightCm ?? null);
        const nextWeightKg =
            data.weightKg === undefined ? (current.weight_kg ?? null) : (data.weightKg ?? null);
        const nextExperienceLevel =
            data.experienceLevel === undefined
                ? (current.experience_level || 'beginner')
                : (String(data.experienceLevel || '').trim() || 'beginner');

        await client.query(
            `INSERT INTO user_profiles (
                user_id, first_name, last_name, phone, birth_date, gender,
                height_cm, weight_kg, experience_level, updated_at
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE
            SET first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                phone = EXCLUDED.phone,
                birth_date = EXCLUDED.birth_date,
                gender = EXCLUDED.gender,
                height_cm = EXCLUDED.height_cm,
                weight_kg = EXCLUDED.weight_kg,
                experience_level = EXCLUDED.experience_level,
                updated_at = CURRENT_TIMESTAMP`,
            [
                id,
                ensuredFirstName,
                ensuredLastName,
                nextPhone,
                nextBirthDate,
                nextGender,
                nextHeightCm,
                nextWeightKg,
                nextExperienceLevel,
            ]
        );

        await client.query('COMMIT');
        return await this.findById(id);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

static async deleteById(userId) {
    const id = Number(userId);
    if (!Number.isInteger(id) || id <= 0) return null;
    const result = await pool.query(
        `DELETE FROM users
         WHERE id = $1
         RETURNING id, email, name, role`,
        [id]
    );
    return result.rows[0] || null;
}

static async findBasicByIds(ids = []) {
    const normalizedIds = [...new Set(
        (Array.isArray(ids) ? ids : [])
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0)
    )];

    if (!normalizedIds.length) return [];

    const query = `
        SELECT
            u.id,
            u.name,
            u.role,
            p.first_name,
            p.last_name
        FROM users u
        LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE u.id = ANY($1::int[])
        ORDER BY u.id ASC
    `;

    const result = await pool.query(query, [normalizedIds]);
    return result.rows;
}

static async createPasswordRecoveryRequest(userId, verificationCode, codeExpiresAt) {
    const codeHash = await bcrypt.hash(String(verificationCode), 10);
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await client.query(
            `UPDATE password_recovery_requests
             SET used_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND used_at IS NULL`,
            [userId]
        );

        const result = await client.query(
            `INSERT INTO password_recovery_requests (user_id, code_hash, code_expires_at)
             VALUES ($1, $2, $3)
             RETURNING id, user_id, code_expires_at, created_at`,
            [userId, codeHash, codeExpiresAt]
        );
        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

static async verifyPasswordRecoveryCode(requestId, code, resetToken, resetExpiresAt) {
    const result = await pool.query(
        `SELECT id, code_hash, attempts, max_attempts, code_expires_at
         FROM password_recovery_requests
         WHERE id = $1 AND used_at IS NULL AND verified_at IS NULL`,
        [requestId]
    );
    const request = result.rows[0];

    if (!request) {
        return { ok: false, reason: 'not_found' };
    }

    if (new Date(request.code_expires_at).getTime() < Date.now()) {
        await pool.query(
            `UPDATE password_recovery_requests
             SET used_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [requestId]
        );
        return { ok: false, reason: 'expired' };
    }

    if (Number(request.attempts) >= Number(request.max_attempts)) {
        await pool.query(
            `UPDATE password_recovery_requests
             SET used_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [requestId]
        );
        return { ok: false, reason: 'max_attempts' };
    }

    const isValidCode = await bcrypt.compare(String(code), request.code_hash);
    if (!isValidCode) {
        const attemptsResult = await pool.query(
            `UPDATE password_recovery_requests
             SET attempts = attempts + 1,
                 used_at = CASE
                    WHEN attempts + 1 >= max_attempts THEN CURRENT_TIMESTAMP
                    ELSE used_at
                 END
             WHERE id = $1
             RETURNING attempts, max_attempts`,
            [requestId]
        );
        const attemptsRow = attemptsResult.rows[0];
        if (attemptsRow && Number(attemptsRow.attempts) >= Number(attemptsRow.max_attempts)) {
            return { ok: false, reason: 'max_attempts' };
        }
        return { ok: false, reason: 'invalid_code' };
    }

    const resetTokenHash = await bcrypt.hash(String(resetToken), 10);
    await pool.query(
        `UPDATE password_recovery_requests
         SET verified_at = CURRENT_TIMESTAMP,
             reset_token_hash = $2,
             reset_expires_at = $3
         WHERE id = $1`,
        [requestId, resetTokenHash, resetExpiresAt]
    );

    return { ok: true };
}

static async resetPasswordWithRecovery(requestId, resetToken, newPassword) {
    const result = await pool.query(
        `SELECT id, user_id, verified_at, reset_token_hash, reset_expires_at
         FROM password_recovery_requests
         WHERE id = $1 AND used_at IS NULL`,
        [requestId]
    );
    const request = result.rows[0];

    if (!request || !request.verified_at || !request.reset_token_hash) {
        return { ok: false, reason: 'invalid_request' };
    }

    if (new Date(request.reset_expires_at).getTime() < Date.now()) {
        await pool.query(
            `UPDATE password_recovery_requests
             SET used_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [requestId]
        );
        return { ok: false, reason: 'expired' };
    }

    const tokenMatches = await bcrypt.compare(String(resetToken), request.reset_token_hash);
    if (!tokenMatches) {
        return { ok: false, reason: 'invalid_token' };
    }

    const hashedPassword = await bcrypt.hash(String(newPassword), 10);
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await client.query(
            `UPDATE users
             SET password = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [hashedPassword, request.user_id]
        );
        await client.query(
            `UPDATE password_recovery_requests
             SET used_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [requestId]
        );
        await client.query('COMMIT');
        return { ok: true };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

}

module.exports = User;
