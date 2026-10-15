const express = require('express');
const pool = require('../db/pool');
const { ceareAutentificare } = require('../services/auth');

// Evaluarile functionale. Crearea se face prin /api/pacienti/:id/evaluari (vezi patients.js),
// restul aici: salvarea automata din timpul evaluarii nu trebuie sa anunte live toata echipa
// la fiecare tap, de aceea /api/evaluari e exclus din anuntul SSE din server.js.
const router = express.Router();
router.use(ceareAutentificare);

const RECOMANDARI = ['kineto', 'stick', 'move', 'nimic'];

// ---------- Planul de lucru (telefon): ultima evaluare + ce s-a notat la ultima sedinta ----------

const PLAN_CAMPURI = `
  pac.id AS pacient_id, pac.nume, pac.prenume, pac.diagnostic,
  ev.id AS evaluare_id, to_char(ev.data, 'YYYY-MM-DD') AS evaluare_data, ev.date AS evaluare_date,
  to_char(ult.data_ora, 'YYYY-MM-DD') AS ultima_data, ult.exercitii AS ultima_exercitii, ult.plan_viitor AS ultima_plan`;

// Ultima evaluare a pacientului
const PLAN_EVALUARE = `
  LEFT JOIN LATERAL (
    SELECT e.id, e.data, e.date FROM evaluari e WHERE e.pacient_id = pac.id ORDER BY e.data DESC, e.creat_la DESC LIMIT 1
  ) ev ON true`;

// Ultima sedinta cu prezenta, inainte de ziua data ($1)
const PLAN_ULTIMA = `
  LEFT JOIN LATERAL (
    SELECT data_ora, exercitii, plan_viitor FROM programari
    WHERE pacient_id = pac.id AND status = 'prezent' AND data_ora::date < $1::date
    ORDER BY data_ora DESC LIMIT 1
  ) ult ON true`;

function formaPlan(r) {
  return {
    programare_id: r.programare_id || null,
    ora: r.ora || null,
    status: r.status || null,
    pacient: { id: r.pacient_id, nume: r.nume, prenume: r.prenume, diagnostic: r.diagnostic },
    evaluare: r.evaluare_id ? { id: r.evaluare_id, data: r.evaluare_data, date: r.evaluare_date } : null,
    ultima: r.ultima_data ? { data: r.ultima_data, exercitii: r.ultima_exercitii, plan_viitor: r.ultima_plan } : null,
  };
}

function dataCurata(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : new Date().toISOString().slice(0, 10);
}

// Pacientii programati intr-o zi (implicit azi), cu planul lor
router.get('/plan/azi', async (req, res) => {
  const data = dataCurata(req.query.data);
  const { rows } = await pool.query(
    `SELECT pr.id AS programare_id, to_char(pr.data_ora, 'HH24:MI') AS ora, pr.status, ${PLAN_CAMPURI}
     FROM programari pr
     JOIN pacienti pac ON pac.id = pr.pacient_id
     ${PLAN_EVALUARE}
     ${PLAN_ULTIMA}
     WHERE pr.data_ora::date = $1::date AND pr.status <> 'absent'
     ORDER BY pr.data_ora`,
    [data]
  );
  res.json(rows.map(formaPlan));
});

// Planul unui singur pacient (gasit prin cautare), cu ce s-a notat la ultima lui sedinta
router.get('/plan/pacient/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${PLAN_CAMPURI} FROM pacienti pac
     ${PLAN_EVALUARE}
     ${PLAN_ULTIMA.replace('$1::date', "(CURRENT_DATE + 1)")}
     WHERE pac.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ eroare: 'Pacient inexistent' });
  res.json(formaPlan(rows[0]));
});

// Planul pacientului unei programari (pentru formularul de prezenta)
router.get('/plan/programare/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT pr.id AS programare_id, to_char(pr.data_ora, 'HH24:MI') AS ora, pr.status, ${PLAN_CAMPURI}
     FROM programari pr
     JOIN pacienti pac ON pac.id = pr.pacient_id
     ${PLAN_EVALUARE}
     ${PLAN_ULTIMA.replace('$1::date', 'pr.data_ora::date')}
     WHERE pr.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ eroare: 'Programare inexistenta' });
  res.json(formaPlan(rows[0]));
});

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
