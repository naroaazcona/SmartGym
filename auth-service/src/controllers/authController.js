const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'smartgym_secret_key_2024_tfg';
const JWT_EXPIRES_IN = '24h';
const ALLOWED_EMAIL_PROVIDERS = ['gmail', 'outlook', 'yahoo'];

// Normaliza números de teléfono españoles a formato +34 XXXXXXXXX
function normalizeEsPhone(value = '') {
    const digits = String(value || '').replace(/[^\d]/g, '');
    if (!digits) return null;

    let local = digits;
    if (local.startsWith('0034')) local = local.slice(4);
    if (local.startsWith('34')) local = local.slice(2);
    local = local.replace(/^0+/, '');

    return local ? `+34 ${local}` : '+34';
}

// Verifica si el email pertenece a un proveedor permitido ('gmail', 'outlook', 'yahoo')
function isAllowedEmailProvider(email = '') {
    const domain = String(email).toLowerCase().trim().split('@')[1];
    if (!domain) return false;
    const provider = domain.split('.')[0];
    return ALLOWED_EMAIL_PROVIDERS.includes(provider);
}

class AuthController {
    // Registro de usuario
    static async register(req, res) {
        try {
            const { email, password, firstName, lastName, phone, birthDate,
                gender, heightCm, weightKg, experienceLevel, role = 'member' } = req.body;

            if (!email || !password || !firstName || !lastName) {
                return res.status(400).json({ 
                    error: 'Email, password, firstName y lastName son requeridos' 
                });
            }

            if (!isAllowedEmailProvider(email)) {
                return res.status(400).json({
                    error: 'Solo se permiten correos de Gmail, Outlook o Yahoo'
                });
            }

            if (password.length < 6) {
                return res.status(400).json({ 
                    error: 'La contraseña debe tener al menos 6 caracteres' 
                });
            }

            if (role !== 'member') {
                return res.status(403).json({
                error: 'No está permitido registrarse con ese rol'
                });
            }

            const name = `${firstName} ${lastName}`.trim();
            //Crear usuario (igual que antes)
            const user = await User.create({ email, password, name, role });

            //Crear perfil
            await User.createProfile(user.id, {
                firstName,
                lastName,
                phone: normalizeEsPhone(phone),
                birthDate,
                gender,
                heightCm,
                weightKg,
                experienceLevel
            });
            
            // Generar token JWT
            const token = jwt.sign(
                { 
                    userId: user.id, 
                    email: user.email, 
                    role: user.role 
                },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            res.status(201).json({
                message: 'Usuario registrado exitosamente',
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    profile: {
                        firstName,
                        lastName,
                        phone: phone || null,
                        birthDate: birthDate || null,
                        gender: gender || null,
                        heightCm: heightCm ?? null,
                        weightKg: weightKg ?? null,
                        experienceLevel: experienceLevel || 'beginner'
                    }
                },
                token
            });

        } catch (error) {
            console.error('Error en registro:', error);
            
            if (error.message === 'El usuario ya existe') {
                return res.status(409).json({ 
                    error: 'El usuario ya existe' 
                });
            }

            if (error.message === 'El teléfono ya existe') {
                return res.status(409).json({ error: 'El teléfono ya existe' });
            }

            res.status(500).json({ 
                error: 'Error interno del servidor' 
            });
        }
    }

    // Login de usuario
    static async login(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({ 
                    error: 'Email y password son requeridos' 
                });
            }

            // Buscar usuario
            const user = await User.findByEmail(email);
            if (!user) {
                return res.status(401).json({ 
                    error: 'Credenciales inválidas' 
                });
            }

            // Verificar password
            const isValidPassword = await User.verifyPassword(password, user.password);
            if (!isValidPassword) {
                return res.status(401).json({ 
                    error: 'Credenciales inválidas' 
                });
            }

