const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

const TEXT_GDPR = `Sunt de acord cu prelucrarea datelor mele cu caracter personal (nume, prenume, CNP, telefon, email) de catre Reset, in scopul gestionarii programarilor si a fisei mele de kinetoterapie, conform Regulamentului GDPR.`;

// Fara autentificare cu token de staff - se apeleaza direct de pe tableta la prima vizita
router.get('/text', (req, res) => {
  res.json({ text: TEXT_GDPR });
});

router.post('/:pacientId', async (req, res) => {
  const { semnatura_svg } = req.body;
  const existent = await pool.query(
    'SELECT id FROM consimtaminte_gdpr WHERE pacient_id = $1',
    [req.params.pacientId]
  );
  if (existent.rows.length > 0) {
    return res.status(409).json({ eroare: 'Pacientul a semnat deja consimtamantul GDPR' });
  }
  const { rows } = await pool.query(
    `INSERT INTO consimtaminte_gdpr (pacient_id, semnatura_svg, text_document) VALUES ($1,$2,$3) RETURNING id, data_semnare`,
    [req.params.pacientId, semnatura_svg, TEXT_GDPR]
  );
  res.status(201).json(rows[0]);
});

module.exports = router;
