const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET no está definido. El servicio no puede arrancar de forma segura.');
  process.exit(1);
}
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.userId, role: decoded.role, email: decoded.email };
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
};

const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'No tienes permisos para esta acción' });
  }
  next();
};

// Middleware adicional para verificar suscripción activa
const requireSubscription = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    const response = await fetch(`${process.env.AUTH_URL}/subscription/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return res.status(403).json({
        error: 'No tienes una suscripción activa para reservar clases.',
      });
    }

    const data = await response.json();

    if (data?.subscription?.status !== 'active') {
      return res.status(403).json({
        error: 'No tienes una suscripción activa para reservar clases.',
      });
    }

    next();
  } catch (err) {
    console.error('[requireSubscription] Error consultando auth-service:', err.message);
    // Si auth-service no responde, bloqueamos por seguridad
    return res.status(503).json({
      error: 'No se pudo verificar la suscripción. Inténtalo de nuevo.',
    });
  }
};

module.exports = { authenticateToken, authorizeRoles, requireSubscription };