            // Generar token JWT
            const token = jwt.sign(
                { 
                    userId: user.id, 
                    email: user.email, 
                    role: user.role 
                },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            res.json({
                message: 'Login exitoso',
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                },
                token
            });

        } catch (error) {
            console.error('Error en login:', error);
            res.status(500).json({ 
                error: 'Error interno del servidor' 
            });
        }
    }

    // Obtener perfil de usuario
    static async getProfile(req, res) {
        try {
            const user = await User.findById(req.userId);
            
            if (!user) {
                return res.status(404).json({ 
                    error: 'Usuario no encontrado' 
                });
            }

            res.json({
            message: 'Perfil obtenido exitosamente',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                created_at: user.created_at,
                profile: user.first_name ? {
                    firstName: user.first_name,
                    lastName: user.last_name,
                    phone: user.phone,
                    birthDate: user.birth_date,
                    gender: user.gender,
                    heightCm: user.height_cm,
                    weightKg: user.weight_kg,
                    experienceLevel: user.experience_level
                } : null
            }
        });
        } catch (error) {
            console.error('Error obteniendo perfil:', error);
            res.status(500).json({ 
                error: 'Error interno del servidor' 
            });
        }
    }

    // Logout de usuario (simulado)
    static async logout(req, res) {
        try {
            res.json({
                message: 'Logout exitoso',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error en logout:', error);
            res.status(500).json({ 
                error: 'Error interno del servidor' 
            });
        }
    }

    // Actualizar perfil de usuario
    static async updateProfile(req, res) {
        try {
            const {
                firstName,
                lastName,
                phone,
                birthDate,
                gender,
                heightCm,
                weightKg,
                experienceLevel
            } = req.body;

            // Opcional: validaciones mínimas (no obligatorias)
            if (firstName !== undefined && String(firstName).trim() === '') {
                return res.status(400).json({ error: 'firstName no puede estar vacío' });
            }
            if (lastName !== undefined && String(lastName).trim() === '') {
                return res.status(400).json({ error: 'lastName no puede estar vacío' });
            }

            const updated = await User.updateProfile(req.userId, {
                firstName,
                lastName,
                phone: phone === undefined ? undefined : normalizeEsPhone(phone),
                birthDate,
                gender,
                heightCm,
                weightKg,
                experienceLevel
            });

            if (!updated) {
                return res.status(404).json({ error: 'Perfil no encontrado' });
            }

            res.json({
                message: 'Perfil actualizado exitosamente',
                profile: {
                    userId: updated.user_id,
                    firstName: updated.first_name,
                    lastName: updated.last_name,
                    phone: updated.phone,
                    birthDate: updated.birth_date,
                    gender: updated.gender,
                    heightCm: updated.height_cm,
                    weightKg: updated.weight_kg,
                    experienceLevel: updated.experience_level
                }
            });
        } catch (error) {
            console.error('Error actualizando perfil:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    // Crear usuario staff (entrenador o admin) - solo para admin
    static async createStaff(req, res) {
        try {
            const {
            email,
            password,
            firstName,
            lastName,
            phone,
            birthDate,
            gender,
            heightCm,
            weightKg,
            experienceLevel,
            role = 'trainer'
            } = req.body;

            if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({
                error: 'Email, password, firstName y lastName son requeridos'
            });
            }

            // Solo permitimos crear staff (entrenador o admin)
            const finalRole = role === 'admin' ? 'admin' : 'trainer';

            const name = `${firstName} ${lastName}`.trim();

            const user = await User.create({ email, password, name, role: finalRole });

            // Crear perfil (reutilizas tu tabla user_profiles)
            await User.createProfile(user.id, {
                firstName,
                lastName,
                phone: normalizeEsPhone(phone),
                birthDate,
                gender,
                heightCm,
                weightKg,
                experienceLevel
            });

            return res.status(201).json({
            message: 'Staff creado exitosamente',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
            });
        } catch (error) {
            console.error('Error creando staff:', error);

            if (error.message === 'El usuario ya existe') {
                return res.status(409).json({ error: 'El usuario ya existe' });
            }
            if (error.message === 'El teléfono ya existe') {
                return res.status(409).json({ error: 'El teléfono ya existe' });
            }

            return res.status(500).json({ error: 'Error interno del servidor' });
        }
    }


}

module.exports = AuthController;
