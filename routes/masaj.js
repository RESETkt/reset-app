const express = require('express');
const pool = require('../db/pool');
const { ceareAutentificare } = require('../services/auth');

// Masajul: programari luni-vineri, 07:30-19:00, din 30 in 30 de minute, 30 sau 50 de minute, o singura persoana
// (fara suprapuneri). Are plata lui (150 lei la 30 min, 200 lei la 50 min) si pachete de 4 masaje. Plata se
// inregistreaza in "plati", ca sa apara la incasarile din Statistici.
const router = express.Router();
router.use(ceareAutentificare);

const DESCHIDE = 7 * 60 + 30;
const INCHIDE = 19 * 60;
const PRET = { 30: 150, 50: 200 };
const PRET_PACHET = { 30: 540, 50: 720 };   // 4 masaje, cu ~10% reducere
const TOTAL_PACHET = 4;
const SAPTAMANI_VALABILITATE = 6;           // 1 masaj pe saptamana, cu loc de o pauza

function asincron(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

// 'YYYY-MM-DD HH:MM:SS' sau cu T -> { data, minute } sau null
function citesteDataOra(s) {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(String(s || ''));
  if (!m) return null;
  return { data: m[1], minute: parseInt(m[2], 10) * 60 + parseInt(m[3], 10) };
}

function eroareProgram(data, minute, durata) {
  const zi = new Date(data + 'T00:00:00').getDay();
  if (zi === 0 || zi === 6) return 'Masajul se face doar de luni pana vineri.';
  if (!PRET[durata]) return 'Durata trebuie sa fie 30 sau 50 de minute.';
  if (minute % 30 !== 0 || minute < DESCHIDE) return 'Orele de masaj sunt din 30 in 30 de minute, de la 07:30.';
  if (minute + durata > INCHIDE) return 'Masajul trebuie sa se termine pana la 19:00.';
  return null;
}

// Exista alt masaj (neabsent) care se suprapune cu intervalul?
async function suprapunere(client, data, minute, durata, ignoraId) {
  const { rows } = await client.query(
    `SELECT m.id FROM masaje m
     WHERE m.status <> 'absent' AND ($4::uuid IS NULL OR m.id <> $4::uuid)
       AND m.data_ora < (($1::date + make_interval(mins => $2::int + $3::int))::timestamp AT TIME ZONE 'Europe/Bucharest')
       AND m.data_ora + make_interval(mins => m.durata_min) > (($1::date + make_interval(mins => $2::int))::timestamp AT TIME ZONE 'Europe/Bucharest')
     LIMIT 1`,
    [data, minute, durata, ignoraId || null]
  );
  return rows.length > 0;
}

// Pachetele pacientului cu cate masaje au ramas (programate sau facute, nu absente, se scad din pachet)
const PACHETE_CU_RAMASE = `
  SELECT p.*, to_char(p.valabil_pana, 'YYYY-MM-DD') AS valabil_pana_txt,
         p.total - COALESCE((SELECT COUNT(*) FROM masaje m WHERE m.pachet_id = p.id AND m.status <> 'absent'), 0)::int AS ramase
  FROM masaj_pachete p`;

router.get('/', asincron(async (req, res) => {
  const start = req.query.de_la || new Date().toISOString().slice(0, 10);
  const sfarsit = req.query.pana_la || start;
  const { rows } = await pool.query(
    `SELECT m.id, m.pacient_id, pac.nume, pac.prenume, m.durata_min, m.status, m.pachet_id, m.plata_metoda,
            to_char(m.data_ora, 'YYYY-MM-DD') AS data, to_char(m.data_ora, 'HH24:MI') AS ora,
            (EXTRACT(HOUR FROM m.data_ora) * 60 + EXTRACT(MINUTE FROM m.data_ora))::int AS minute
     FROM masaje m JOIN pacienti pac ON pac.id = m.pacient_id
     WHERE m.data_ora::date BETWEEN $1::date AND $2::date
     ORDER BY m.data_ora`,
    [start, sfarsit]
  );
  res.json(rows);
}));

router.get('/pacient/:id', asincron(async (req, res) => {
  const pachete = await pool.query(`${PACHETE_CU_RAMASE} WHERE p.pacient_id = $1 ORDER BY p.creat_la DESC`, [req.params.id]);
  const masaje = await pool.query(
    `SELECT id, durata_min, status, pachet_id, plata_metoda, to_char(data_ora, 'YYYY-MM-DD') AS data, to_char(data_ora, 'HH24:MI') AS ora
     FROM masaje WHERE pacient_id = $1 ORDER BY data_ora DESC LIMIT 30`,
    [req.params.id]
  );
  res.json({ pachete: pachete.rows, masaje: masaje.rows, preturi: PRET, preturi_pachet: PRET_PACHET });
}));

router.post('/', asincron(async (req, res) => {
  const { pacient_id } = req.body;
  const durata = parseInt(req.body.durata_min, 10);
  const dt = citesteDataOra(req.body.data_ora);
  if (!pacient_id || !dt) return res.status(400).json({ eroare: 'Pacientul si data cu ora sunt obligatorii.' });
  const eroare = eroareProgram(dt.data, dt.minute, durata);
  if (eroare) return res.status(400).json({ eroare });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // un singur masaj programat odata: blocam programarile de masaj ca doua cereri deodata sa nu se suprapuna
    await client.query('LOCK TABLE masaje IN SHARE ROW EXCLUSIVE MODE');
    if (await suprapunere(client, dt.data, dt.minute, durata, null)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ eroare: 'Intervalul se suprapune cu alt masaj.' });
    }
    // Daca pacientul are un pachet valabil, de aceeasi durata, cu masaje ramase, masajul se scade din el
    const pachet = await client.query(
      `SELECT * FROM (${PACHETE_CU_RAMASE} WHERE p.pacient_id = $1 AND p.durata_min = $2) x
       WHERE x.ramase > 0 AND (x.valabil_pana IS NULL OR x.valabil_pana >= $3::date)
       ORDER BY x.creat_la LIMIT 1`,
      [pacient_id, durata, dt.data]
    );
    const { rows } = await client.query(
      `INSERT INTO masaje (pacient_id, data_ora, durata_min, pachet_id, creat_de)
       VALUES ($1, (($2::date + make_interval(mins => $3::int))::timestamp AT TIME ZONE 'Europe/Bucharest'), $4::int, $5, $6) RETURNING *`,
      [pacient_id, dt.data, dt.minute, durata, pachet.rows[0] ? pachet.rows[0].id : null, req.user.id]
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

// Prezent / absent, plata (cash sau card; sau scoasa), si mutarea pe alta data/ora
router.patch('/:id', asincron(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ex = await client.query(`SELECT * FROM masaje WHERE id = $1 FOR UPDATE`, [req.params.id]);
    const m = ex.rows[0];
    if (!m) { await client.query('ROLLBACK'); return res.status(404).json({ eroare: 'Masajul nu exista.' }); }

    if (req.body.status !== undefined) {
      if (!['programat', 'prezent', 'absent'].includes(req.body.status)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ eroare: 'Stare invalida.' });
      }
      await client.query(`UPDATE masaje SET status = $1 WHERE id = $2`, [req.body.status, m.id]);
    }

    if (req.body.plata_metoda !== undefined) {
      const metoda = req.body.plata_metoda;
      if (metoda !== null && !['cash', 'card'].includes(metoda)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ eroare: 'Plata poate fi cash sau card.' });
      }
      if (m.pachet_id && metoda) {
        await client.query('ROLLBACK');
        return res.status(400).json({ eroare: 'Masajul face parte dintr-un pachet deja platit.' });
      }
      if (m.plata_id) await client.query(`DELETE FROM plati WHERE id = $1`, [m.plata_id]);
      let plataId = null;
      if (metoda) {
        const p = await client.query(
          `INSERT INTO plati (pacient_id, suma, metoda, tip_plata, motiv) VALUES ($1, $2, $3, 'integral', $4) RETURNING id`,
          [m.pacient_id, PRET[m.durata_min], metoda, `Masaj ${m.durata_min} min`]
        );
        plataId = p.rows[0].id;
      }
      await client.query(`UPDATE masaje SET plata_metoda = $1, plata_id = $2 WHERE id = $3`, [metoda, plataId, m.id]);
    }

    if (req.body.data_ora !== undefined || req.body.durata_min !== undefined) {
      const dt = citesteDataOra(req.body.data_ora) || citesteDataOra((await client.query(`SELECT to_char(data_ora, 'YYYY-MM-DD HH24:MI') AS t FROM masaje WHERE id = $1`, [m.id])).rows[0].t);
      const durata = req.body.durata_min !== undefined ? parseInt(req.body.durata_min, 10) : m.durata_min;
      const eroare = eroareProgram(dt.data, dt.minute, durata);
      if (eroare || (await suprapunere(client, dt.data, dt.minute, durata, m.id))) {
        await client.query('ROLLBACK');
        return res.status(400).json({ eroare: eroare || 'Intervalul se suprapune cu alt masaj.' });
      }
      await client.query(
        `UPDATE masaje SET data_ora = (($1::date + make_interval(mins => $2::int))::timestamp AT TIME ZONE 'Europe/Bucharest'), durata_min = $3::int WHERE id = $4`,
        [dt.data, dt.minute, durata, m.id]
      );
    }
    const { rows } = await client.query(`SELECT * FROM masaje WHERE id = $1`, [m.id]);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

router.delete('/:id', asincron(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const m = (await client.query(`DELETE FROM masaje WHERE id = $1 RETURNING plata_id`, [req.params.id])).rows[0];
    if (m && m.plata_id) await client.query(`DELETE FROM plati WHERE id = $1`, [m.plata_id]);
    await client.query('COMMIT');
    res.json({ sters: !!m });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

// Pachet nou: 4 masaje de 30 sau 50 min. "inclus" = din abonamentul de terapie (Recuperare completa), fara plata separata.
router.post('/pachete', asincron(async (req, res) => {
  const { pacient_id, metoda } = req.body;
  const durata = parseInt(req.body.durata_min, 10);
  const inclus = !!req.body.inclus;
  if (!pacient_id || !PRET[durata]) return res.status(400).json({ eroare: 'Pacientul si durata (30 sau 50 min) sunt obligatorii.' });
  if (!inclus && !['cash', 'card'].includes(metoda)) return res.status(400).json({ eroare: 'Alege cash sau card.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let plataId = null;
    if (!inclus) {
      const p = await client.query(
        `INSERT INTO plati (pacient_id, suma, metoda, tip_plata, motiv) VALUES ($1, $2, $3, 'integral', $4) RETURNING id`,
        [pacient_id, PRET_PACHET[durata], metoda, `Pachet ${TOTAL_PACHET} masaje de ${durata} min`]
      );
      plataId = p.rows[0].id;
    }
    const { rows } = await client.query(
      `INSERT INTO masaj_pachete (pacient_id, durata_min, total, inclus, valabil_pana, plata_id)
       VALUES ($1, $2, $3, $4, CURRENT_DATE + ($5::int * 7), $6) RETURNING *`,
      [pacient_id, durata, TOTAL_PACHET, inclus, SAPTAMANI_VALABILITATE, plataId]
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

router.delete('/pachete/:id', asincron(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const p = (await client.query(`DELETE FROM masaj_pachete WHERE id = $1 RETURNING plata_id`, [req.params.id])).rows[0];
    if (p && p.plata_id) await client.query(`DELETE FROM plati WHERE id = $1`, [p.plata_id]);
    await client.query('COMMIT');
    res.json({ sters: !!p });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

module.exports = router;
