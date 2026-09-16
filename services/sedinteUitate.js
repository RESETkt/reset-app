const cron = require('node-cron');
const pool = require('../db/pool');
const { creeazaNotificare } = require('./notificariEchipa');

function formateazaDataOra(data_ora) {
  return new Date(data_ora).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' });
}

// Vineri seara, verifica programarile din saptamana curenta ramase pe status 'programat' -
// adica nimeni nu le-a marcat prezent/absent, cel mai probabil uitate. Anunta echipa printr-o
// notificare (+ push) pentru fiecare, ca sa poata fi corectate inainte sa se piarda urma lor.
function porneteVerificareSedinteUitate() {
  cron.schedule('0 19 * * 5', async () => {
    const { rows } = await pool.query(`
      SELECT p.id AS programare_id, p.data_ora, pac.id AS pacient_id, pac.nume, pac.prenume
      FROM programari p
      JOIN pacienti pac ON pac.id = p.pacient_id
      WHERE p.status = 'programat'
        AND p.data_ora::date BETWEEN (CURRENT_DATE - (EXTRACT(ISODOW FROM CURRENT_DATE)::int - 1)) AND CURRENT_DATE
      ORDER BY p.data_ora
    `);

    for (const r of rows) {
      try {
        const text = `${r.nume} ${r.prenume}: programarea din ${formateazaDataOra(r.data_ora)} nu a fost marcata prezent/absent`;
        await creeazaNotificare({ tip: 'sedinta_uitata', text, pacient_id: r.pacient_id, creat_de: null });
      } catch (e) {
        console.error('Nu am putut adauga notificarea de sedinta uitata:', e.message);
      }
    }
  }, { timezone: 'Europe/Bucharest' });
}

module.exports = { porneteVerificareSedinteUitate };
