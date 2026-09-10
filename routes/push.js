const express = require('express');
const pool = require('../db/pool');
const { ceareAutentificare } = require('../services/auth');
const { cheiePublica } = require('../services/push');

const router = express.Router();

// Publica - clientul are nevoie de ea inainte sa se aboneze, fara sa fie neaparat vreo problema de securitate
router.get('/cheie-publica', (req, res) => {
  res.json({ cheiePublica });
});

router.use(ceareAutentificare);

router.post('/aboneaza', async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ eroare: 'Date de abonare incomplete.' });
    }
    await pool.query(
      `INSERT INTO push_subscriptions (utilizator_id, endpoint, p256dh, auth)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (endpoint) DO UPDATE SET utilizator_id = $1, p256dh = $3, auth = $4`,
      [req.user.id, endpoint, keys.p256dh, keys.auth]
    );
    res.status(201).json({ abonat: true });
  } catch (e) {
    res.status(500).json({ eroare: e.message });
  }
});

router.post('/dezaboneaza', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
    res.json({ dezabonat: true });
  } catch (e) {
    res.status(500).json({ eroare: e.message });
  }
});

module.exports = router;
