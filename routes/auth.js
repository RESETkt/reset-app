const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { creeazaToken, ceareAutentificare, ceareAdmin } = require('../services/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, parola } = req.body;
  const { rows } = await pool.query('SELECT * FROM utilizatori WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(parola, user.parola_hash))) {
    return res.status(401).json({ eroare: 'Email sau parola gresita' });
  }
  res.json({ token: creeazaToken(user), nume: user.nume, rol: user.rol });
});

// Protejata: doar un admin deja autentificat poate crea conturi noi de aici.
// Pentru gestionarea echipei, foloseste sectiunea "Echipa" din aplicatie.
router.post('/inregistreaza', ceareAutentificare, ceareAdmin, async (req, res) => {
  const { nume, email, parola, rol } = req.body;
  const hash = await bcrypt.hash(parola, 10);
  const { rows } = await pool.query(
    'INSERT INTO utilizatori (nume, email, parola_hash, rol) VALUES ($1,$2,$3,$4) RETURNING id, nume, rol',
    [nume, email, hash, rol || 'kineto']
  );
  res.status(201).json(rows[0]);
});

module.exports = router;