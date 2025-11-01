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
        next();
    });
};

module.exports = { authenticateToken };