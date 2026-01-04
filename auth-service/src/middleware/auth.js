const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'smartgym_secret_key_2024_tfg';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ 
            error: 'Token de acceso requerido' 
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ 
                error: 'Token inválido o expirado' 
            });
        }
        
        req.userId = decoded.userId;
        req.userRole = decoded.role;

        req.user = { id: decoded.userId, role: decoded.role, email: decoded.email };
        next();
    });
};

const authorizeRoles = (...roles) => (req, res, next) => {
  const role = req.user?.role || req.userRole;
  if (!role || !roles.includes(role)) {
    return res.status(403).json({ error: 'No tienes permisos para esta acción' });
  }
  next();
};

module.exports = { authenticateToken, authorizeRoles };