const express = require('express');
const pool = require('../db/pool');
const { ceareAutentificare } = require('../services/auth');

const router = express.Router();
router.use(ceareAutentificare);

// Lista completa: nerezolvate primele (cele mai noi sus), apoi rezolvate (istoric)
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT n.*, cu.nume AS creat_de_nume, ru.nume AS rezolvat_de_nume,
            pac.nume AS pacient_nume, pac.prenume AS pacient_prenume
     FROM notificari_echipa n
     LEFT JOIN utilizatori cu ON cu.id = n.creat_de
     LEFT JOIN utilizatori ru ON ru.id = n.rezolvat_de
     LEFT JOIN pacienti pac ON pac.id = n.pacient_id
     ORDER BY n.rezolvat ASC, n.creat_la DESC
     LIMIT 300`
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const text = (req.body.text || '').trim();
  if (!text) return res.status(400).json({ eroare: 'Scrie ceva mai intai.' });
  const { rows } = await pool.query(
    `INSERT INTO notificari_echipa (tip, text, creat_de) VALUES ('manual', $1, $2) RETURNING *`,
    [text, req.user.id]
  );
  res.status(201).json(rows[0]);
});

router.patch('/:id/rezolva', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE notificari_echipa SET rezolvat = true, rezolvat_de = $1, rezolvat_la = now() WHERE id = $2 RETURNING *`,
    [req.user.id, req.params.id]
  );
  res.json(rows[0]);
});

router.patch('/:id/redeschide', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE notificari_echipa SET rezolvat = false, rezolvat_de = NULL, rezolvat_la = NULL WHERE id = $1 RETURNING *`,
    [req.params.id]
  );
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query(`DELETE FROM notificari_echipa WHERE id = $1`, [req.params.id]);
  res.json({ sters: true });
});

module.exports = router;
