const express = require('express');
const pool = require('../db/pool');
const { ceareAutentificare } = require('../services/auth');

const router = express.Router();
router.use(ceareAutentificare);

router.get('/', async (req, res) => {
  const pacientiSaptamana = await pool.query(`
    SELECT COUNT(*) FROM programari
    WHERE prezent_marcat_la >= date_trunc('week', now()) AND status = 'prezent'
  `);
  const pacientiLuna = await pool.query(`
    SELECT COUNT(*) FROM programari
    WHERE prezent_marcat_la >= date_trunc('month', now()) AND status = 'prezent'
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

module.exports = router;