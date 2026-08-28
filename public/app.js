let token = localStorage.getItem('reset_token');
let pacientCurent = null;

if (token) aratatApp();

async function login() {
  const email = document.getElementById('login-email').value;
  const parola = document.getElementById('login-parola').value;
  const r = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, parola })
  });
  const data = await r.json();
  if (!r.ok) {
    document.getElementById('login-eroare').textContent = data.eroare;
    return;
  }
  token = data.token;
  localStorage.setItem('reset_token', token);
  aratatApp();
}

function aratatApp() {
  document.getElementById('login').style.display = 'none';
  document.getElementById('app').style.display = 'grid';
  cautaPacienti('');
  aratapanel('calendar');
}

async function apel(cale, optiuni = {}) {
  const r = await fetch(cale, {
    ...optiuni,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(optiuni.headers || {})
    }
  });
  if (r.status === 401) {
    localStorage.removeItem('reset_token');
    location.reload();
  }
  return r.json();
}

async function cautaPacienti(q) {
  const rows = await apel(`/api/pacienti?q=${encodeURIComponent(q)}`);
  const lista = document.getElementById('lista-pacienti');
  lista.innerHTML = rows.map(p => `
    <div class="patient-row" onclick="deschideFisa('${p.id}')">
      <div class="nume">${p.nume} ${p.prenume}</div>
      <div class="info">${p.diagnostic || 'fara diagnostic'}</div>
    </div>
  `).join('');
}

function marcheazaActiv(index) {
  document.querySelectorAll('.top-nav-btn').forEach((b, i) => b.classList.toggle('activ', i === index));
}

function aratapanel(nume) {
  ['fisa', 'calendar', 'statistici'].forEach(p => {
    document.getElementById(`panel-${p}`).style.display = p === nume ? 'block' : 'none';
  });
  const index = { calendar: 0, fisa: 1, statistici: 2 }[nume];
  marcheazaActiv(index);
  if (nume === 'calendar') incarcaCalendarSaptamana();
  if (nume === 'statistici') incarcaStatistici();
}

function aratatFormularPacientNou() {
  ['fisa', 'calendar', 'statistici'].forEach(p => {
    document.getElementById(`panel-${p}`).style.display = p === 'fisa' ? 'block' : 'none';
  });
  marcheazaActiv(1);

  document.getElementById('panel-fisa').innerHTML = `
    <div class="card" style="max-width:420px">
      <h2>Pacient nou</h2>
      <label>Nume</label>
      <input id="nou-nume" style="width:100%;margin-bottom:10px">
      <label>Prenume</label>
      <input id="nou-prenume" style="width:100%;margin-bottom:10px">
      <label>CNP</label>
      <input id="nou-cnp" style="width:100%;margin-bottom:10px">
      <label>Telefon</label>
      <input id="nou-telefon" style="width:100%;margin-bottom:10px" placeholder="07xxxxxxxx">
      <label>Email</label>
      <input id="nou-email" style="width:100%;margin-bottom:10px">
      <label>Diagnostic</label>
      <input id="nou-diagnostic" style="width:100%;margin-bottom:14px">

      <label>Abonament (optional, il poti adauga si mai tarziu)</label>
      <select id="nou-abonament" style="width:100%;margin-bottom:14px">
        <option value="">Fara abonament</option>
        <option value="8">8 sedinte</option>
        <option value="12">12 sedinte</option>
        <option value="individual">Sedinta individuala</option>
      </select>

      <button class="btn" style="width:100%" onclick="salveazaPacientNou()">Salveaza pacient</button>
      <div id="eroare-pacient-nou" style="color:#e08585;font-size:12px;margin-top:8px"></div>
    </div>
  `;
}

