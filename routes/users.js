const express = require('express');
const pool = require('../db/pool');
const { ceareAutentificare } = require('../services/auth');

const router = express.Router();
router.use(ceareAutentificare);

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, nume FROM utilizatori WHERE rol = 'kineto' OR rol = 'admin' ORDER BY nume`
  );
  res.json(rows);
});

module.exports = router;