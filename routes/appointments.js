const express = require('express');
const pool = require('../db/pool');
const { ceareAutentificare } = require('../services/auth');

const router = express.Router();
router.use(ceareAutentificare);

// Verifica daca data (YYYY-MM-DD sau YYYY-MM-DD HH:MM:SS) cade sambata sau duminica
function esteWeekend(data_ora) {
  const dataParte = data_ora.slice(0, 10);
  const zi = new Date(dataParte + 'T00:00:00').getDay();
  return zi === 0 || zi === 6;
}

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
  if (esteWeekend(data_ora)) {
    return res.status(400).json({ eroare: 'Nu se pot face programari sambata sau duminica.' });
  }
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

// Marcheaza prezenta: incrementeaza sedintele efectuate din abonament si salveaza exercitii/observatii
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

// Adauga retroactiv o sedinta uitata (nu exista programare pentru ea) - fisa pacientului > istoric
router.post('/sedinta-trecuta', async (req, res) => {
  const { pacient_id, kineto_id, data_ora, exercitii, observatii } = req.body;
  if (!pacient_id || !data_ora) {
    return res.status(400).json({ eroare: 'Pacientul si data sunt obligatorii.' });
  }
  if (esteWeekend(data_ora)) {
    return res.status(400).json({ eroare: 'Nu se pot inregistra sedinte sambata sau duminica.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const activ = await client.query(
      `SELECT id FROM abonamente WHERE pacient_id = $1 AND activ = true ORDER BY creat_la DESC LIMIT 1`,
      [pacient_id]
    );
    const abonament_id = activ.rows[0]?.id || null;
    const prog = await client.query(
      `INSERT INTO programari (pacient_id, kineto_id, abonament_id, data_ora, status, exercitii, observatii, prezent_marcat_la)
       VALUES ($1,$2,$3,$4,'prezent',$5,$6,now()) RETURNING *`,
      [pacient_id, kineto_id || null, abonament_id, data_ora, exercitii || null, observatii || null]
    );
    if (abonament_id) {
      await client.query(`UPDATE abonamente SET sedinte_efectuate = sedinte_efectuate + 1 WHERE id = $1`, [abonament_id]);
    }
    await client.query('COMMIT');
    res.status(201).json(prog.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ eroare: e.message });
  } finally {
    client.release();
  }
});

// Editeaza retroactiv exercitiile/observatiile unei sedinte deja marcate prezenta - fisa pacientului > istoric
router.patch('/:id/editeaza-istoric', async (req, res) => {
  const { exercitii, observatii } = req.body;
  const { rows } = await pool.query(
    `UPDATE programari SET exercitii=$1, observatii=$2 WHERE id=$3 AND status='prezent' RETURNING *`,
    [exercitii || null, observatii || null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ eroare: 'Sedinta inexistenta.' });
  res.json(rows[0]);
});

router.patch('/:id/absent', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE programari SET status='absent' WHERE id=$1 RETURNING *`,
    [req.params.id]
  );
  res.json(rows[0]);
});

function formateazaDataOra(data_ora) {
  return new Date(data_ora).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

router.patch('/:id/reprogrameaza', async (req, res) => {
  const { data_ora_noua } = req.body;
  if (esteWeekend(data_ora_noua)) {
    return res.status(400).json({ eroare: 'Nu se pot face programari sambata sau duminica.' });
  }
  const vechi = await pool.query(
    `SELECT p.data_ora, p.pacient_id, pac.nume, pac.prenume
     FROM programari p JOIN pacienti pac ON pac.id = p.pacient_id
     WHERE p.id = $1`,
    [req.params.id]
  );
  const { rows } = await pool.query(
    `UPDATE programari SET status='reprogramat', data_ora=$1 WHERE id=$2 RETURNING *`,
    [data_ora_noua, req.params.id]
  );
  if (vechi.rows[0]) {
    const v = vechi.rows[0];
    const text = `${v.nume} ${v.prenume}: programare mutata din ${formateazaDataOra(v.data_ora)} in ${formateazaDataOra(data_ora_noua)}`;
    await pool.query(
      `INSERT INTO notificari_echipa (tip, text, pacient_id, creat_de) VALUES ('reprogramare', $1, $2, $3)`,
      [text, v.pacient_id, req.user.id]
    );
  }
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