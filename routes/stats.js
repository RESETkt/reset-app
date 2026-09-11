const express = require('express');
const PDFDocument = require('pdfkit');
const pool = require('../db/pool');
const { ceareAutentificare } = require('../services/auth');

const router = express.Router();
router.use(ceareAutentificare);

const LUNI_RO = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];

// Parola care ascunde sumele incasate de privirile curioase - verificata aici, pe server,
// nu doar mascata vizual in client (altfel oricine se uita in codul sursa vede sumele oricum).
const PAROLA_SUME = 'resetcash';

router.get('/', async (req, res) => {
  const parolaCorecta = req.query.parola === PAROLA_SUME;

  const pacientiSaptamana = await pool.query(`
    SELECT COUNT(*) FROM programari
    WHERE data_ora >= date_trunc('week', now()) AND data_ora < date_trunc('week', now()) + interval '7 days' AND status = 'prezent'
  `);
  const pacientiLuna = await pool.query(`
    SELECT COUNT(*) FROM programari
    WHERE data_ora >= date_trunc('month', now()) AND data_ora < date_trunc('month', now()) + interval '1 month' AND status = 'prezent'
  `);

  // Intotdeauna cele 12 luni ale anului curent, ianuarie->decembrie (ca un calendar) -
  // lunile viitoare apar cu 0, pentru ca inca nu au avut loc.
  const sedinteLunar = await pool.query(`
    SELECT
      EXTRACT(YEAR FROM gs.luna)::int AS an,
      EXTRACT(MONTH FROM gs.luna)::int AS luna,
      COUNT(p.id) AS total
    FROM generate_series(
      date_trunc('year', now()),
      date_trunc('year', now()) + interval '11 months',
      interval '1 month'
    ) AS gs(luna)
    LEFT JOIN programari p
      ON date_trunc('month', p.data_ora) = gs.luna AND p.status = 'prezent'
    GROUP BY gs.luna
    ORDER BY gs.luna
  `);
  const sedinte_pe_luna = sedinteLunar.rows.map(r => ({
    luna: `${r.an}-${String(r.luna).padStart(2, '0')}`,
    eticheta: LUNI_RO[r.luna - 1].slice(0, 3),
    total: Number(r.total)
  }));

  // Rata de reinnoire a abonamentelor (8/12 sedinte - individualele nu se "reinnoiesc").
  // Un abonament e considerat "finalizat" cand sedinte_efectuate >= total_sedinte; data
  // finalizarii e ultima programare cu prezenta legata de el (nu avem un camp dedicat).
  // "Reinnoit" = pacientul are alt abonament creat dupa acea data.
  const reinnoiriLunar = await pool.query(`
    WITH finalizate AS (
      SELECT
        a.id,
        a.pacient_id,
        (SELECT MAX(p.data_ora) FROM programari p WHERE p.abonament_id = a.id AND p.status = 'prezent') AS data_finalizare
      FROM abonamente a
      WHERE a.sedinte_efectuate >= a.total_sedinte AND a.tip IN ('8', '12')
    ),
    finalizate_cu_data AS (
      SELECT
        f.*,
        EXISTS (
          SELECT 1 FROM abonamente a2
          WHERE a2.pacient_id = f.pacient_id AND a2.id <> f.id AND a2.creat_la > f.data_finalizare
        ) AS reinnoit
      FROM finalizate f
      WHERE f.data_finalizare IS NOT NULL
    )
    SELECT
      EXTRACT(YEAR FROM gs.luna)::int AS an,
      EXTRACT(MONTH FROM gs.luna)::int AS luna,
      COUNT(fv.id) AS total_finalizate,
      COUNT(fv.id) FILTER (WHERE fv.reinnoit) AS total_reinnoite
    FROM generate_series(
      date_trunc('year', now()),
      date_trunc('year', now()) + interval '11 months',
      interval '1 month'
    ) AS gs(luna)
    LEFT JOIN finalizate_cu_data fv ON date_trunc('month', fv.data_finalizare) = gs.luna
    GROUP BY gs.luna
    ORDER BY gs.luna
  `);
  const reinnoiri_pe_luna = reinnoiriLunar.rows.map(r => {
    const totalFinalizate = Number(r.total_finalizate);
    const totalReinnoite = Number(r.total_reinnoite);
    return {
      luna: `${r.an}-${String(r.luna).padStart(2, '0')}`,
      eticheta: LUNI_RO[r.luna - 1].slice(0, 3),
      total_finalizate: totalFinalizate,
      total_reinnoite: totalReinnoite,
      total: totalFinalizate > 0 ? Math.round((totalReinnoite / totalFinalizate) * 100) : 0
    };
  });

  let incasari_saptamana = null;
  let incasari_luna = null;
  let incasari_dupa_metoda = null;
  let incasari_pe_luna = null;

  if (parolaCorecta) {
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
    const incasariLunar = await pool.query(`
      SELECT
        EXTRACT(YEAR FROM gs.luna)::int AS an,
        EXTRACT(MONTH FROM gs.luna)::int AS luna,
        COALESCE(SUM(pl.suma), 0) AS total
      FROM generate_series(
        date_trunc('year', now()),
        date_trunc('year', now()) + interval '11 months',
        interval '1 month'
      ) AS gs(luna)
      LEFT JOIN plati pl ON date_trunc('month', pl.data_plata) = gs.luna
      GROUP BY gs.luna
      ORDER BY gs.luna
    `);
    incasari_saptamana = Number(incasariSaptamana.rows[0].total);
    incasari_luna = Number(incasariLuna.rows[0].total);
    incasari_dupa_metoda = dupaMetoda.rows;
    incasari_pe_luna = incasariLunar.rows.map(r => ({
      luna: `${r.an}-${String(r.luna).padStart(2, '0')}`,
      eticheta: LUNI_RO[r.luna - 1].slice(0, 3),
      total: Number(r.total)
    }));
  }

  res.json({
    pacienti_saptamana: Number(pacientiSaptamana.rows[0].count),
    pacienti_luna: Number(pacientiLuna.rows[0].count),
    incasari_saptamana,
    incasari_luna,
    incasari_dupa_metoda,
    incasari_pe_luna,
    sedinte_pe_luna,
    reinnoiri_pe_luna
  });
});

// Raport PDF pentru o luna aleasa (an + luna, luna 1-12)
router.get('/pdf', async (req, res) => {
  if (req.query.parola !== PAROLA_SUME) {
    return res.status(401).json({ eroare: 'Parola gresita.' });
  }
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
      const data = new Date(p.data_plata).toLocaleDateString('ro-RO', { timeZone: 'Europe/Bucharest' });
      doc.text(`${data}  -  ${p.nume} ${p.prenume}  -  ${Number(p.suma).toFixed(2)} lei (${p.metoda === 'cash' ? 'cash' : 'card'}, ${p.tip_plata})  -  ${p.motiv || 'fara motiv specificat'}`);
    });
  }

  doc.end();
});

module.exports = router;