const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_USER = process.env.DB_USER || "admin";
const DB_HOST = process.env.DB_HOST || "127.0.0.1";   // <- mejor que localhost en Windows
const DB_NAME = process.env.DB_NAME || "auth_db";
const DB_PASSWORD = process.env.DB_PASSWORD || "password";
const DB_PORT = process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432;

const pool = new Pool({
  user: DB_USER,
  host: DB_HOST,
  database: DB_NAME,
  password: DB_PASSWORD,
  port: DB_PORT,
  retryDelay: 3000,
  retryTimeout: 30000
});

pool.on("error", (err) => {
  console.error("❌ Unexpected PG pool error:", err.message);
});

async function initializeDatabase() {
  let client;
  try {
    console.log('Conectando a la base de datos en ${DB_HOST}:${DB_PORT}/${DB_NAME}...');
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
    if (require.main === module) {
      await pool.end();
    }
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