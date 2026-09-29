const express = require('express');
const pool = require('../db/pool');
const { ceareAutentificare } = require('../services/auth');

const router = express.Router();
router.use(ceareAutentificare);

const TOTAL_SEDINTE = { '8': 8, '12': 12, functional: 8, individual: 1 };

// Prinde orice eroare dintr-un handler async si raspunde cu JSON, in loc sa lase cererea
// agatata la infinit fara niciun raspuns (Express 4 nu prinde singur promisiuni respinse).
function asincron(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

router.post('/', asincron(async (req, res) => {
  const { pacient_id, tip, sedinte_efectuate } = req.body;
  if (!pacient_id || !TOTAL_SEDINTE[tip]) {
    return res.status(400).json({ eroare: 'Pacientul si un tip de abonament valid sunt obligatorii.' });
  }
  const totalSedinte = TOTAL_SEDINTE[tip];
  // Optional: pacientul avea deja sedinte facute inainte sa existe abonamentul (ex: istoric
  // de exercitii fara abonament asociat la vremea aceea) - le scadem din start, nu de la 0.
  const efectuateInitial = Math.min(Math.max(parseInt(sedinte_efectuate, 10) || 0, 0), totalSedinte);
  await pool.query(`UPDATE abonamente SET activ = false WHERE pacient_id = $1`, [pacient_id]);
  const { rows } = await pool.query(
    `INSERT INTO abonamente (pacient_id, tip, total_sedinte, sedinte_efectuate) VALUES ($1,$2,$3,$4) RETURNING *`,
    [pacient_id, tip, totalSedinte, efectuateInitial]
  );
  res.status(201).json(rows[0]);
}));

router.get('/pacient/:pacientId', asincron(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM abonamente WHERE pacient_id = $1 ORDER BY creat_la DESC`,
    [req.params.pacientId]
  );
  res.json(rows);
}));

router.post('/:id/plati', asincron(async (req, res) => {
  const { suma, metoda, tip_plata } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO plati (abonament_id, suma, metoda, tip_plata) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.params.id, suma, metoda, tip_plata]
  );
  res.status(201).json(rows[0]);
}));

router.use((err, req, res, next) => {
  console.error('Eroare in rutele de abonamente:', err.message);
  res.status(500).json({ eroare: 'A esuat operatia pe abonament: ' + err.message });
});

module.exports = router;