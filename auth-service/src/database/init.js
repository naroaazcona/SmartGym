const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

console.log('Iniciando inicialización de la base de datos...');

const pool = new Pool({
  user: 'admin',
  host: 'auth-db',
  database: 'auth_db',
  password: 'password',
  port: 5432,
});

async function initializeDatabase() {
  let client;
  try {
    console.log('Conectando a PostgreSQL...');
    client = await pool.connect();
    
    // Verificar si init.sql existe
    const initSqlPath = path.join(__dirname, 'init.sql');
    if (!fs.existsSync(initSqlPath)) {
      throw new Error('init.sql no encontrado en: ' + initSqlPath);
    }
    
    // Leer y ejecutar el archivo init.sql
    console.log('Leyendo init.sql...');
    const sqlScript = fs.readFileSync(initSqlPath, 'utf8');
    
    console.log('Ejecutando script SQL...');
    await client.query(sqlScript);
    
    console.log('Base de datos inicializada correctamente desde init.sql!');

  } catch (error) {
    console.error('Error inicializando la base de datos:', error.message);
    
    // Mostrar archivos en el directorio para debug
    try {
      const files = fs.readdirSync(__dirname);
      console.log('Archivos en database/:', files);
    } catch (e) {
      console.log('No se pudo leer el directorio database/');
    }
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Ejecutar solo si es el script principal
if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase;