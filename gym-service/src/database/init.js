const fs = require('fs');
const path = require('path');
const pool = require('./db');

console.log('Iniciando la base de datos (gym-service)...');

async function initializeDatabase() {
  let client;
  const maxRetries = 10;
  const retryDelay = 3000;

  for (let i = 1; i <= maxRetries; i++) {
    try {
      console.log(`Conectando a PostgreSQL... (intento ${i}/${maxRetries})`);
      client = await pool.connect();

      const initSqlPath = path.join(__dirname, 'init.sql');
      if (!fs.existsSync(initSqlPath)) {
        throw new Error('init.sql no encontrado en: ' + initSqlPath);
      }

      console.log('Leyendo init.sql...');
      const sqlScript = fs.readFileSync(initSqlPath, 'utf8');

      console.log('Ejecutando script SQL...');
      await client.query(sqlScript);

      console.log('Base de datos inicializada correctamente desde init.sql!');
      break;

    } catch (error) {
      console.error(`Error en intento ${i}:`, error.message);
      if (client) { client.release(); client = null; }
      if (i < maxRetries) {
        console.log(`Reintentando en ${retryDelay / 1000}s...`);
        await new Promise(res => setTimeout(res, retryDelay));
      } else {
        console.error('No se pudo inicializar la base de datos tras varios intentos.');
      }
    }
  }

  if (client) client.release();
  await pool.end();
}

if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase;