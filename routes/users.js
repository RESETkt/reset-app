const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { ceareAutentificare, ceareAdmin } = require('../services/auth');

const router = express.Router();
router.use(ceareAutentificare);

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, nume, email, rol FROM utilizatori WHERE rol = 'kineto' OR rol = 'admin' ORDER BY nume`
  );
  res.json(rows);
});

// Doar admin poate adauga un kineto nou in echipa
router.post('/', ceareAdmin, async (req, res) => {
  const { nume, email, parola } = req.body;
  if (!nume || !email || !parola) {
    return res.status(400).json({ eroare: 'Nume, email si parola sunt obligatorii.' });
  }
  try {
    const hash = await bcrypt.hash(parola, 10);
    const { rows } = await pool.query(
      `INSERT INTO utilizatori (nume, email, parola_hash, rol) VALUES ($1,$2,$3,'kineto') RETURNING id, nume, email, rol`,
      [nume, email, hash]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ eroare: 'Exista deja un cont cu acest email.' });
    res.status(500).json({ eroare: e.message });
  }
});

// Doar admin poate sterge un kineto; programarile lui raman, doar devin nealocate
router.delete('/:id', ceareAdmin, async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ eroare: 'Nu iti poti sterge propriul cont.' });
  }
  await pool.query(`UPDATE programari SET kineto_id = NULL WHERE kineto_id = $1`, [req.params.id]);
  await pool.query(`DELETE FROM utilizatori WHERE id = $1`, [req.params.id]);
  res.json({ sters: true });
});

module.exports = router;