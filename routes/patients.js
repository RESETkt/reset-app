const express = require('express');
const pool = require('../db/pool');
const { ceareAutentificare } = require('../services/auth');

const router = express.Router();
router.use(ceareAutentificare);

// Lista pacienti (cautare optionala prin ?q=, sau ?arhivati=1 pentru cei arhivati)
router.get('/', async (req, res) => {
  const { q, arhivati } = req.query;
  const activFiltru = arhivati === '1' ? false : true;
  const { rows } = q
    ? await pool.query(
        `SELECT id, nume, prenume, telefon, email, diagnostic FROM pacienti
         WHERE activ = $2 AND (nume ILIKE $1 OR prenume ILIKE $1) ORDER BY nume`,
        [`%${q}%`, activFiltru]
      )
    : await pool.query('SELECT id, nume, prenume, telefon, email, diagnostic FROM pacienti WHERE activ = $1 ORDER BY nume', [activFiltru]);
  res.json(rows);
});

// Fisa completa a unui pacient: date, abonament activ, ultima sedinta
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const pacient = await pool.query('SELECT * FROM pacienti WHERE id = $1', [id]);
  if (!pacient.rows[0]) return res.status(404).json({ eroare: 'Pacient inexistent' });

  const abonament = await pool.query(
    `SELECT * FROM abonamente WHERE pacient_id = $1 AND activ = true ORDER BY creat_la DESC LIMIT 1`,
    [id]
  );
  const ultimaSedinta = await pool.query(
    `SELECT data_ora, exercitii, observatii FROM programari
     WHERE pacient_id = $1 AND status = 'prezent' ORDER BY data_ora DESC LIMIT 1`,
    [id]
  );
  const consimtamant = await pool.query(
    `SELECT id, data_semnare FROM consimtaminte_gdpr WHERE pacient_id = $1 LIMIT 1`,
    [id]
  );
  const plati = await pool.query(
    `SELECT id, suma, metoda, tip_plata, motiv, data_plata FROM plati
     WHERE pacient_id = $1 ORDER BY data_plata DESC`,
    [id]
  );

  res.json({
    pacient: pacient.rows[0],
    abonament: abonament.rows[0] || null,
    ultima_sedinta: ultimaSedinta.rows[0] || null,
    gdpr_semnat: consimtamant.rows.length > 0,
    plati: plati.rows
  });
});

// Adauga o plata noua pentru un pacient - abonament nou, sedinta, sau orice suma
router.post('/:id/plati', async (req, res) => {
  const { suma, metoda, tip_plata, motiv, data_plata } = req.body;
  if (!suma || !metoda || !tip_plata) {
    return res.status(400).json({ eroare: 'Suma, metoda si tipul de plata sunt obligatorii.' });
  }
  const { rows } = await pool.query(
    `INSERT INTO plati (pacient_id, suma, metoda, tip_plata, motiv, data_plata)
     VALUES ($1,$2,$3,$4,$5, COALESCE($6, now())) RETURNING *`,
    [req.params.id, suma, metoda, tip_plata, motiv || null, data_plata || null]
  );
  res.status(201).json(rows[0]);
});

router.post('/', async (req, res) => {
  const { nume, prenume, cnp, telefon, email, diagnostic } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO pacienti (nume, prenume, cnp, telefon, email, diagnostic)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [nume, prenume, cnp, telefon, email, diagnostic]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { nume, prenume, telefon, email, diagnostic } = req.body;
  const { rows } = await pool.query(
    `UPDATE pacienti SET nume=$1, prenume=$2, telefon=$3, email=$4, diagnostic=$5 WHERE id=$6 RETURNING *`,
    [nume, prenume, telefon, email, diagnostic, req.params.id]
  );
  res.json(rows[0]);
});

router.patch('/:id/arhiveaza', async (req, res) => {
  const { rows } = await pool.query(`UPDATE pacienti SET activ = false WHERE id = $1 RETURNING *`, [req.params.id]);
  res.json(rows[0]);
});

router.patch('/:id/reactiveaza', async (req, res) => {
  const { rows } = await pool.query(`UPDATE pacienti SET activ = true WHERE id = $1 RETURNING *`, [req.params.id]);
  res.json(rows[0]);
});

// Stergere definitiva - sterge automat si programarile, platile, abonamentele lui (cascade in baza de date)
router.delete('/:id', async (req, res) => {
  await pool.query(`DELETE FROM pacienti WHERE id = $1`, [req.params.id]);
  res.json({ sters: true });
});

module.exports = router;