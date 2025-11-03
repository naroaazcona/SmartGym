const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'smartgym_secret_key_2024_tfg';
const JWT_EXPIRES_IN = '24h';

class AuthController {
    static async register(req, res) {
        try {
            const { email, password, name, role = 'member' } = req.body;

            if (!email || !password || !name) {
                return res.status(400).json({ 
                    error: 'Email, password y name son requeridos' 
                });
            }

            if (password.length < 6) {
                return res.status(400).json({ 
                    error: 'La contraseña debe tener al menos 6 caracteres' 
                });
            }

            // Crear usuario
            const user = await User.create({ email, password, name, role });
            
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
                    role: user.role
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
            
            res.status(500).json({ 
                error: 'Error interno del servidor' 
            });
        }
    }

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

    static async getProfile(req, res) {
        try {
            const user = await User.findById(req.userId);
            
            if (!user) {
                return res.status(404).json({ 
                    error: 'Usuario no encontrado' 
                });
            }

            res.json({ user });
        } catch (error) {
            console.error('Error obteniendo perfil:', error);
            res.status(500).json({ 
                error: 'Error interno del servidor' 
            });
        }
    }

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
}

module.exports = AuthController;