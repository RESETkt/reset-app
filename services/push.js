const webpush = require('web-push');
const pool = require('../db/pool');

// .trim() ca o linie noua/spatiu lipit din greseala la copiere sa nu strice cheia
const cheiePublicaBruta = (process.env.VAPID_PUBLIC_KEY || '').trim() || null;
const cheiePrivataBruta = (process.env.VAPID_PRIVATE_KEY || '').trim() || null;

let activat = false;
if (cheiePublicaBruta && cheiePrivataBruta) {
  try {
    webpush.setVapidDetails(
      (process.env.VAPID_SUBJECT || 'mailto:contact@reset.ro').trim(),
      cheiePublicaBruta,
      cheiePrivataBruta
    );
    activat = true;
  } catch (e) {
    // O cheie invalida nu trebuie sa opreasca toata aplicatia - doar push-ul ramane dezactivat.
    console.error('Cheile VAPID sunt invalide, notificarile push raman dezactivate:', e.message);
  }
} else {
  console.warn('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY lipsesc din environment - notificarile push sunt dezactivate.');
}

const cheiePublica = activat ? cheiePublicaBruta : null;

// Trimite o notificare push tuturor telefoanelor abonate (in afara, optional, de cel care a declansat-o).
// Abonamentele expirate/revocate de browser sunt sterse automat din baza de date.
async function trimitePush({ excludeUtilizatorId, titlu, corp, url }) {
  if (!activat) return;

  const { rows } = await pool.query(
    excludeUtilizatorId
      ? `SELECT * FROM push_subscriptions WHERE utilizator_id IS DISTINCT FROM $1`
      : `SELECT * FROM push_subscriptions`,
    excludeUtilizatorId ? [excludeUtilizatorId] : []
  );

  const payload = JSON.stringify({ title: titlu, body: corp, url: url || '/' });

  await Promise.all(rows.map(async (abonament) => {
    try {
      await webpush.sendNotification(
        { endpoint: abonament.endpoint, keys: { p256dh: abonament.p256dh, auth: abonament.auth } },
        payload
      );
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [abonament.id]);
      } else {
        console.error('Eroare la trimiterea unei notificari push:', e.message);
      }
    }
  }));
}

module.exports = { trimitePush, cheiePublica, activat };
