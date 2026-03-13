const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'admin',
  host: process.env.DB_HOST || 'gym-db',
  database: process.env.DB_NAME || 'gym_db',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
  retryDelay: 3000,
  retryTimeout: 30000
});

module.exports = pool;