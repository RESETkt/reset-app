const cron = require('node-cron');
const pool = require('../db/pool');

// O data pe zi: sterge cererile de apel de pe site mai vechi de 30 de zile, rezolvate sau nu
// (contin nume si telefon; nu le pastram mai mult decat trebuie).
function porneteCuratenieCereri() {
  cron.schedule('30 3 * * *', async () => {
    try {
      const r = await pool.query(`DELETE FROM notificari_echipa WHERE tip = 'cerere_apel' AND creat_la < now() - interval '30 days'`);
      if (r.rowCount) console.log(`Cereri de apel sterse (mai vechi de 30 de zile): ${r.rowCount}`);
    } catch (e) {
      console.error('Nu am putut sterge cererile de apel vechi:', e.message);
    }
  }, { timezone: 'Europe/Bucharest' });
}

module.exports = { porneteCuratenieCereri };
