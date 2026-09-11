const express = require('express');
const pool = require('../db/pool');
const { ceareAutentificare, ceareAdmin } = require('../services/auth');

const router = express.Router();
// Toate rutele de cheltuieli sunt doar pentru admin - colegii kineto nu au ce cauta in ele.
router.use(ceareAutentificare, ceareAdmin);

// Prinde orice eroare dintr-un handler async si raspunde cu JSON (nu lasa cererea agatata) -
// util mai ales acum, cat timp tabelele noi (cheltuieli, cheltuieli_recurente) nu exista inca
// pe o baza de date pe care nu s-a rulat migrarea.
function asincron(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

// Rezumatul lunii: incasari, cheltuieli, profit, cheltuieli pe categorie, lista cheltuielilor
// si sabloanele recurente (plus cele variabile pentru care inca nu s-a introdus suma lunii asta).
router.get('/rezumat', asincron(async (req, res) => {
  const acum = new Date();
  const an = parseInt(req.query.an, 10) || acum.getFullYear();
  const luna = parseInt(req.query.luna, 10) || (acum.getMonth() + 1);
  const inceput = `${an}-${String(luna).padStart(2, '0')}-01`;

  const incasari = await pool.query(
    `SELECT COALESCE(SUM(suma),0) AS total FROM plati
     WHERE data_plata >= $1::date AND data_plata < ($1::date + interval '1 month')`,
    [inceput]
  );

  const cheltuieli = await pool.query(
    `SELECT * FROM cheltuieli
     WHERE data_cheltuiala >= $1::date AND data_cheltuiala < ($1::date + interval '1 month')
     ORDER BY data_cheltuiala DESC`,
    [inceput]
  );

  const peCategorie = await pool.query(
    `SELECT categorie, COALESCE(SUM(suma),0) AS total FROM cheltuieli
     WHERE data_cheltuiala >= $1::date AND data_cheltuiala < ($1::date + interval '1 month')
     GROUP BY categorie ORDER BY total DESC`,
    [inceput]
  );

  const recurente = await pool.query(`SELECT * FROM cheltuieli_recurente ORDER BY categorie`);

  // Sabloanele variabile active pentru care nu exista inca nicio cheltuiala introdusa in luna asta
  const categoriiCuCheltuiala = new Set(cheltuieli.rows.map(c => c.categorie));
  const recurenteVariabileLipsa = recurente.rows
    .filter(r => r.tip === 'variabila' && r.activ && !categoriiCuCheltuiala.has(r.categorie))
    .map(r => r.categorie);

  const incasari_luna = Number(incasari.rows[0].total);
  const cheltuieli_luna = cheltuieli.rows.reduce((s, c) => s + Number(c.suma), 0);

  res.json({
    incasari_luna,
    cheltuieli_luna,
    profit_luna: incasari_luna - cheltuieli_luna,
    cheltuieli_pe_categorie: peCategorie.rows.map(r => ({ categorie: r.categorie, total: Number(r.total) })),
    cheltuieli: cheltuieli.rows,
    recurente: recurente.rows,
    recurente_variabile_lipsa: recurenteVariabileLipsa
  });
}));

router.post('/', asincron(async (req, res) => {
  const { categorie, suma, descriere, data_cheltuiala } = req.body;
  if (!categorie || !suma) {
    return res.status(400).json({ eroare: 'Categoria si suma sunt obligatorii.' });
  }
  const { rows } = await pool.query(
    `INSERT INTO cheltuieli (categorie, suma, descriere, data_cheltuiala)
     VALUES ($1,$2,$3, COALESCE($4::date, CURRENT_DATE)) RETURNING *`,
    [categorie, suma, descriere || null, data_cheltuiala || null]
  );
  res.status(201).json(rows[0]);
}));

router.delete('/:id', asincron(async (req, res) => {
  await pool.query('DELETE FROM cheltuieli WHERE id = $1', [req.params.id]);
  res.json({ sters: true });
}));

// Sabloane recurente: chirie/salarii cu suma fixa (generate automat in fiecare luna),
// sau utilitati cu suma variabila (doar o reamintire, fara suma presetata).
router.post('/recurente', asincron(async (req, res) => {
  const { categorie, tip, suma } = req.body;
  if (!categorie || !tip || !['fixa', 'variabila'].includes(tip)) {
    return res.status(400).json({ eroare: 'Categoria si tipul (fixa/variabila) sunt obligatorii.' });
  }
  if (tip === 'fixa' && !suma) {
    return res.status(400).json({ eroare: 'Suma este obligatorie pentru o cheltuiala recurenta fixa.' });
  }
  const { rows } = await pool.query(
    `INSERT INTO cheltuieli_recurente (categorie, tip, suma) VALUES ($1,$2,$3) RETURNING *`,
    [categorie, tip, tip === 'fixa' ? suma : null]
  );
  res.status(201).json(rows[0]);
}));

router.patch('/recurente/:id', asincron(async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE cheltuieli_recurente SET activ = NOT activ WHERE id = $1 RETURNING *`,
    [req.params.id]
  );
  res.json(rows[0]);
}));

// Editeaza suma unui sablon recurent cu suma fixa (chirie, salarii) - poti sa o schimbi
// oricand (ex: creste chiria), fara sa fie nevoie sa o retastezi in fiecare luna.
router.put('/recurente/:id', asincron(async (req, res) => {
  const { suma } = req.body;
  if (!suma || Number(suma) <= 0) {
    return res.status(400).json({ eroare: 'Introdu o suma valida.' });
  }
  const { rows } = await pool.query(
    `UPDATE cheltuieli_recurente SET suma = $1 WHERE id = $2 AND tip = 'fixa' RETURNING *`,
    [suma, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ eroare: 'Sablonul nu exista sau nu e de tip fixa.' });
  res.json(rows[0]);
}));

router.delete('/recurente/:id', asincron(async (req, res) => {
  await pool.query('DELETE FROM cheltuieli_recurente WHERE id = $1', [req.params.id]);
  res.json({ sters: true });
}));

// Trebuie inregistrat DUPA rute, ca sa prinda erorile lor (Express le propaga prin next(err)
// spre urmatorul middleware din lant, nu invers) - fara asta, o eroare de SQL ar lasa cererea
// agatata la infinit in loc sa raspunda cu un JSON de eroare.
router.use((err, req, res, next) => {
  console.error('Eroare in rutele de cheltuieli:', err.message);
  res.status(500).json({ eroare: 'A esuat operatia pe cheltuieli: ' + err.message });
});

module.exports = router;
