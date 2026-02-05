const fs = require('fs');
const path = require('path');
const pool = require('./db');

console.log('Iniciando inicialización de la base de datos (gym-service)...');

async function initializeDatabase() {
  let client;
  try {
    console.log('Conectando a PostgreSQL...');
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
  } catch (error) {
    console.error('Error inicializando la base de datos:', error.message);

    // Debug similar al auth-service
    try {
      const files = fs.readdirSync(__dirname);
      console.log('Archivos en database/:', files);
    } catch (e) {
      console.log('No se pudo leer el directorio database/');
    }
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase;
