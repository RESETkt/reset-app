const express = require('express');
const pool = require('../db/pool');
const { ceareAutentificare } = require('../services/auth');

const router = express.Router();
router.use(ceareAutentificare);

function asincron(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function esteWeekend(data_ora) {
  const dataParte = data_ora.slice(0, 10);
  const zi = new Date(dataParte + 'T00:00:00').getDay();
  return zi === 0 || zi === 6;
}

// Discutiile dintr-un interval (implicit azi), pentru calendar
router.get('/', asincron(async (req, res) => {
  const { de_la, pana_la } = req.query;
  const start = de_la || new Date().toISOString().slice(0, 10);
  const end = pana_la || start;
  const { rows } = await pool.query(
    `SELECT * FROM discutii WHERE data_ora::date BETWEEN $1 AND $2 ORDER BY data_ora`,
    [start, end]
  );
  res.json(rows);
}));

router.post('/', asincron(async (req, res) => {
  const { prenume, telefon, notite, data_ora } = req.body;
  if (!prenume || !data_ora) {
    return res.status(400).json({ eroare: 'Prenumele si data sunt obligatorii.' });
  }
  if (esteWeekend(data_ora)) {
    return res.status(400).json({ eroare: 'Nu se pot face programari sambata sau duminica.' });
  }
  const { rows } = await pool.query(
    `INSERT INTO discutii (prenume, telefon, notite, data_ora) VALUES ($1,$2,$3,$4) RETURNING *`,
    [prenume, telefon || null, notite || null, data_ora]
  );
  res.status(201).json(rows[0]);
}));

router.patch('/:id', asincron(async (req, res) => {
  const { prenume, telefon, notite, data_ora } = req.body;
  if (!prenume || !data_ora) {
    return res.status(400).json({ eroare: 'Prenumele si data sunt obligatorii.' });
  }
  if (esteWeekend(data_ora)) {
    return res.status(400).json({ eroare: 'Nu se pot face programari sambata sau duminica.' });
  }
  const { rows } = await pool.query(
    `UPDATE discutii SET prenume=$1, telefon=$2, notite=$3, data_ora=$4 WHERE id=$5 RETURNING *`,
    [prenume, telefon || null, notite || null, data_ora, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ eroare: 'Discutia nu exista.' });
  res.json(rows[0]);
}));

router.delete('/:id', asincron(async (req, res) => {
  await pool.query('DELETE FROM discutii WHERE id = $1', [req.params.id]);
  res.json({ sters: true });
}));

router.use((err, req, res, next) => {
  console.error('Eroare in rutele de discutii:', err.message);
  res.status(500).json({ eroare: 'A esuat operatia pe discutie: ' + err.message });
});

module.exports = router;
