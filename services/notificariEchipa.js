const pool = require('../db/pool');
const { trimitePush } = require('./push');

// Punct unic pentru crearea unei notificari de echipa: o salveaza si trimite imediat un push
// tuturor celorlalti din echipa - nu si celui care a facut modificarea (nu are rost sa te anunte
// ca ai primit un mesaj nou cand mesajul e chiar al tau).
async function creeazaNotificare({ tip = 'manual', text, pacient_id = null, creat_de }) {
  const { rows } = await pool.query(
    `INSERT INTO notificari_echipa (tip, text, pacient_id, creat_de) VALUES ($1,$2,$3,$4) RETURNING *`,
    [tip, text, pacient_id, creat_de]
  );

  trimitePush({ excludeUtilizatorId: creat_de, titlu: 'Reset - notificare noua', corp: text }).catch(e =>
    console.error('Nu am putut trimite push pentru notificare:', e.message)
  );

  return rows[0];
}

module.exports = { creeazaNotificare };
