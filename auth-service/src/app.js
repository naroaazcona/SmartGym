const express = require('express');
const cors = require('cors');
const AuthController = require('./controllers/authController');
const PaymentController = require('./controllers/paymentController');
const { authenticateToken, authorizeRoles } = require('./middleware/auth');
const pool = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// El webhook de Stripe necesita el body en raw, antes del express.json()
app.post('/webhook', express.raw({ type: 'application/json' }), PaymentController.webhook);

app.use(express.json());

//Publicas
app.post('/register', AuthController.register);
app.post('/login', AuthController.login);
app.post('/password-recovery/start', AuthController.startPasswordRecovery);
app.post('/password-recovery/verify', AuthController.verifyPasswordRecovery);
app.post('/password-recovery/reset', AuthController.resetPassword);

//Protegidas
app.get('/profile', authenticateToken, AuthController.getProfile);
app.post('/logout', authenticateToken, AuthController.logout); 
app.put('/profile', authenticateToken, AuthController.updateProfile);
app.post('/staff', authenticateToken, authorizeRoles('admin'), AuthController.createStaff);
app.get('/users', authenticateToken, authorizeRoles('admin'), AuthController.listByRole);
app.get('/users/basic', authenticateToken, authorizeRoles('admin', 'trainer'), AuthController.listBasicUsers);

//Rutas de pago
app.post('/subscription/checkout', authenticateToken, PaymentController.createCheckoutSession);
app.get('/subscription/me', authenticateToken, PaymentController.getSubscription);



// Endpoint de health para verificar el estado del servicio
app.get('/health', async (req, res) => {
  try {
    // Verificar conexión a la base de datos CORRECTAMENTE
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    
    res.status(200).json({ 
      message: 'Auth service esta funcionando!',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Auth service - Conexión a la base de datos fallida',
      database: 'disconnected',
      error: error.message 
    });
  }
});

// Limpieza periódica de registros expirados en BD
// Se ejecuta al arrancar y luego cada hora para evitar que las tablas crezcan indefinidamente
async function cleanupExpiredRecords() {
  try {
    const now = new Date().toISOString();

    const blacklist = await pool.query(
      'DELETE FROM token_blacklist WHERE expires_at < $1', [now]
    );
    const sessions = await pool.query(
      'DELETE FROM sessions WHERE expires_at < $1', [now]
    );
    const recovery = await pool.query(
      'DELETE FROM password_recovery_requests WHERE code_expires_at < $1 AND verified_at IS NULL', [now]
    );

    const total = blacklist.rowCount + sessions.rowCount + recovery.rowCount;
    if (total > 0) {
      console.log(`🧹 Limpieza BD: ${blacklist.rowCount} tokens blacklist, ${sessions.rowCount} sesiones, ${recovery.rowCount} recuperaciones expiradas eliminadas.`);
    }
  } catch (err) {
    console.error('⚠️  Error en limpieza de registros expirados:', err.message);
  }
}

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hora
cleanupExpiredRecords();
setInterval(cleanupExpiredRecords, CLEANUP_INTERVAL_MS);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Auth service - Conectado en http://0.0.0.0:${PORT}`);
});
