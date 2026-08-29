const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
  // Fortam fusul orar Romania la nivel de conexiune (garantat inainte de orice query,
  // spre deosebire de a trimite SET TIME ZONE separat dupa conectare)
  options: '-c timezone=Europe/Bucharest'
});

module.exports = pool;