const cron = require('node-cron');
const pool = require('../db/pool');
const { trimiteSMS, trimiteEmail } = require('./brevo');

// Ruleaza in fiecare zi la 18:00 si trimite remindere pentru programarile de maine.
// Complet automat, fara nicio actiune manuala din partea clinicii sau a pacientului.
function porneteReminderele() {
  cron.schedule('0 18 * * *', async () => {
    const { rows } = await pool.query(`
      SELECT p.id AS programare_id, p.data_ora, pac.id AS pacient_id, pac.nume, pac.prenume, pac.telefon, pac.email
      FROM programari p
      JOIN pacienti pac ON pac.id = p.pacient_id
      WHERE p.status = 'programat'
        AND p.data_ora::date = (CURRENT_DATE + INTERVAL '1 day')
    `);

    for (const r of rows) {
      const ora = new Date(r.data_ora).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
      const mesaj = `Salut ${r.prenume}, iti reamintim de programarea de maine la ora ${ora} la Reset. Pe curand!`;

      if (r.telefon) {
        try {
          await trimiteSMS(r.telefon, mesaj);
          await pool.query(
            `INSERT INTO log_remindere (pacient_id, programare_id, canal, status) VALUES ($1,$2,'sms','trimis')`,
            [r.pacient_id, r.programare_id]
          );
        } catch (e) {
          await pool.query(
            `INSERT INTO log_remindere (pacient_id, programare_id, canal, status) VALUES ($1,$2,'sms',$3)`,
            [r.pacient_id, r.programare_id, 'eroare: ' + e.message]
          );
        }
      }

      if (r.email) {
        try {
          await trimiteEmail(r.email, 'Reminder programare Reset', `<p>${mesaj}</p>`);
          await pool.query(
            `INSERT INTO log_remindere (pacient_id, programare_id, canal, status) VALUES ($1,$2,'email','trimis')`,
            [r.pacient_id, r.programare_id]
          );
        } catch (e) {
          await pool.query(
            `INSERT INTO log_remindere (pacient_id, programare_id, canal, status) VALUES ($1,$2,'email',$3)`,
            [r.pacient_id, r.programare_id, 'eroare: ' + e.message]
          );
        }
      }
    }
  });
}

module.exports = { porneteReminderele };
