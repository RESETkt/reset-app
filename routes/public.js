const express = require('express');
const pool = require('../db/pool');
const { creeazaNotificare } = require('../services/notificariEchipa');
const { trimiteEmail } = require('../services/brevo');

// Adrese publice, FARA autentificare. Singura de acum: formularul „Lasa numarul, te sunam noi” de pe movebetter.ro.
// Ajunge ca notificare (cerere_apel) la toata echipa, cu push, plus un email de rezerva. Date personale: nu se scriu in loguri.
const router = express.Router();

const EMAIL_REZERVA = 'resetmovebetter@gmail.com';
const MAX_CERERI_PE_ORA = 5;
const FEREASTRA_MS = 60 * 60 * 1000;
const DURATA_MIN_MS = 2000;        // sub 2 secunde de la incarcarea paginii = robot
const cereriPeIp = new Map();      // ip -> [momente]

function ipDin(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.ip || (req.socket && req.socket.remoteAddress) || 'necunoscut';
}

// true daca IP-ul a depasit limita; altfel inregistreaza cererea
function depasitLimita(ip) {
  const acum = Date.now();
  const lista = (cereriPeIp.get(ip) || []).filter(t => acum - t < FEREASTRA_MS);
  if (lista.length >= MAX_CERERI_PE_ORA) {
    cereriPeIp.set(ip, lista);
    return true;
  }
  lista.push(acum);
  cereriPeIp.set(ip, lista);
  return false;
}

// Curatenie rara a memoriei: scoate IP-urile fara cereri in ultima ora
setInterval(() => {
  const acum = Date.now();
  for (const [ip, lista] of cereriPeIp) {
    if (!lista.some(t => acum - t < FEREASTRA_MS)) cereriPeIp.delete(ip);
  }
}, 10 * 60 * 1000).unref();

// 0754 123 456, +40 754 123 456, 0040754123456, 40754123456 -> 0754123456; null daca nu e numar romanesc valid
function normalizeazaTelefon(brut) {
  let t = String(brut || '').replace(/[^\d+]/g, '');
  if (t.startsWith('+40')) t = '0' + t.slice(3);
  else if (t.startsWith('0040')) t = '0' + t.slice(4);
  else if (t.startsWith('40') && t.length === 11) t = '0' + t.slice(2);
  return /^0[237]\d{8}$/.test(t) ? t : null;
}

function curataNume(n) {
  return String(n || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

function curataPagina(p) {
  const s = String(p || '').trim();
  return /^\/[A-Za-z0-9\-_/.]{0,99}$/.test(s) ? s : '';
}

const escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

router.post('/cerere-apel', async (req, res) => {
  try {
    const { nume, telefon, pagina, website, durata } = req.body || {};

    // Antirobot: campul ascuns completat sau formular trimis prea repede -> raspundem OK, dar nu salvam nimic
    if ((website && String(website).trim()) || !(Number(durata) >= DURATA_MIN_MS)) {
      return res.status(200).json({ ok: true });
    }

    if (depasitLimita(ipDin(req))) {
      return res.status(429).json({ eroare: 'Prea multe cereri. Incearca mai tarziu.' });
    }

    const tel = normalizeazaTelefon(telefon);
    if (!tel) return res.status(400).json({ eroare: 'Numar de telefon invalid.' });

    // Acelasi numar cu o cerere inca nerezolvata: nu cream alta
    const exista = await pool.query(
      `SELECT 1 FROM notificari_echipa WHERE tip = 'cerere_apel' AND rezolvat = false AND position($1 in text) > 0 LIMIT 1`,
      [', ' + tel]
    );
    if (exista.rows.length > 0) return res.status(200).json({ ok: true });

    const numeCurat = curataNume(nume);
    const paginaCurata = curataPagina(pagina);
    const text = `Te rog sună: ${numeCurat || 'fără nume'}, ${tel}${paginaCurata ? ` (${paginaCurata})` : ''}`;

    await creeazaNotificare({ tip: 'cerere_apel', text, pacient_id: null, creat_de: null });

    // Email de rezerva: daca nu merge, cererea ramane salvata si raspunsul tot 200
    try {
      await trimiteEmail(EMAIL_REZERVA, 'Cerere de apel de pe movebetter.ro', `<p>${escapeHtml(text)}</p>`);
    } catch (e) {
      console.error('Emailul de rezerva pentru cererea de apel nu a putut fi trimis:', e.message);
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Cerere de apel esuata:', e.message);
    res.status(500).json({ eroare: 'Nu am putut salva cererea.' });
  }
});

module.exports = router;
module.exports._test = { normalizeazaTelefon, curataNume, curataPagina, ipDin, depasitLimita, cereriPeIp };
