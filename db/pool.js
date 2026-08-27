const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')
    ? { rejectUnauthorized: false }
    : false
});

// Fortam fusul orar Romania pe fiecare conexiune, ca orele introduse
// (ex 07:30) sa fie salvate si afisate exact asa, fara deplasare.
pool.on('connect', (client) => {
  client.query("SET TIME ZONE 'Europe/Bucharest'");
});

module.exports = pool;