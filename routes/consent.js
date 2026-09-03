const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

const TEXT_GDPR = `INFORMARE privind prelucrarea datelor cu caracter personal

Operator: Reset your body SRL, Str. Aurel Gurghianu 29, Cluj-Napoca, Cluj. CUI 42452877, Nr. Registrul Comertului J12/1172/2020, email: resetmovebetter@gmail.com

Scopul colectarii datelor este acordarea de servicii de sanatate in conditiile legii. Sunteti obligat(a) sa furnizati datele, acestea fiind necesare pentru legalitatea acordarii serviciilor medicale.

Informatiile inregistrate sunt destinate utilizarii de catre operator si, dupa caz, de catre imputernicitul acestuia, si sunt comunicate doar autoritatilor abilitate in domeniul medical, inclusiv Ministerul Sanatatii, Casa Nationala de Asigurari de Sanatate, directiile de sanatate publica si alti imputerniciti ai acestora, in conditiile legii.

Datele colectate vor fi pastrate pentru perioada de timp impusa de legislatia in vigoare.

Conform Regulamentului (UE) 2016/679 si legislatiei nationale, beneficiati de: dreptul de acces, dreptul la rectificare, dreptul la stergere sau restrictionare, dreptul la opozitie, dreptul la portabilitate, dreptul de a depune plangere la autoritatea de supraveghere si dreptul de a va adresa justitiei. Pentru exercitarea acestor drepturi, va puteti adresa cu o cerere scrisa, datata si semnata, la adresa de e-mail a companiei indicata mai sus.

Datele dumneavoastra nu vor fi transferate in afara Romaniei de catre operator, prin imputernicitul sau, decat in conditiile prevazute de lege.

CONSIMTAMANT LIBER EXPRIMAT

Prin semnatura de mai jos, declar ca am luat la cunostinta informarile de mai sus si ca am fost informat(a) asupra drepturilor ce imi revin, conform Regulamentului (UE) 2016/679 si legislatiei nationale aplicabile, de catre Reset your body SRL, in calitate de operator.

Declar ca sunt de acord ca datele mele cu caracter personal, inclusiv datele cu caracter medical furnizate in cadrul actului medical, sa fie prelucrate in conditiile descrise in informarea de mai sus.

Prezentul acord este valabil pana la revocarea sa expresa de catre mine, in conditiile legii.`;

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