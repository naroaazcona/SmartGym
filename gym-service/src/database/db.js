const { Pool } = require('pg');

const pool = new Pool({
  user: 'admin',
  host: 'gym-db',
  database: 'gym_db',
  password: 'password',
  port: 5432,
  retryDelay: 3000,
  retryTimeout: 30000
});

module.exports = pool;
