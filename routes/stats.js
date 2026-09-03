const express = require('express');
const PDFDocument = require('pdfkit');
const pool = require('../db/pool');
const { ceareAutentificare } = require('../services/auth');

const router = express.Router();
router.use(ceareAutentificare);

const LUNI_RO = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];

router.get('/', async (req, res) => {
  const pacientiSaptamana = await pool.query(`
    SELECT COUNT(*) FROM programari
    WHERE data_ora >= date_trunc('week', now()) AND data_ora < date_trunc('week', now()) + interval '7 days' AND status = 'prezent'
  `);
  const pacientiLuna = await pool.query(`
    SELECT COUNT(*) FROM programari
    WHERE data_ora >= date_trunc('month', now()) AND data_ora < date_trunc('month', now()) + interval '1 month' AND status = 'prezent'
  `);
  const incasariSaptamana = await pool.query(`
    SELECT COALESCE(SUM(suma),0) AS total FROM plati
    WHERE data_plata >= date_trunc('week', now())
  `);
  const incasariLuna = await pool.query(`
    SELECT COALESCE(SUM(suma),0) AS total FROM plati
    WHERE data_plata >= date_trunc('month', now())
  `);
  const dupaMetoda = await pool.query(`
    SELECT metoda, COALESCE(SUM(suma),0) AS total FROM plati
    WHERE data_plata >= date_trunc('month', now())
    GROUP BY metoda
  `);

  res.json({
    pacienti_saptamana: Number(pacientiSaptamana.rows[0].count),
    pacienti_luna: Number(pacientiLuna.rows[0].count),
    incasari_saptamana: Number(incasariSaptamana.rows[0].total),
    incasari_luna: Number(incasariLuna.rows[0].total),
    incasari_dupa_metoda: dupaMetoda.rows
  });
});

// Raport PDF pentru o luna aleasa (an + luna, luna 1-12)
router.get('/pdf', async (req, res) => {
  const an = parseInt(req.query.an, 10);
  const luna = parseInt(req.query.luna, 10);
  if (!an || !luna || luna < 1 || luna > 12) {
    return res.status(400).json({ eroare: 'An si luna valide sunt obligatorii.' });
  }

  const inceput = `${an}-${String(luna).padStart(2, '0')}-01`;

  const sedinte = await pool.query(
    `SELECT COUNT(*) FROM programari
     WHERE data_ora >= $1::date AND data_ora < ($1::date + interval '1 month') AND status = 'prezent'`,
    [inceput]
  );

  const plati = await pool.query(
    `SELECT pl.suma, pl.metoda, pl.tip_plata, pl.motiv, pl.data_plata, pac.nume, pac.prenume
     FROM plati pl JOIN pacienti pac ON pac.id = pl.pacient_id
     WHERE pl.data_plata >= $1::date AND pl.data_plata < ($1::date + interval '1 month')
     ORDER BY pl.data_plata`,
    [inceput]
  );

  const total = plati.rows.reduce((s, p) => s + Number(p.suma), 0);
  const dupaMetoda = {};
  plati.rows.forEach(p => { dupaMetoda[p.metoda] = (dupaMetoda[p.metoda] || 0) + Number(p.suma); });

  const numeLuna = `${LUNI_RO[luna - 1]} ${an}`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="raport-${LUNI_RO[luna - 1].toLowerCase()}-${an}.pdf"`);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);

  doc.fontSize(18).text(`Raport Reset - ${numeLuna}`, { align: 'center' });
  doc.moveDown();

  doc.fontSize(12).text(`Sedinte efectuate: ${sedinte.rows[0].count}`);
  doc.text(`Total incasari: ${total.toFixed(2)} lei`);
  Object.entries(dupaMetoda).forEach(([metoda, suma]) => {
    doc.text(`   ${metoda === 'cash' ? 'Cash' : 'Card'}: ${suma.toFixed(2)} lei`);
  });

  doc.moveDown();
  doc.fontSize(14).text('Detaliu plati', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10);

  if (plati.rows.length === 0) {
    doc.text('Nicio plata inregistrata in aceasta luna.');
  } else {
    plati.rows.forEach(p => {
      const data = new Date(p.data_plata).toLocaleDateString('ro-RO');
      doc.text(`${data}  -  ${p.nume} ${p.prenume}  -  ${Number(p.suma).toFixed(2)} lei (${p.metoda === 'cash' ? 'cash' : 'card'}, ${p.tip_plata})  -  ${p.motiv || 'fara motiv specificat'}`);
    });
  }

  doc.end();
});

module.exports = router;