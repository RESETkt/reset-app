const express = require('express');
const pool = require('../db/pool');
const { ceareAutentificare } = require('../services/auth');

const router = express.Router();
router.use(ceareAutentificare);

// Returneaza toate asignarile existente: [{ ora, culoar, kineto_id, kineto_nume }]
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ok.ora, ok.culoar, ok.kineto_id, u.nume AS kineto_nume
     FROM orar_kineto ok
     LEFT JOIN utilizatori u ON u.id = ok.kineto_id`
  );
  res.json(rows);
});

// Seteaza (sau schimba) kineto-ul pentru o ora si un culoar (0, 1 sau 2)
router.put('/:ora/:culoar', async (req, res) => {
  const { ora, culoar } = req.params;
  const { kineto_id } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO orar_kineto (ora, culoar, kineto_id) VALUES ($1,$2,$3)
     ON CONFLICT (ora, culoar) DO UPDATE SET kineto_id = $3
     RETURNING *`,
    [ora, culoar, kineto_id || null]
  );
  res.json(rows[0]);
});

module.exports = router;