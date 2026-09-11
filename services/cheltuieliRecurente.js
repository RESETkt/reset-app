const cron = require('node-cron');
const pool = require('../db/pool');

// In fiecare zi verifica sabloanele recurente cu suma fixa (chirie, salarii etc.) si
// creeaza automat cheltuiala lunii curente daca nu exista deja - complet automat, fara
// nicio actiune din partea cuiva. Ruleaza zilnic (nu doar in ziua 1) ca sa se "prinda
// din urma" singur daca serverul a fost oprit exact atunci.
function porneteCheltuieliRecurente() {
  cron.schedule('30 6 * * *', async () => {
    const { rows: sabloane } = await pool.query(
      `SELECT * FROM cheltuieli_recurente WHERE tip = 'fixa' AND activ = true`
    );

    for (const s of sabloane) {
      const { rows: existente } = await pool.query(
        `SELECT id FROM cheltuieli
         WHERE categorie = $1
           AND data_cheltuiala >= date_trunc('month', CURRENT_DATE)
           AND data_cheltuiala < date_trunc('month', CURRENT_DATE) + interval '1 month'
         LIMIT 1`,
        [s.categorie]
      );
      if (existente.length === 0) {
        await pool.query(
          `INSERT INTO cheltuieli (categorie, suma, descriere) VALUES ($1,$2,'Generata automat (recurenta)')`,
          [s.categorie, s.suma]
        );
      }
    }
  }, { timezone: 'Europe/Bucharest' });
}

module.exports = { porneteCheltuieliRecurente };
