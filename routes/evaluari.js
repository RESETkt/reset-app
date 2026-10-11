const express = require('express');
const pool = require('../db/pool');
const { ceareAutentificare } = require('../services/auth');

// Evaluarile functionale. Crearea se face prin /api/pacienti/:id/evaluari (vezi patients.js),
// restul aici: salvarea automata din timpul evaluarii nu trebuie sa anunte live toata echipa
// la fiecare tap, de aceea /api/evaluari e exclus din anuntul SSE din server.js.
const router = express.Router();
router.use(ceareAutentificare);

const RECOMANDARI = ['kineto', 'stick', 'move', 'nimic'];

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT e.*, to_char(e.data, 'YYYY-MM-DD') AS data, u.nume AS kineto FROM evaluari e LEFT JOIN utilizatori u ON u.id = e.creat_de WHERE e.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ eroare: 'Evaluare inexistenta' });
  res.json(rows[0]);
});

router.patch('/:id', async (req, res) => {
  const { data, date, poze, recomandare } = req.body;
  if (date !== undefined && (typeof date !== 'object' || date === null || Array.isArray(date))) {
    return res.status(400).json({ eroare: 'Date invalide.' });
  }
  if (poze !== undefined && (typeof poze !== 'object' || poze === null || Array.isArray(poze))) {
    return res.status(400).json({ eroare: 'Poze invalide.' });
  }
  if (recomandare !== undefined && recomandare !== null && !RECOMANDARI.includes(recomandare)) {
    return res.status(400).json({ eroare: 'Recomandare invalida.' });
  }
  const { rows } = await pool.query(
    `UPDATE evaluari SET
       data = COALESCE($1::date, data),
       date = COALESCE($2::jsonb, date),
       poze = COALESCE($3::jsonb, poze),
       recomandare = CASE WHEN $4::boolean THEN $5::text ELSE recomandare END,
       actualizat_la = now()
     WHERE id = $6 RETURNING id, actualizat_la`,
    [data || null, date === undefined ? null : JSON.stringify(date), poze === undefined ? null : JSON.stringify(poze),
     recomandare !== undefined, recomandare ?? null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ eroare: 'Evaluare inexistenta' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM evaluari WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