async function salveazaPacientNou() {
  const nume = document.getElementById('nou-nume').value.trim();
  const prenume = document.getElementById('nou-prenume').value.trim();
  const cnp = document.getElementById('nou-cnp').value.trim();
  const telefon = document.getElementById('nou-telefon').value.trim();
  const email = document.getElementById('nou-email').value.trim();
  const diagnostic = document.getElementById('nou-diagnostic').value.trim();
  const tipAbonament = document.getElementById('nou-abonament').value;

  const eroareEl = document.getElementById('eroare-pacient-nou');
  eroareEl.textContent = '';

  if (!nume || !prenume) {
    eroareEl.textContent = 'Numele si prenumele sunt obligatorii.';
    return;
  }

  const pacient = await apel('/api/pacienti', {
    method: 'POST',
    body: JSON.stringify({ nume, prenume, cnp: cnp || null, telefon, email, diagnostic })
  });

  if (pacient.eroare) {
    eroareEl.textContent = pacient.eroare;
    return;
  }

  if (tipAbonament) {
    await apel('/api/abonamente', {
      method: 'POST',
      body: JSON.stringify({ pacient_id: pacient.id, tip: tipAbonament })
    });
  }

  cautaPacienti('');
  deschideFisa(pacient.id);
}

async function deschideFisa(id) {
  pacientCurent = id;
  ['fisa', 'calendar', 'statistici'].forEach(p => {
    document.getElementById(`panel-${p}`).style.display = p === 'fisa' ? 'block' : 'none';
  });
  marcheazaActiv(1);

  const data = await apel(`/api/pacienti/${id}`);
  const p = data.pacient;
  const ab = data.abonament;
  const ramase = ab ? ab.total_sedinte - ab.sedinte_efectuate : '-';

  document.getElementById('panel-fisa').innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-size:16px;font-weight:600">${p.nume} ${p.prenume}</div>
          <div style="font-size:13px;color:#9a988e;margin-top:2px">Diagnostic: ${p.diagnostic || '-'}</div>
        </div>
        ${ab ? `<span class="badge">Abonament ${ab.tip} sedinte</span>` : '<span class="badge" style="background:#3a2f1f;color:#e0b85e">Fara abonament</span>'}
      </div>

      <div class="grid-3" style="margin-top:16px">
        <div class="metric"><div class="label">Efectuate</div><div class="value">${ab ? ab.sedinte_efectuate : 0}</div></div>
        <div class="metric"><div class="label">Ramase</div><div class="value">${ramase}</div></div>
        <div class="metric"><div class="label">GDPR</div><div class="value" style="font-size:14px">${data.gdpr_semnat ? 'Semnat' : 'Nesemnat'}</div></div>
      </div>

      ${data.ultima_sedinta ? `
      <div style="border-top:1px solid #3a3937;margin-top:16px;padding-top:12px">
        <div style="font-weight:500;font-size:13px;margin-bottom:6px">Ultima sedinta (${new Date(data.ultima_sedinta.data_ora).toLocaleDateString('ro-RO')})</div>
        <div style="font-size:13px;color:#c9c7bd">Exercitii: ${data.ultima_sedinta.exercitii || '-'}</div>
        <div style="font-size:13px;color:#c9c7bd">Observatii: ${data.ultima_sedinta.observatii || '-'}</div>
      </div>` : ''}

      <div style="border-top:1px solid #3a3937;margin-top:16px;padding-top:12px">
        <div style="font-weight:500;font-size:13px;margin-bottom:8px">Contact</div>
        <div style="font-size:13px">Telefon: ${p.telefon || '-'}</div>
        <div style="font-size:13px">Email: ${p.email || '-'}</div>
      </div>
    </div>
  `;
}

function dataLocala(d) {
  const an = d.getFullYear();
  const luna = String(d.getMonth() + 1).padStart(2, '0');
  const zi = String(d.getDate()).padStart(2, '0');
  return `${an}-${luna}-${zi}`;
}

const ORE_DISPONIBILE = ['07:30', '09:10', '10:50', '12:30', '14:30', '16:10', '17:50'];
const ZILE_SAPTAMANA = ['Luni', 'Marti', 'Miercuri', 'Joi', 'Vineri'];

let saptamanaCurenta = luniAlSaptamanii(dataLocala(new Date()));

function luniAlSaptamanii(dataISO) {
  const d = new Date(dataISO + 'T00:00:00');
  const zi = d.getDay();
  const diff = zi === 0 ? -6 : 1 - zi;
  d.setDate(d.getDate() + diff);
  return dataLocala(d);
}

function adaugaZile(dataISO, nrZile) {
  const d = new Date(dataISO + 'T00:00:00');
  d.setDate(d.getDate() + nrZile);
  return dataLocala(d);
}

function schimbaSaptamana(directie) {
  saptamanaCurenta = adaugaZile(saptamanaCurenta, directie * 7);
  incarcaCalendarSaptamana();
}

function saptamanaAceasta() {
  saptamanaCurenta = luniAlSaptamanii(dataLocala(new Date()));
  incarcaCalendarSaptamana();
}

async function incarcaCalendarSaptamana() {
  const astazi = dataLocala(new Date());
  const zile = [0, 1, 2, 3, 4].map(i => adaugaZile(saptamanaCurenta, i));
  const rows = await apel(`/api/programari?de_la=${zile[0]}&pana_la=${zile[4]}`);

  const pePeriada = {};
  rows.forEach(r => {
    const dataR = r.data_ora.slice(0, 10);
    const oraR = new Date(r.data_ora).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    const cheie = `${dataR}_${oraR}`;
    if (!pePeriada[cheie]) pePeriada[cheie] = {};
    const numeKineto = r.kineto_nume || 'Nealocat';
    if (!pePeriada[cheie][numeKineto]) pePeriada[cheie][numeKineto] = [];
    pePeriada[cheie][numeKineto].push(r);
  });

  const culoareStatus = { programat: '#9a988e', prezent: '#6bcf9b', absent: '#e08585', reprogramat: '#e0b85e' };
  const bordura = '1px solid #3a3937';

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="display:flex;gap:8px">
        <button class="btn" onclick="schimbaSaptamana(-1)">&larr; Saptamana trecuta</button>
        <button class="btn" onclick="saptamanaAceasta()">Azi</button>
        <button class="btn" onclick="schimbaSaptamana(1)">Saptamana urmatoare &rarr;</button>
      </div>
      <button class="btn" onclick="aratatFormularProgramareNoua()">+ Programare noua</button>
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed">
        <tr>
          <th style="text-align:left;padding:10px 8px;font-size:12px;color:#9a988e;width:64px;border:${bordura};background:#1e1e1d">Ora</th>
          ${zile.map((z, i) => `<th style="text-align:left;padding:10px 8px;font-size:12px;color:${z === astazi ? '#1e1e1d' : '#9a988e'};border:${bordura};background:${z === astazi ? '#ece9e2' : '#1e1e1d'}">${ZILE_SAPTAMANA[i]}<br><span style="font-size:11px">${new Date(z).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' })}</span></th>`).join('')}
        </tr>
        ${ORE_DISPONIBILE.map(ora => `
          <tr>
            <td style="padding:8px;font-size:13px;font-weight:500;vertical-align:top;border:${bordura}">${ora}</td>
            ${zile.map(z => {
              const grup = pePeriada[`${z}_${ora}`] || {};
              const kinetoNumele = Object.keys(grup);
              const fundalZi = z === astazi ? 'background:#2c2b28' : '';
              if (kinetoNumele.length === 0) return `<td style="padding:8px;vertical-align:top;border:${bordura};${fundalZi}"></td>`;
              return `<td style="padding:8px;vertical-align:top;border:${bordura};${fundalZi}">
                ${kinetoNumele.map(k => `
                  <div style="margin-bottom:6px">
                    <div style="font-size:11px;color:#9a988e;margin-bottom:2px">${k}</div>
                    ${grup[k].map(p => {
                      const ramase = (p.total_sedinte != null) ? (p.total_sedinte - p.sedinte_efectuate) : '-';
                      return `
                      <div class="pacient-chip" style="border-left:3px solid ${culoareStatus[p.status] || '#9a988e'};margin-bottom:2px;padding:2px 6px">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:4px">
                          <span style="font-size:12px">${p.nume} ${p.prenume}</span>
                          <div style="display:flex;align-items:center;gap:2px">
                            <select onchange="marcheaza('${p.id}', this.value)" style="font-size:10px;padding:1px;background:#1e1e1d;color:#ece9e2;border:1px solid #45443f;border-radius:4px">
                              <option value="programat" ${p.status === 'programat' ? 'selected' : ''} disabled>-</option>
                              <option value="prezent" ${p.status === 'prezent' ? 'selected' : ''}>Efectuat</option>
                              <option value="absent" ${p.status === 'absent' ? 'selected' : ''}>Absent</option>
                            </select>
                            <span style="font-size:10px;cursor:pointer;color:#9a988e" onclick="reprogrameazaPrompt('${p.id}')" title="Reprogrameaza">&#8635;</span>
                          </div>
                        </div>
                        <div class="pacient-tooltip">
                          <div style="font-weight:500;margin-bottom:4px">${p.nume} ${p.prenume}</div>
                          <div>Diagnostic: ${p.diagnostic || '-'}</div>
                          <div>Sedinte efectuate: ${p.sedinte_efectuate ?? '-'}</div>
                          <div>Sedinte ramase: ${ramase}</div>
                        </div>
                      </div>
                    `;
                    }).join('')}
                  </div>
                `).join('')}
              </td>`;
            }).join('')}
          </tr>
        `).join('')}
      </table>
    </div>
  `;

  document.getElementById('panel-calendar').innerHTML = html;
}

let pacientiProgramareCache = [];

async function aratatFormularProgramareNoua() {
  pacientiProgramareCache = await apel('/api/pacienti');
  const kinetoUtilizatori = await apel('/api/utilizatori');

  const html = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:100" onclick="if(event.target===this) inchideModalProgramare()">
      <div class="card" style="max-width:420px;width:90%">
        <h2>Programare noua</h2>

        <label>Pacient</label>
        <input type="text" id="prog-pacient-cautare" placeholder="Scrie numele pacientului..." style="width:100%;margin-bottom:4px" oninput="filtreazaPacientiProgramare(this.value)" autocomplete="off">
        <input type="hidden" id="prog-pacient-id">
        <div id="prog-pacient-rezultate" style="max-height:160px;overflow-y:auto;margin-bottom:10px"></div>

        <label>Kineto</label>
        <select id="prog-kineto" style="width:100%;margin-bottom:10px">
          <option value="">Nealocat</option>
          ${kinetoUtilizatori.map(u => `<option value="${u.id}">${u.nume}</option>`).join('')}
        </select>

        <label>Data</label>
        <input id="prog-data" type="date" style="width:100%;margin-bottom:10px" value="${dataLocala(new Date())}">

        <label>Ora</label>
        <select id="prog-ora" style="width:100%;margin-bottom:14px">
          ${ORE_DISPONIBILE.map(o => `<option value="${o}">${o}</option>`).join('')}
        </select>

        <button class="btn" style="width:100%" onclick="salveazaProgramareNoua()">Salveaza programarea</button>
        <button class="btn secundar" style="width:100%;margin-top:8px" onclick="inchideModalProgramare()">Anuleaza</button>
        <div id="eroare-programare-noua" style="color:#e08585;font-size:12px;margin-top:8px"></div>
      </div>
    </div>
  `;
  document.getElementById('modal-container').innerHTML = html;
}

function filtreazaPacientiProgramare(text) {
  const rezultateEl = document.getElementById('prog-pacient-rezultate');
  document.getElementById('prog-pacient-id').value = '';

  if (!text.trim()) {
    rezultateEl.innerHTML = '';
    return;
  }

  const cautare = text.toLowerCase();
  const gasiti = pacientiProgramareCache.filter(p =>
    `${p.nume} ${p.prenume}`.toLowerCase().includes(cautare)
  ).slice(0, 8);

  rezultateEl.innerHTML = gasiti.map(p => `
    <div style="padding:8px;border-radius:6px;cursor:pointer;font-size:13px" onmouseover="this.style.background='#3a3937'" onmouseout="this.style.background='transparent'" onclick="selecteazaPacientProgramare('${p.id}','${p.nume} ${p.prenume}')">
      ${p.nume} ${p.prenume}
    </div>
  `).join('') || '<div style="padding:8px;font-size:13px;color:#9a988e">Niciun pacient gasit.</div>';
}

function selecteazaPacientProgramare(id, nume) {
  document.getElementById('prog-pacient-id').value = id;
  document.getElementById('prog-pacient-cautare').value = nume;
  document.getElementById('prog-pacient-rezultate').innerHTML = '';
}

function inchideModalProgramare() {
  document.getElementById('modal-container').innerHTML = '';
}

async function salveazaProgramareNoua() {
  const pacient_id = document.getElementById('prog-pacient-id').value;
  const kineto_id = document.getElementById('prog-kineto').value || null;
  const data = document.getElementById('prog-data').value;
  const ora = document.getElementById('prog-ora').value;
  const eroareEl = document.getElementById('eroare-programare-noua');
  eroareEl.textContent = '';

  if (!pacient_id) {
    eroareEl.textContent = 'Cauta si selecteaza un pacient din lista.';
    return;
  }
  if (!data || !ora) {
    eroareEl.textContent = 'Completeaza data si ora.';
    return;
  }

  const data_ora = `${data} ${ora}:00`;
  const rezultat = await apel('/api/programari', {
    method: 'POST',
    body: JSON.stringify({ pacient_id, kineto_id, data_ora })
  });

  if (rezultat.eroare) {
    eroareEl.textContent = rezultat.eroare;
    return;
  }

  inchideModalProgramare();
  incarcaCalendarSaptamana();
}

async function marcheaza(id, status) {
  if (status === 'prezent') {
    const exercitii = prompt('Exercitii facute azi (pe scurt):') || '';
    const observatii = prompt('Observatii:') || '';
    await apel(`/api/programari/${id}/prezent`, { method: 'PATCH', body: JSON.stringify({ exercitii, observatii }) });
  } else {
    await apel(`/api/programari/${id}/absent`, { method: 'PATCH' });
  }
  incarcaCalendarSaptamana();
}

async function reprogrameazaPrompt(id) {
  const dataNoua = prompt('Noua data si ora (YYYY-MM-DD HH:MM):');
  if (!dataNoua) return;
  await apel(`/api/programari/${id}/reprogrameaza`, { method: 'PATCH', body: JSON.stringify({ data_ora_noua: dataNoua }) });
  incarcaCalendarSaptamana();
}

async function incarcaStatistici() {
  const s = await apel('/api/statistici');
  document.getElementById('panel-statistici').innerHTML = `
    <div class="card">
      <h2>Saptamana aceasta</h2>
      <div class="grid-2">
        <div class="metric"><div class="label">Pacienti</div><div class="value">${s.pacienti_saptamana}</div></div>
        <div class="metric"><div class="label">Incasari</div><div class="value">${s.incasari_saptamana} lei</div></div>
      </div>
    </div>
    <div class="card">
      <h2>Luna aceasta</h2>
      <div class="grid-2">
        <div class="metric"><div class="label">Pacienti</div><div class="value">${s.pacienti_luna}</div></div>
        <div class="metric"><div class="label">Incasari</div><div class="value">${s.incasari_luna} lei</div></div>
      </div>
    </div>
    <div class="card">
      <h2>Incasari dupa metoda (luna aceasta)</h2>
      ${s.incasari_dupa_metoda.map(m => `<div style="font-size:13px;margin-bottom:4px">${m.metoda}: ${m.total} lei</div>`).join('') || '<div style="font-size:13px;color:#9a988e">Fara plati inregistrate.</div>'}
    </div>
  `;
}