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

// Semnatura de confirmare a sedintei din ziua respectiva (nu GDPR) - marcheaza prezenta
router.post('/:programareId/confirma', async (req, res) => {
  const { semnatura_svg } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existent = await client.query(`SELECT status, abonament_id FROM programari WHERE id = $1`, [req.params.programareId]);
    const eraDejaPrezent = existent.rows[0]?.status === 'prezent';
    const prog = await client.query(
      `UPDATE programari SET status='prezent', semnatura_confirmare=$1, confirmat_la=now(), prezent_marcat_la=now() WHERE id=$2 RETURNING *`,
      [semnatura_svg, req.params.programareId]
    );
    if (!eraDejaPrezent && prog.rows[0]?.abonament_id) {
      await client.query(
        `UPDATE abonamente SET sedinte_efectuate = sedinte_efectuate + 1 WHERE id = $1`,
        [prog.rows[0].abonament_id]
      );
    }
    await client.query('COMMIT');
    res.json(prog.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ eroare: e.message });
  } finally {
    client.release();
  }
});

// Sugestii live pe masura ce se tasteaza telefonul - doar pacienti programati azi
router.get('/sugestii', async (req, res) => {
  const { prefix } = req.query;
  if (!prefix || prefix.length < 3) return res.json([]);
  const { rows } = await pool.query(
    `SELECT DISTINCT p.id, p.prenume, p.telefon
     FROM pacienti p
     JOIN programari pr ON pr.pacient_id = p.id
     WHERE pr.data_ora::date = CURRENT_DATE AND p.telefon LIKE $1
     LIMIT 8`,
    [`${prefix}%`]
  );
  res.json(rows);
});

module.exports = router;