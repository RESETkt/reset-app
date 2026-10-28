const express = require('express');
const PDFDocument = require('pdfkit');
const pool = require('../db/pool');
const { ceareAutentificare, ceareAdmin } = require('../services/auth');
const { PAROLA_SUME } = require('../services/parolaSume');

const router = express.Router();
router.use(ceareAutentificare);

const LUNI_RO = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];

function dataISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Ce scriu kinetoterapeutii la "exercitii": cele mai folosite expresii si cuvinte din sedintele vechi, ca sa putem
// construi biblioteca de miscari din ce se foloseste de fapt (doar admin).
const APARATE_CUVINTE = ['Respirații', 'Mobilitate', 'Stabilitate', 'Benzi', 'TRX', 'Kettlebell', 'StickMobility', 'RIP', 'Lada', 'Stepper', 'Agilitate', 'Haltere', 'Altceva'];
const OPRITE = new Set(['de', 'cu', 'la', 'pe', 'si', 'in', 'din', 'a', 'un', 'o', 'sau', 'pentru', 'ca', 'se', 'sa', 'al', 'ale', 'mai', 'doar', 'fara', 'x']);

function fara(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }

router.get('/exercitii-cuvinte', ceareAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT exercitii FROM programari WHERE status = 'prezent' AND exercitii IS NOT NULL AND exercitii <> ''`
  );
  const aparateNorm = new Map(APARATE_CUVINTE.map(a => [fara(a), a]));
  const aparate = {}, fraze = new Map(), cuvinte = new Map();
  const numara = (mapa, cheie, afisat) => {
    const c = mapa.get(cheie) || { text: afisat, nr: 0 };
    c.nr++;
    mapa.set(cheie, c);
  };
  const adaugaAparat = nume => { aparate[nume] = (aparate[nume] || 0) + 1; };
  rows.forEach(rand => String(rand.exercitii).split('\n').forEach(linie => {
    let rest = linie.trim();
    if (!rest) return;
    const m = rest.match(/^([^:]{1,30}):\s*(.*)$/);
    if (m && aparateNorm.has(fara(m[1]))) {
      adaugaAparat(aparateNorm.get(fara(m[1])));
      rest = m[2];
    } else if (aparateNorm.has(fara(rest))) {
      adaugaAparat(aparateNorm.get(fara(rest)));
      return;
    }
    rest.split(/[,;]|\s\+\s|\ssi\s|\sși\s/i).forEach(bucata => {
      // fara dozaje ("3x10", "2 x 12", "15 kg")
      const curat = bucata.replace(/\b\d+\s*[x×]\s*\d+\b/gi, ' ').replace(/\b\d+([.,]\d+)?\s*(kg|rep|repetari|ture|sec|min)?\b/gi, ' ').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
      const k = fara(curat);
      if (k.length < 3 || k.length > 60) return;
      numara(fraze, k, curat.toLowerCase());
      k.split(' ').filter(w => w.length > 2 && !OPRITE.has(w) && !/^\d/.test(w)).forEach(w => numara(cuvinte, w, w));
    });
  }));
  const top = (mapa, n) => [...mapa.values()].sort((a, b) => b.nr - a.nr).slice(0, n);
  res.json({
    sedinte_cu_text: rows.length,
    aparate: Object.entries(aparate).map(([nume, nr]) => ({ nume, nr })).sort((a, b) => b.nr - a.nr),
    fraze: top(fraze, 120),
    cuvinte: top(cuvinte, 80),
  });
});

// Numarul de pacienti dintr-o saptamana la alegere (offset in saptamani fata de cea curenta,
// 0 = saptamana asta, -1 = saptamana trecuta etc) - fara nicio suma, ca sa poata fi vazut de
// oricine e logat, nu doar de admin cu parola de sume.
router.get('/saptamana', async (req, res) => {
  const offset = parseInt(req.query.offset, 10) || 0;

  const azi = new Date();
  const ziSaptamana = (azi.getDay() + 6) % 7; // 0=luni .. 6=duminica
  const ziInceputLuni = azi.getDate() - ziSaptamana + offset * 7;
  // Constructia asta (an, luna, zi separat) rezolva corect trecerea intre luni/ani si nu e
  // afectata de ora de vara/iarna, spre deosebire de adunarea bruta a 24h in milisecunde.
  const inceput = new Date(azi.getFullYear(), azi.getMonth(), ziInceputLuni);
  const sfarsitExclusiv = new Date(azi.getFullYear(), azi.getMonth(), ziInceputLuni + 7);
  const ultimaZi = new Date(azi.getFullYear(), azi.getMonth(), ziInceputLuni + 6);

  const { rows } = await pool.query(
    `SELECT COUNT(*) FROM programari WHERE data_ora >= $1 AND data_ora < $2 AND status = 'prezent'`,
    [inceput, sfarsitExclusiv]
  );

  res.json({
    pacienti: Number(rows[0].count),
    inceput: dataISO(inceput),
    sfarsit: dataISO(ultimaZi),
    esteSaptamanaCurenta: offset === 0
  });
});

router.get('/', async (req, res) => {
  const parolaCorecta = req.query.parola === PAROLA_SUME;

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

  // Ultimele 12 saptamani (luni->duminica), saptamana curenta inclusiv - la fel ca la luni,
  // dar pe o fereastra glisanta, nu ancorata de inceputul anului (nu prea are sens un "ianuarie
  // - saptamana 1" cand saptamanile taie peste ani).
  const pacientiSaptamanal = await pool.query(`
    SELECT
      gs.saptamana AS inceput,
      COUNT(p.id) AS total
    FROM generate_series(
      date_trunc('week', now()) - interval '11 weeks',
      date_trunc('week', now()),
      interval '1 week'
    ) AS gs(saptamana)
    LEFT JOIN programari p
      ON p.data_ora >= gs.saptamana AND p.data_ora < gs.saptamana + interval '1 week' AND p.status = 'prezent'
    GROUP BY gs.saptamana
    ORDER BY gs.saptamana
  `);
  const contorSaptamaniLuna = {};
  const pacienti_pe_saptamana = pacientiSaptamanal.rows.map(r => {
    const d = new Date(r.inceput);
    const cheieLuna = `${d.getFullYear()}-${d.getMonth()}`;
    contorSaptamaniLuna[cheieLuna] = (contorSaptamaniLuna[cheieLuna] || 0) + 1;
    return {
      saptamana: dataISO(d),
      eticheta: `S${contorSaptamaniLuna[cheieLuna]} ${LUNI_RO[d.getMonth()].slice(0, 3)}`,
      total: Number(r.total)
    };
  });

  // Rata de reinnoire a abonamentelor (pachete cu mai multe sedinte - 8/12/functional -
  // individualele nu se "reinnoiesc", sunt o singura sedinta oricum).
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
      WHERE a.sedinte_efectuate >= a.total_sedinte AND a.tip IN ('8', '12', 'functional')
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

  let incasari_luna = null;
  let incasari_dupa_metoda = null;
  let incasari_pe_luna = null;

  if (parolaCorecta) {
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
    incasari_luna = Number(incasariLuna.rows[0].total);
    incasari_dupa_metoda = dupaMetoda.rows;
    incasari_pe_luna = incasariLunar.rows.map(r => ({
      luna: `${r.an}-${String(r.luna).padStart(2, '0')}`,
      eticheta: LUNI_RO[r.luna - 1].slice(0, 3),
      total: Number(r.total)
    }));
  }

  res.json({
    pacienti_luna: Number(pacientiLuna.rows[0].count),
    incasari_luna,
    incasari_dupa_metoda,
    incasari_pe_luna,
    sedinte_pe_luna,
    pacienti_pe_saptamana,
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