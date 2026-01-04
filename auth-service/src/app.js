const express = require('express');
const cors = require('cors');
const AuthController = require('./controllers/authController');
const { authenticateToken, authorizeRoles } = require('./middleware/auth');
const pool = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

//Publicas
app.post('/register', AuthController.register);
app.post('/login', AuthController.login);

//Protegidas
app.get('/profile', authenticateToken, AuthController.getProfile);
app.post('/logout', authenticateToken, AuthController.logout); 
app.put('/profile', authenticateToken, AuthController.updateProfile);
app.post('/staff', authenticateToken, authorizeRoles('admin'), AuthController.createStaff);


// Endpoint de health para verificar el estado del servicio
app.get('/health', async (req, res) => {
  try {
    // Verificar conexión a la base de datos CORRECTAMENTE
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    
    res.status(200).json({ 
      message: 'Auth service is running!',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Auth service - Database connection failed',
      database: 'disconnected',
      error: error.message 
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Auth service - Conectado en http://0.0.0.0:${PORT}`);
});
