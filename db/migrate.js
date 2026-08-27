require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function migreaza() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Schema a fost aplicata cu succes.');
  await pool.end();
}

migreaza().catch((e) => {
  console.error('Eroare la migrare:', e.message);
  process.exit(1);
});
