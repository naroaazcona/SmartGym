const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  user: 'admin',
  host: 'auth-db',
  database: 'auth_db',
  password: 'password',
  port: 5432,
  retryDelay: 3000,
  retryTimeout: 30000
});

async function initializeDatabase() {
  let client;
  try {
    console.log('Conectando a la base de datos...');
    client = await pool.connect();
    
    const sqlScript = fs.readFileSync(
      path.join(__dirname, 'init.sql'), 
      'utf8'
    );

    console.log('Ejecutando script de inicialización...');
    await client.query(sqlScript);
    
    console.log('Base de datos inicializada correctamente');
    
  } catch (error) {
    console.error('Error inicializando la base de datos:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Solo ejecutar si es el script principal
if (require.main === module) {
  initializeDatabase();
}

// Exportar el pool para que otros módulos (models, app, etc.) puedan usarlo
// Muchos módulos en el proyecto hacen `require('../database/db')` esperando
// un objeto pool con método `query`.
module.exports = pool;