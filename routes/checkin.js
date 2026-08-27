const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// Cauta pacientul dupa telefon si returneaza programarea de azi + sedinte ramase
router.get('/', async (req, res) => {
  const { telefon } = req.query;
  if (!telefon) return res.status(400).json({ eroare: 'Telefon lipsa' });

  const pacient = await pool.query('SELECT * FROM pacienti WHERE telefon = $1', [telefon]);
  if (!pacient.rows[0]) return res.status(404).json({ eroare: 'Nu am gasit niciun pacient cu acest telefon' });
  const p = pacient.rows[0];

  const programare = await pool.query(
    `SELECT * FROM programari WHERE pacient_id = $1 AND data_ora::date = CURRENT_DATE
     ORDER BY data_ora LIMIT 1`,
    [p.id]
  );
  const abonament = await pool.query(
    `SELECT * FROM abonamente WHERE pacient_id = $1 AND activ = true ORDER BY creat_la DESC LIMIT 1`,
    [p.id]
  );
  const gdpr = await pool.query('SELECT id FROM consimtaminte_gdpr WHERE pacient_id = $1', [p.id]);

  res.json({
    pacient: { id: p.id, prenume: p.prenume },
    programare: programare.rows[0] || null,
    abonament: abonament.rows[0] || null,
    gdpr_semnat: gdpr.rows.length > 0
  });
});

// Semnatura de confirmare a sedintei din ziua respectiva (nu GDPR)
router.post('/:programareId/confirma', async (req, res) => {
  const { semnatura_svg } = req.body;
  const { rows } = await pool.query(
    `UPDATE programari SET semnatura_confirmare=$1, confirmat_la=now() WHERE id=$2 RETURNING *`,
    [semnatura_svg, req.params.programareId]
  );
  res.json(rows[0]);
});

module.exports = router;
