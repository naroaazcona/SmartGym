const jwt = require('jsonwebtoken');
const pool = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET no está definido. El servicio no puede arrancar de forma segura.');
  process.exit(1);
}
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            error: 'Token de acceso requerido' 
        });
    }

    // 1. Verificar firma y expiración del JWT
    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return res.status(403).json({ 
            error: 'Token inválido o expirado' 
        });
    }

    // 2. Verificar que el token no esté en la blacklist (logout)
    try {
        const result = await pool.query(
            'SELECT id FROM token_blacklist WHERE token = $1 AND expires_at > NOW()',
            [token]
        );
        if (result.rows.length > 0) {
            return res.status(403).json({ 
                error: 'Token inválido o expirado' 
            });
        }
    } catch (dbErr) {
        console.error('[AUTH] Error comprobando blacklist:', dbErr.message);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }

    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.user = { id: decoded.userId, role: decoded.role, email: decoded.email };
    next();
};

const authorizeRoles = (...roles) => (req, res, next) => {
  const role = req.user?.role || req.userRole;
  if (!role || !roles.includes(role)) {
    return res.status(403).json({ error: 'No tienes permisos para esta acción' });
  }
  next();
};

module.exports = { authenticateToken, authorizeRoles };