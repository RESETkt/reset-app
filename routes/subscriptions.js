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

// Corectie manuala a unui abonament: tip, total de sedinte, sedinte efectuate, activ/incheiat
router.patch('/:id', asincron(async (req, res) => {
  const { tip, total_sedinte, sedinte_efectuate, activ } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existent = await client.query(`SELECT * FROM abonamente WHERE id = $1`, [req.params.id]);
    const ab = existent.rows[0];
    if (!ab) {
      await client.query('ROLLBACK');
      return res.status(404).json({ eroare: 'Abonamentul nu exista.' });
    }
    const tipNou = tip || ab.tip;
    const total = total_sedinte === undefined ? ab.total_sedinte : parseInt(total_sedinte, 10);
    const efectuate = sedinte_efectuate === undefined ? ab.sedinte_efectuate : parseInt(sedinte_efectuate, 10);
    const activNou = activ === undefined ? ab.activ : !!activ;
    if (!TOTAL_SEDINTE[tipNou] || !Number.isInteger(total) || total < 1 || !Number.isInteger(efectuate) || efectuate < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ eroare: 'Tipul, totalul de sedinte (minim 1) si sedintele efectuate (minim 0) trebuie sa fie valide.' });
    }
    if (efectuate > total) {
      await client.query('ROLLBACK');
      return res.status(400).json({ eroare: 'Sedintele efectuate nu pot depasi totalul abonamentului.' });
    }
    if (activNou && !ab.activ) {
      await client.query(`UPDATE abonamente SET activ = false WHERE pacient_id = $1 AND id != $2`, [ab.pacient_id, ab.id]);
    }
    const { rows } = await client.query(
      `UPDATE abonamente SET tip=$1, total_sedinte=$2, sedinte_efectuate=$3, activ=$4 WHERE id=$5 RETURNING *`,
      [tipNou, total, efectuate, activNou, ab.id]
    );
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

// Sterge un abonament. Sedintele deja facute raman in istoricul pacientului, doar ca nu mai sunt
// legate de niciun abonament (se pot muta ulterior pe altul din "Istoric sedinte").
router.delete('/:id', asincron(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE programari SET abonament_id = NULL WHERE abonament_id = $1`, [req.params.id]);
    const sters = await client.query(`DELETE FROM abonamente WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!sters.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ eroare: 'Abonamentul nu exista.' });
    }
    await client.query('COMMIT');
    res.json({ sters: true });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
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