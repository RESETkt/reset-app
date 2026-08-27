const express = require('express');
const pool = require('../db/pool');
const { ceareAutentificare } = require('../services/auth');

const router = express.Router();
router.use(ceareAutentificare);

const TOTAL_SEDINTE = { '8': 8, '12': 12, individual: 1 };

router.post('/', async (req, res) => {
  const { pacient_id, tip } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO abonamente (pacient_id, tip, total_sedinte) VALUES ($1,$2,$3) RETURNING *`,
    [pacient_id, tip, TOTAL_SEDINTE[tip] || 1]
  );
  res.status(201).json(rows[0]);
});

router.get('/pacient/:pacientId', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM abonamente WHERE pacient_id = $1 ORDER BY creat_la DESC`,
    [req.params.pacientId]
  );
  res.json(rows);
});

router.post('/:id/plati', async (req, res) => {
  const { suma, metoda, tip_plata } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO plati (abonament_id, suma, metoda, tip_plata) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.params.id, suma, metoda, tip_plata]
  );
  res.status(201).json(rows[0]);
});

module.exports = router;
