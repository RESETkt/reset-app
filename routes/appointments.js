const express = require('express');
const pool = require('../db/pool');
const { ceareAutentificare } = require('../services/auth');

const router = express.Router();
router.use(ceareAutentificare);

// Programarile dintr-un interval (implicit azi), pentru calendar
router.get('/', async (req, res) => {
  const { de_la, pana_la } = req.query;
  const start = de_la || new Date().toISOString().slice(0, 10);
  const end = pana_la || start;
  const { rows } = await pool.query(
    `SELECT p.*, pac.nume, pac.prenume, pac.diagnostic, u.nume AS kineto_nume,
            ab.total_sedinte, ab.sedinte_efectuate
     FROM programari p
     JOIN pacienti pac ON pac.id = p.pacient_id
     LEFT JOIN utilizatori u ON u.id = p.kineto_id
     LEFT JOIN LATERAL (
       SELECT total_sedinte, sedinte_efectuate FROM abonamente
       WHERE pacient_id = p.pacient_id AND activ = true
       ORDER BY creat_la DESC LIMIT 1
     ) ab ON true
     WHERE p.data_ora::date BETWEEN $1 AND $2
     ORDER BY p.data_ora`,
    [start, end]
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { pacient_id, kineto_id, data_ora } = req.body;
  let abonament_id = req.body.abonament_id || null;

  if (!abonament_id) {
    const activ = await pool.query(
      `SELECT id FROM abonamente WHERE pacient_id = $1 AND activ = true ORDER BY creat_la DESC LIMIT 1`,
      [pacient_id]
    );
    abonament_id = activ.rows[0]?.id || null;
  }

  const { rows } = await pool.query(
    `INSERT INTO programari (pacient_id, kineto_id, abonament_id, data_ora) VALUES ($1,$2,$3,$4) RETURNING *`,
    [pacient_id, kineto_id, abonament_id, data_ora]
  );
  res.status(201).json(rows[0]);
});

// Marcheaza prezenta: incrementeaza sedintele efectuate din abonament (o singura data) si salveaza exercitii/observatii
router.patch('/:id/prezent', async (req, res) => {
  const { exercitii, observatii } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existent = await client.query(`SELECT status, abonament_id FROM programari WHERE id = $1`, [req.params.id]);
    const eraDejaPrezent = existent.rows[0]?.status === 'prezent';
    const prog = await client.query(
      `UPDATE programari SET status='prezent', exercitii=$1, observatii=$2, prezent_marcat_la=now() WHERE id=$3 RETURNING *`,
      [exercitii, observatii, req.params.id]
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

router.patch('/:id/absent', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE programari SET status='absent' WHERE id=$1 RETURNING *`,
    [req.params.id]
  );
  res.json(rows[0]);
});

router.patch('/:id/reprogrameaza', async (req, res) => {
  const { data_ora_noua } = req.body;
  const { rows } = await pool.query(
    `UPDATE programari SET status='reprogramat', data_ora=$1 WHERE id=$2 RETURNING *`,
    [data_ora_noua, req.params.id]
  );
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query(`DELETE FROM programari WHERE id = $1`, [req.params.id]);
  res.json({ sters: true });
});

// Semnatura de pe tableta la intrarea in sedinta (nu e GDPR, doar confirmare prezenta)
router.post('/:id/confirma-tableta', async (req, res) => {
  const { semnatura_svg } = req.body;
  const { rows } = await pool.query(
    `UPDATE programari SET semnatura_confirmare=$1, confirmat_la=now() WHERE id=$2 RETURNING *`,
    [semnatura_svg, req.params.id]
  );
  res.json(rows[0]);
});

module.exports = router;