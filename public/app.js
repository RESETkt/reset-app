let token = localStorage.getItem('reset_token');
let pacientCurent = null;
let pacientEditareAbonamentCurent = '';

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
  aratapanel(sessionStorage.getItem('tabActiv') || 'calendar');
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
  const lista = document.getElementById('lista-pacienti');
  if (!lista) return;
  const arhivati = document.getElementById('toggle-arhivati')?.checked ? '1' : '0';
  const rows = await apel(`/api/pacienti?q=${encodeURIComponent(q)}&arhivati=${arhivati}`);
  lista.innerHTML = rows.map(p => `
    <div class="patient-row" onclick="deschideFisa('${p.id}')">
      <div class="nume">${p.nume} ${p.prenume}</div>
      <div class="info">${p.diagnostic || 'fara diagnostic'}</div>
    </div>
  `).join('') || '<div style="font-size:12px;color:#9a988e;padding:8px">Niciun pacient gasit.</div>';
}

function marcheazaActiv(nume) {
  document.querySelectorAll('.top-nav-btn, .bottom-nav-btn').forEach(b => b.classList.toggle('activ', b.dataset.panel === nume));
}

function aratapanel(nume) {
  sessionStorage.setItem('tabActiv', nume);
  ['fisa', 'calendar', 'echipa', 'statistici'].forEach(p => {
    document.getElementById(`panel-${p}`).style.display = p === nume ? 'block' : 'none';
  });
  marcheazaActiv(nume);
  if (nume === 'calendar') incarcaCalendarSaptamana();
  if (nume === 'echipa') incarcaEchipa();
  if (nume === 'statistici') incarcaStatistici();
  if (nume === 'fisa') aratatListaPacienti();
}

function aratatListaPacienti() {
  document.getElementById('panel-fisa').innerHTML = `
    <div class="card" style="max-width:460px">
      <h2>Pacienti</h2>
      <input id="cautare" placeholder="Cauta pacient" oninput="cautaPacienti(this.value)" style="width:100%;margin-bottom:10px" autofocus>
      <div id="lista-pacienti"></div>
      <label style="display:flex;align-items:center;gap:6px;margin-top:10px;font-size:11px;color:#9a988e;cursor:pointer">
        <input type="checkbox" id="toggle-arhivati" onchange="cautaPacienti(document.getElementById('cautare')?.value || '')" style="width:auto">
        Arata pacientii arhivati
      </label>
    </div>
  `;
  cautaPacienti('');
}

async function incarcaEchipa() {
  const echipa = await apel('/api/utilizatori');
  document.getElementById('panel-echipa').innerHTML = `
    <div class="card" style="max-width:480px">
      <h2>Echipa curenta</h2>
      ${echipa.map(u => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #3a3937">
          <div>
            <div style="font-size:13px;font-weight:500">${u.nume}</div>
            <div style="font-size:11px;color:#9a988e">${u.email} - ${u.rol}</div>
          </div>
          <button class="btn secundar" onclick="stergeKineto('${u.id}','${u.nume}')">Sterge</button>
        </div>
      `).join('') || '<div style="font-size:13px;color:#9a988e">Niciun membru inca.</div>'}
    </div>
    <div class="card" style="max-width:480px">
      <h2>Adauga kineto nou</h2>
      <label>Nume</label>
      <input id="echipa-nume" style="width:100%;margin-bottom:10px">
      <label>Email (folosit la login)</label>
      <input id="echipa-email" type="email" style="width:100%;margin-bottom:10px">
      <label>Parola</label>
      <input id="echipa-parola" type="password" style="width:100%;margin-bottom:14px">
      <button class="btn" style="width:100%" onclick="adaugaKineto()">Adauga in echipa</button>
      <div id="eroare-echipa" style="color:#e08585;font-size:12px;margin-top:8px"></div>
    </div>
  `;
}

async function adaugaKineto() {
  const nume = document.getElementById('echipa-nume').value.trim();
  const email = document.getElementById('echipa-email').value.trim();
  const parola = document.getElementById('echipa-parola').value;
  const eroareEl = document.getElementById('eroare-echipa');
  eroareEl.textContent = '';

  if (!nume || !email || !parola) {
    eroareEl.textContent = 'Completeaza nume, email si parola.';
    return;
  }

  const rezultat = await apel('/api/utilizatori', {
    method: 'POST',
    body: JSON.stringify({ nume, email, parola })
  });

  if (rezultat.eroare) {
    eroareEl.textContent = rezultat.eroare;
    return;
  }

  incarcaEchipa();
}

async function stergeKineto(id, nume) {
  if (!confirm(`Sigur vrei sa stergi \"${nume}\" din echipa? Programarile lui vechi raman, dar devin nealocate.`)) return;
  const rezultat = await apel(`/api/utilizatori/${id}`, { method: 'DELETE' });
  if (rezultat.eroare) {
    alert(rezultat.eroare);
    return;
  }
  incarcaEchipa();
}

function aratatFormularPacientNou() {
  ['fisa', 'calendar', 'echipa', 'statistici'].forEach(p => {
    document.getElementById(`panel-${p}`).style.display = p === 'fisa' ? 'block' : 'none';
  });
  marcheazaActiv('fisa');

  document.getElementById('panel-fisa').innerHTML = `
    <div class="card" style="max-width:420px">
      <h2>Pacient nou</h2>
      <label>Prenume</label>
      <input id="nou-prenume" style="width:100%;margin-bottom:10px">
      <label>Nume</label>
      <input id="nou-nume" style="width:100%;margin-bottom:10px">
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
    body: JSON.stringify({ nume, prenume, telefon, email, diagnostic })
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
  ['fisa', 'calendar', 'echipa', 'statistici'].forEach(p => {
    document.getElementById(`panel-${p}`).style.display = p === 'fisa' ? 'block' : 'none';
  });
  marcheazaActiv('fisa');

  const data = await apel(`/api/pacienti/${id}`);
  const p = data.pacient;
  const ab = data.abonament;
  const ramase = ab ? ab.total_sedinte - ab.sedinte_efectuate : '-';

  document.getElementById('panel-fisa').innerHTML = `
    <div style="margin-bottom:12px">
      <span style="font-size:12px;color:#9a988e;cursor:pointer" onclick="aratatListaPacienti()">&larr; Toti pacientii</span>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-size:16px;font-weight:600">${p.nume} ${p.prenume} ${!p.activ ? '<span style="color:#e0b85e;font-size:12px">(arhivat)</span>' : ''}</div>
          <div style="font-size:13px;color:#9a988e;margin-top:2px">Diagnostic: ${p.diagnostic || '-'}</div>
        </div>
        ${ab ? `<span class="badge">Abonament ${ab.tip} sedinte</span>` : '<span class="badge" style="background:#3a2f1f;color:#e0b85e">Fara abonament</span>'}
      </div>

      <div class="grid-3" style="margin-top:16px">
        <div class="metric"><div class="label">Efectuate</div><div class="value">${ab ? ab.sedinte_efectuate : 0}</div></div>
        <div class="metric"><div class="label">Ramase</div><div class="value">${ramase}</div></div>
        <div class="metric" style="cursor:pointer" onclick="aratatModalGDPR('${id}', ${data.gdpr_semnat}, '${data.gdpr_data || ''}')"><div class="label">GDPR</div><div class="value" style="font-size:14px;text-decoration:underline">${data.gdpr_semnat ? 'Semnat' : 'Nesemnat'}</div></div>
      </div>

      <div style="border-top:1px solid #3a3937;margin-top:16px;padding-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"> <div style="font-weight:500;font-size:13px">${data.ultima_sedinta ? `Ultima sedinta (${new Date(data.ultima_sedinta.data_ora).toLocaleDateString('ro-RO')})` : 'Sedinte'}</div> <button class="btn secundar" onclick="aratatIstoricSedinte('${id}')">Istoric</button> </div>
        ${data.ultima_sedinta ? `
        <div style="font-size:13px;color:#c9c7bd">Exercitii: ${data.ultima_sedinta.exercitii || '-'}</div>
        <div style="font-size:13px;color:#c9c7bd">Observatii: ${data.ultima_sedinta.observatii || '-'}</div>` : '<div style="font-size:13px;color:#9a988e">Nicio sedinta inregistrata inca.</div>'}
      </div>

      <div style="border-top:1px solid #3a3937;margin-top:16px;padding-top:12px">
        <div style="font-weight:500;font-size:13px;margin-bottom:8px">Contact</div>
        <div style="font-size:13px">Telefon: ${p.telefon || '-'}</div>
        <div style="font-size:13px">Email: ${p.email || '-'}</div>
      </div>

      <div style="border-top:1px solid #3a3937;margin-top:16px;padding-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" onclick="aratatFormularEditarePacient('${id}')">Editeaza</button>
        <button class="btn secundar" onclick="aratatConfirmareAbonamentNou('${id}')">Abonament nou (reseteaza sedintele)</button>
        ${p.activ
          ? `<button class="btn secundar" onclick="arhiveazaPacient('${id}')">Arhiveaza</button>`
          : `<button class="btn" onclick="reactiveazaPacient('${id}')">Reactiveaza</button>`}
        <button class="btn secundar" style="color:#e08585" onclick="stergePacientDefinitiv('${id}','${p.nume} ${p.prenume}')">Sterge definitiv</button>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <h2 style="margin:0">Plati</h2>
        <button class="btn" onclick="aratatFormularPlataNoua('${id}')">+ Plata noua</button>
      </div>
      ${data.plati.length === 0 ? '<div style="font-size:13px;color:#9a988e">Nicio plata inregistrata.</div>' : data.plati.map(pl => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #3a3937">
          <div>
            <div style="font-size:13px;font-weight:500">${Number(pl.suma).toFixed(0)} lei - ${pl.metoda === 'cash' ? 'Cash' : 'Card'} (${pl.tip_plata === 'integral' ? 'integral' : 'in rate'})</div>
            <div style="font-size:11px;color:#9a988e">${pl.motiv || 'fara motiv specificat'} - ${new Date(pl.data_plata).toLocaleDateString('ro-RO')}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

let sedinteIstoricCache = [];

async function aratatIstoricSedinte(pacientId) {
  const sedinte = await apel(`/api/pacienti/${pacientId}/sedinte`);
  sedinteIstoricCache = sedinte;
  const html = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:100" onclick="if(event.target===this) inchideModalProgramare()">
      <div class="card" style="max-width:480px;width:90%;max-height:80vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h2 style="margin:0">Istoric sedinte</h2>
          <button class="btn secundar" onclick="aratatFormularSedintaNoua('${pacientId}')">+ Adauga sedinta uitata</button>
        </div>
        ${sedinte.length === 0 ? '<div style="font-size:13px;color:#9a988e;margin-top:10px">Nicio sedinta inregistrata inca.</div>' : sedinte.map(s => `
          <div style="border-bottom:1px solid #3a3937;padding:10px 0">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <div style="font-size:13px;font-weight:500">${new Date(s.data_ora).toLocaleDateString('ro-RO')} ${s.kineto_nume ? `- ${s.kineto_nume}` : ''}</div>
              <span style="font-size:11px;color:#9a988e;cursor:pointer;text-decoration:underline" onclick="aratatFormularEditareSedinta('${pacientId}','${s.id}')">Editeaza</span>
            </div>
            <div style="font-size:13px;color:#c9c7bd">Exercitii: ${s.exercitii || '-'}</div>
            <div style="font-size:13px;color:#c9c7bd">Observatii: ${s.observatii || '-'}</div>
          </div>
        `).join('')}
        <button class="btn secundar" style="width:100%;margin-top:14px" onclick="inchideModalProgramare()">Inchide</button>
      </div>
    </div>
  `;
  document.getElementById('modal-container').innerHTML = html;
}

function aratatFormularEditareSedinta(pacientId, sedintaId) {
  const sedinta = sedinteIstoricCache.find(s => s.id === sedintaId);
  if (!sedinta) return;
  const html = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:110" onclick="if(event.target===this) aratatIstoricSedinte('${pacientId}')">
      <div class="card" style="max-width:420px;width:90%">
        <h2>Editeaza sedinta din ${new Date(sedinta.data_ora).toLocaleDateString('ro-RO')}</h2>
        <label>Exercitii</label>
        <textarea id="istoric-exercitii" rows="3" style="width:100%;margin-bottom:10px">${sedinta.exercitii || ''}</textarea>
        <label>Cum s-a simtit / Observatii</label>
        <textarea id="istoric-observatii" rows="3" style="width:100%;margin-bottom:14px">${sedinta.observatii || ''}</textarea>
        <button class="btn" style="width:100%" onclick="salveazaEditareSedinta('${sedinta.id}','${pacientId}')">Salveaza</button>
        <button class="btn secundar" style="width:100%;margin-top:8px" onclick="aratatIstoricSedinte('${pacientId}')">Anuleaza</button>
      </div>
    </div>
  `;
  document.getElementById('modal-container').innerHTML = html;
}

async function salveazaEditareSedinta(sedintaId, pacientId) {
  const exercitii = document.getElementById('istoric-exercitii').value.trim();
  const observatii = document.getElementById('istoric-observatii').value.trim();
  await apel(`/api/programari/${sedintaId}/editeaza-istoric`, {
    method: 'PATCH',
    body: JSON.stringify({ exercitii, observatii })
  });
  if (pacientCurent === pacientId) deschideFisa(pacientId);
  aratatIstoricSedinte(pacientId);
}

async function aratatFormularSedintaNoua(pacientId) {
  const kinetoUtilizatori = await apel('/api/utilizatori');
  const html = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:110" onclick="if(event.target===this) aratatIstoricSedinte('${pacientId}')">
      <div class="card" style="max-width:420px;width:90%">
        <h2>Adauga sedinta uitata</h2>
        <label>Data sedintei</label>
        <input id="sedinta-noua-data" type="date" style="width:100%;margin-bottom:10px" value="${dataLocala(new Date())}" onclick="this.showPicker && this.showPicker()">
        <label>Kineto</label>
        <select id="sedinta-noua-kineto" style="width:100%;margin-bottom:10px">
          <option value="">Nealocat</option>
          ${kinetoUtilizatori.map(u => `<option value="${u.id}">${u.nume}</option>`).join('')}
        </select>
        <label>Exercitii</label>
        <textarea id="sedinta-noua-exercitii" rows="3" style="width:100%;margin-bottom:10px"></textarea>
        <label>Cum s-a simtit / Observatii</label>
        <textarea id="sedinta-noua-observatii" rows="3" style="width:100%;margin-bottom:14px"></textarea>
        <button class="btn" style="width:100%" onclick="salveazaSedintaNoua('${pacientId}')">Salveaza sedinta</button>
        <button class="btn secundar" style="width:100%;margin-top:8px" onclick="aratatIstoricSedinte('${pacientId}')">Anuleaza</button>
        <div id="eroare-sedinta-noua" style="color:#e08585;font-size:12px;margin-top:8px"></div>
      </div>
    </div>
  `;
  document.getElementById('modal-container').innerHTML = html;
}

async function salveazaSedintaNoua(pacientId) {
  const data = document.getElementById('sedinta-noua-data').value;
  const kineto_id = document.getElementById('sedinta-noua-kineto').value || null;
  const exercitii = document.getElementById('sedinta-noua-exercitii').value.trim();
  const observatii = document.getElementById('sedinta-noua-observatii').value.trim();
  const eroareEl = document.getElementById('eroare-sedinta-noua');
  eroareEl.textContent = '';

  if (!data) {
    eroareEl.textContent = 'Alege data sedintei.';
    return;
  }

  const rezultat = await apel('/api/programari/sedinta-trecuta', {
    method: 'POST',
    body: JSON.stringify({ pacient_id: pacientId, kineto_id, data_ora: `${data} 12:00:00`, exercitii, observatii })
  });

  if (rezultat.eroare) {
    eroareEl.textContent = rezultat.eroare;
    return;
  }

  if (pacientCurent === pacientId) deschideFisa(pacientId);
  aratatIstoricSedinte(pacientId);
}

async function aratatModalGDPR(pacientId, dejaSemnat, dataSemnare) {
  if (dejaSemnat) {
    const html = `
      <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:100" onclick="if(event.target===this) inchideModalProgramare()">
        <div class="card" style="max-width:400px;width:90%">
          <h2>GDPR</h2>
          <div style="font-size:13px;color:#c9c7bd">Consimtamantul a fost deja semnat pe ${dataSemnare ? new Date(dataSemnare).toLocaleDateString('ro-RO') : '-'}.</div>
          <button class="btn secundar" style="width:100%;margin-top:14px" onclick="inchideModalProgramare()">Inchide</button>
        </div>
      </div>
    `;
    document.getElementById('modal-container').innerHTML = html;
    return;
  }

  const gdprText = await apel('/api/gdpr/text');

  const html = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 12px;z-index:100" onclick="if(event.target===this) inchideModalProgramare()">
      <div class="card" style="max-width:420px;width:90%;max-height:calc(100vh - 48px);overflow-y:auto;display:flex;flex-direction:column">
        <h2 style="margin-top:0">Consimtamant GDPR</h2>
        <div style="font-size:13px;color:#c9c7bd;margin-bottom:14px;line-height:1.6;white-space:pre-line;max-height:240px;overflow-y:auto;padding-right:6px;border:1px solid #3a3937;border-radius:8px;padding:10px">${gdprText.text}</div>
        <label>Semnatura</label>
        <canvas id="canvas-gdpr-dashboard" style="border:1px dashed #45443f;border-radius:8px;width:100%;height:140px;touch-action:none;background:#1e1e1d"></canvas>
        <button class="btn" style="width:100%;margin-top:10px" onclick="trimiteSemnaturaGDPR('${pacientId}')">Confirma semnatura</button>
        <button class="btn secundar" style="width:100%;margin-top:8px" onclick="stergeCanvasGDPR()">Sterge semnatura</button>
        <button class="btn secundar" style="width:100%;margin-top:8px" onclick="inchideModalProgramare()">Anuleaza</button>
        <div id="eroare-gdpr" style="color:#e08585;font-size:12px;margin-top:8px"></div>
      </div>
    </div>
  `;
  document.getElementById('modal-container').innerHTML = html;
  pregatesteCanvasGDPR();
}

function pregatesteCanvasGDPR() {
  const canvas = document.getElementById('canvas-gdpr-dashboard');
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#ece9e2';

  let deseneaza = false;
  const pozitie = (e) => {
    const rect = canvas.getBoundingClientRect();
    const punct = e.touches ? e.touches[0] : e;
    return { x: punct.clientX - rect.left, y: punct.clientY - rect.top };
  };
  const start = (e) => { deseneaza = true; const p = pozitie(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const muta = (e) => { if (!deseneaza) return; const p = pozitie(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); };
  const stop = () => { deseneaza = false; };

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', muta);
  window.addEventListener('mouseup', stop);
  canvas.addEventListener('touchstart', start);
  canvas.addEventListener('touchmove', muta);
  canvas.addEventListener('touchend', stop);
}

function stergeCanvasGDPR() {
  const canvas = document.getElementById('canvas-gdpr-dashboard');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function canvasGDPREsteGol() {
  const canvas = document.getElementById('canvas-gdpr-dashboard');
  const ctx = canvas.getContext('2d');
  const date = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  return !date.some((valoare, i) => i % 4 === 3 && valoare !== 0);
}

async function trimiteSemnaturaGDPR(pacientId) {
  const eroareEl = document.getElementById('eroare-gdpr');
  eroareEl.textContent = '';

  if (canvasGDPREsteGol()) {
    eroareEl.textContent = 'Semneaza inainte de a confirma.';
    return;
  }

  const semnatura_svg = document.getElementById('canvas-gdpr-dashboard').toDataURL();
  const rezultat = await apel(`/api/gdpr/${pacientId}`, {
    method: 'POST',
    body: JSON.stringify({ semnatura_svg })
  });

  if (rezultat.eroare) {
    eroareEl.textContent = rezultat.eroare;
    return;
  }

  inchideModalProgramare();
  deschideFisa(pacientId);
}

function aratatFormularEditarePacient(id) {
  apel(`/api/pacienti/${id}`).then(data => {
    const p = data.pacient;
    const ab = data.abonament;
    pacientEditareAbonamentCurent = ab ? ab.tip : '';
    const html = `
      <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:100" onclick="if(event.target===this) inchideModalProgramare()">
        <div class="card" style="max-width:400px;width:90%">
          <h2>Editeaza pacient</h2>
          <label>Prenume</label>
          <input id="edit-prenume" value="${p.prenume}" style="width:100%;margin-bottom:10px">
          <label>Nume</label>
          <input id="edit-nume" value="${p.nume}" style="width:100%;margin-bottom:10px">
          <label>Telefon</label>
          <input id="edit-telefon" value="${p.telefon || ''}" style="width:100%;margin-bottom:10px">
          <label>Email</label>
          <input id="edit-email" value="${p.email || ''}" style="width:100%;margin-bottom:10px">
          <label>Diagnostic</label>
          <input id="edit-diagnostic" value="${p.diagnostic || ''}" style="width:100%;margin-bottom:14px">
          <label>Abonament</label>
          <div id="abonament-bara" class="abonament-bara ${ab ? '' : 'cta'}" onclick="toggleAbonamentOptiuni()">
            <span id="abonament-bara-text">${ab ? `Abonament ${textAbonament(ab.tip)}` : '+ Adauga abonament'}</span>
            ${ab ? '<span class="abonament-bara-schimba">Schimba</span>' : ''}
          </div>
          <div id="abonament-optiuni" class="abonament-optiuni" style="display:none">
            <div class="abonament-optiune ${ab && ab.tip === '8' ? 'activ' : ''}" onclick="selecteazaAbonament('8')">8 sedinte</div>
            <div class="abonament-optiune ${ab && ab.tip === '12' ? 'activ' : ''}" onclick="selecteazaAbonament('12')">12 sedinte</div>
            <div class="abonament-optiune ${ab && ab.tip === 'individual' ? 'activ' : ''}" onclick="selecteazaAbonament('individual')">Sedinta individuala</div>
          </div>
          <input type="hidden" id="edit-abonament" value="${ab ? ab.tip : ''}">
          <div id="abonament-info" style="font-size:12px;color:#9a988e;margin-top:6px;margin-bottom:14px">${ab ? `Are deja ${ab.sedinte_efectuate}/${ab.total_sedinte} sedinte efectuate.` : 'Pacientul nu are niciun abonament momentan.'}</div>
          <button class="btn" style="width:100%" onclick="salveazaEditarePacient('${id}')">Salveaza</button>
          <button class="btn secundar" style="width:100%;margin-top:8px" onclick="inchideModalProgramare()">Anuleaza</button>
        </div>
      </div>
    `;
    document.getElementById('modal-container').innerHTML = html;
  });
}

function textAbonament(tip) {
  return tip === '8' ? '8 sedinte' : tip === '12' ? '12 sedinte' : tip === 'individual' ? 'Sedinta individuala' : '';
}

function toggleAbonamentOptiuni() {
  const optiuni = document.getElementById('abonament-optiuni');
  optiuni.style.display = optiuni.style.display === 'none' ? 'flex' : 'none';
}

function selecteazaAbonament(tip) {
  document.getElementById('edit-abonament').value = tip;
  document.querySelectorAll('.abonament-optiune').forEach(el => el.classList.remove('activ'));
  event.currentTarget.classList.add('activ');

  const bara = document.getElementById('abonament-bara');
  bara.classList.remove('cta');
  document.getElementById('abonament-bara-text').textContent = `Abonament ${textAbonament(tip)}`;
  if (!bara.querySelector('.abonament-bara-schimba')) {
    bara.insertAdjacentHTML('beforeend', '<span class="abonament-bara-schimba">Schimba</span>');
  }
  document.getElementById('abonament-optiuni').style.display = 'none';

  const info = document.getElementById('abonament-info');
  info.textContent = tip === pacientEditareAbonamentCurent
    ? info.textContent
    : (pacientEditareAbonamentCurent
      ? 'Atentie: schimbarea tipului de abonament reseteaza la 0 contorul de sedinte efectuate.'
      : `Se va crea un abonament nou de ${textAbonament(tip)}.`);
}

async function salveazaEditarePacient(id) {
  const nume = document.getElementById('edit-nume').value.trim();
  const prenume = document.getElementById('edit-prenume').value.trim();
  const telefon = document.getElementById('edit-telefon').value.trim();
  const email = document.getElementById('edit-email').value.trim();
  const diagnostic = document.getElementById('edit-diagnostic').value.trim();
  const abonamentEl = document.getElementById('edit-abonament');
  const tipAbonament = abonamentEl ? abonamentEl.value : '';

  await apel(`/api/pacienti/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ nume, prenume, telefon, email, diagnostic })
  });

  if (tipAbonament && tipAbonament !== pacientEditareAbonamentCurent) {
    await apel('/api/abonamente', {
      method: 'POST',
      body: JSON.stringify({ pacient_id: id, tip: tipAbonament })
    });
  }

  inchideModalProgramare();
  cautaPacienti(document.getElementById('cautare')?.value || '');
  deschideFisa(id);
}

async function arhiveazaPacient(id) {
  if (!confirm('Arhivezi acest pacient? Nu va mai aparea in lista activa, dar tot istoricul lui ramane salvat.')) return;
  await apel(`/api/pacienti/${id}/arhiveaza`, { method: 'PATCH' });
  cautaPacienti(document.getElementById('cautare')?.value || '');
  deschideFisa(id);
}

async function reactiveazaPacient(id) {
  await apel(`/api/pacienti/${id}/reactiveaza`, { method: 'PATCH' });
  cautaPacienti(document.getElementById('cautare')?.value || '');
  deschideFisa(id);
}

async function stergePacientDefinitiv(id, nume) {
  if (!confirm(`ATENTIE: stergi definitiv pe "${nume}" - se sterg si toate programarile, platile si abonamentele lui. Nu se mai poate recupera. Esti sigur?`)) return;
  await apel(`/api/pacienti/${id}`, { method: 'DELETE' });
  cautaPacienti(document.getElementById('cautare')?.value || '');
  document.getElementById('panel-fisa').innerHTML = '<div class="card">Pacient sters.</div>';
}

function aratatConfirmareAbonamentNou(pacientId) {
  const html = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:100" onclick="if(event.target===this) inchideModalProgramare()">
      <div class="card" style="max-width:380px;width:90%">
        <h2>Abonament nou</h2>
        <div style="font-size:13px;color:#c9c7bd;margin-bottom:14px">Atentie: aceasta actiune inchide abonamentul curent si porneste unul nou, cu sedintele efectuate resetate la 0. Foloseste doar cand pacientul chiar incepe un abonament nou (nu la o plata obisnuita in mijlocul abonamentului).</div>
        <label>Tip abonament nou</label>
        <select id="abonament-nou-tip" style="width:100%;margin-bottom:14px">
          <option value="8">8 sedinte</option>
          <option value="12">12 sedinte</option>
          <option value="individual">Sedinta individuala</option>
        </select>
        <button class="btn" style="width:100%" onclick="confirmaAbonamentNou('${pacientId}')">Da, porneste abonament nou</button>
        <button class="btn secundar" style="width:100%;margin-top:8px" onclick="inchideModalProgramare()">Anuleaza</button>
      </div>
    </div>
  `;
  document.getElementById('modal-container').innerHTML = html;
}

async function confirmaAbonamentNou(pacientId) {
  const tip = document.getElementById('abonament-nou-tip').value;
  await apel('/api/abonamente', {
    method: 'POST',
    body: JSON.stringify({ pacient_id: pacientId, tip })
  });
  inchideModalProgramare();
  deschideFisa(pacientId);
}

async function aratatFormularPlataNoua(pacientId) {
  const html = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:100" onclick="if(event.target===this) inchideModalProgramare()">
      <div class="card" style="max-width:380px;width:90%">
        <h2>Plata noua</h2>

        <label>Suma (lei)</label>
        <input id="plata-suma" type="number" step="1" style="width:100%;margin-bottom:10px">

        <label>Metoda</label>
        <select id="plata-metoda" style="width:100%;margin-bottom:10px">
          <option value="cash">Cash</option>
          <option value="card">Card</option>
        </select>

        <label>Tip</label>
        <select id="plata-tip" style="width:100%;margin-bottom:10px">
          <option value="integral">Integral</option>
          <option value="rate">In rate</option>
        </select>

        <label>Motiv</label>
        <select id="plata-motiv-select" style="width:100%;margin-bottom:6px" onchange="schimbaMotivPlata(this.value)">
          <option value="8">Abonament 8 sedinte</option>
          <option value="12">Abonament 12 sedinte</option>
          <option value="individual">Sedinta individuala</option>
          <option value="altceva">Altceva (scriu eu)</option>
        </select>
        <input id="plata-motiv-liber" placeholder="Descrie motivul" style="width:100%;margin-bottom:10px;display:none">

        <label>Data platii</label>
        <input id="plata-data" type="date" style="width:100%;margin-bottom:14px" value="${dataLocala(new Date())}" onclick="this.showPicker && this.showPicker()">

        <button class="btn" style="width:100%" onclick="salveazaPlataNoua('${pacientId}')">Salveaza plata</button>
        <button class="btn secundar" style="width:100%;margin-top:8px" onclick="inchideModalProgramare()">Anuleaza</button>
        <div id="eroare-plata-noua" style="color:#e08585;font-size:12px;margin-top:8px"></div>
      </div>
    </div>
  `;
  document.getElementById('modal-container').innerHTML = html;
}

function schimbaMotivPlata(valoare) {
  document.getElementById('plata-motiv-liber').style.display = valoare === 'altceva' ? 'block' : 'none';
}

async function salveazaPlataNoua(pacientId) {
  const suma = document.getElementById('plata-suma').value;
  const metoda = document.getElementById('plata-metoda').value;
  const tip_plata = document.getElementById('plata-tip').value;
  const motivSelect = document.getElementById('plata-motiv-select').value;
  const data = document.getElementById('plata-data').value;
  const eroareEl = document.getElementById('eroare-plata-noua');
  eroareEl.textContent = '';

  if (!suma || Number(suma) <= 0) {
    eroareEl.textContent = 'Introdu o suma valida.';
    return;
  }

  const NUME_MOTIV = { '8': 'Abonament 8 sedinte', '12': 'Abonament 12 sedinte', individual: 'Sedinta individuala' };
  const motiv = motivSelect === 'altceva' ? document.getElementById('plata-motiv-liber').value.trim() : NUME_MOTIV[motivSelect];

  const rezultat = await apel(`/api/pacienti/${pacientId}/plati`, {
    method: 'POST',
    body: JSON.stringify({ suma, metoda, tip_plata, motiv, data_plata: data })
  });

  if (rezultat.eroare) {
    eroareEl.textContent = rezultat.eroare;
    return;
  }

  inchideModalProgramare();
  deschideFisa(pacientId);
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

const LUNI_RO = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];

function schimbaLuna(directie) {
  const d = new Date(saptamanaCurenta + 'T00:00:00');
  d.setMonth(d.getMonth() + directie, 15);
  saptamanaCurenta = luniAlSaptamanii(dataLocala(d));
  incarcaCalendarSaptamana();
}

function esteMobil() {
  return window.innerWidth <= 768;
}

async function incarcaCalendarSaptamana() {
  if (esteMobil()) return incarcaCalendarZi();
  const astazi = dataLocala(new Date());
  const zile = [0, 1, 2, 3, 4].map(i => adaugaZile(saptamanaCurenta, i));
  const rows = await apel(`/api/programari?de_la=${zile[0]}&pana_la=${zile[4]}`);

  const pePeriada = {};
  rows.forEach(r => {
    const dataR = r.data_ora.slice(0, 10);
    const oraR = new Date(r.data_ora).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    const cheie = `${dataR}_${oraR}`;
    if (!pePeriada[cheie]) pePeriada[cheie] = [];
    pePeriada[cheie].push(r);
  });

  const culoareStatus = { programat: '#9a988e', prezent: '#6bcf9b', absent: '#e08585', reprogramat: '#e0b85e' };
  const bordura = '1px solid #3a3937';
  const dataCurenta = new Date(saptamanaCurenta + 'T00:00:00');

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="display:flex;gap:8px">
          <button class="btn" onclick="schimbaSaptamana(-1)">&larr; Saptamana trecuta</button>
          <button class="btn" onclick="saptamanaAceasta()">Azi</button>
          <button class="btn" onclick="schimbaSaptamana(1)">Saptamana urmatoare &rarr;</button>
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#9a988e">
          <span style="cursor:pointer;padding:2px 4px" onclick="schimbaLuna(-1)" title="Luna anterioara">&larr;</span>
          <span style="min-width:90px;text-align:center">${LUNI_RO[dataCurenta.getMonth()]} ${dataCurenta.getFullYear()}</span>
          <span style="cursor:pointer;padding:2px 4px" onclick="schimbaLuna(1)" title="Luna urmatoare">&rarr;</span>
        </div>
      </div>
      <button class="btn" onclick="aratatFormularProgramareNoua(null, null)">+ Programare noua</button>
    </div>
    <div class="card" style="padding:0;background:#ffffff;border-color:#dcdad4">
      <table style="border-collapse:collapse;table-layout:fixed">
        <tr>
          <th style="text-align:left;padding:10px 8px;font-size:12px;color:#6b6a63;width:70px;border:1px solid #e2e0d9;background:#f4f3ef">Ora</th>
          ${zile.map((z, i) => `<th style="text-align:left;padding:10px 8px;font-size:12px;color:${z === astazi ? '#ffffff' : '#6b6a63'};border:1px solid #e2e0d9;background:${z === astazi ? '#1f8a7a' : '#f4f3ef'};width:270px">${ZILE_SAPTAMANA[i]}<br><span style="font-size:11px">${new Date(z).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' })}</span></th>`).join('')}
        </tr>
        ${ORE_DISPONIBILE.map(ora => `
          <tr>
            <td style="padding:8px;font-size:13px;font-weight:500;vertical-align:top;border:1px solid #e2e0d9;background:#e6f2ef;color:#175e52">
              <div class="ora-cell">
                ${ora}
                <div class="ora-add-btn" onclick="aratatFormularProgramareNoua(null,'${ora}')">+ adauga</div>
              </div>
            </td>
            ${zile.map(z => {
              const toate = pePeriada[`${z}_${ora}`] || [];
              const randuri = [];
              for (let i = 0; i < toate.length; i += 3) randuri.push(toate.slice(i, i + 3));
              const fundalZi = z === astazi ? 'background:#eafaf6' : 'background:#ffffff';
              return `<td style="padding:6px 8px;vertical-align:top;border:1px solid #e2e0d9;${fundalZi}">
                ${randuri.map((rand, idx) => `
                  <div style="display:flex;gap:6px;padding:4px 0;${idx < randuri.length - 1 ? 'border-bottom:1px solid #eae8e1' : ''}">
                    ${rand.map(p => randPacientRand(p, culoareStatus)).join('')}
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

let ziuaMobilCurenta = dataLocala(new Date());

function ziLucratoareVecina(dataISO, directie) {
  let d = adaugaZile(dataISO, directie);
  let zi = new Date(d + 'T00:00:00').getDay();
  while (zi === 0 || zi === 6) {
    d = adaugaZile(d, directie);
    zi = new Date(d + 'T00:00:00').getDay();
  }
  return d;
}

function schimbaZiuaMobil(directie) {
  ziuaMobilCurenta = ziLucratoareVecina(ziuaMobilCurenta, directie);
  incarcaCalendarZi();
}

function ziuaMobilAstazi() {
  ziuaMobilCurenta = dataLocala(new Date());
  incarcaCalendarZi();
}

function schimbaZiuaMobilData(valoare) {
  ziuaMobilCurenta = valoare;
  incarcaCalendarZi();
}

async function incarcaCalendarZi() {
  const astazi = dataLocala(new Date());
  const d = new Date(ziuaMobilCurenta + 'T00:00:00');
  const ziSaptamanii = d.getDay();
  const esteWeekendZi = ziSaptamanii === 0 || ziSaptamanii === 6;
  const numeZi = !esteWeekendZi ? ZILE_SAPTAMANA[ziSaptamanii - 1] : (ziSaptamanii === 0 ? 'Duminica' : 'Sambata');

  const rows = esteWeekendZi ? [] : await apel(`/api/programari?de_la=${ziuaMobilCurenta}&pana_la=${ziuaMobilCurenta}`);

  const peOra = {};
  rows.forEach(r => {
    const oraR = new Date(r.data_ora).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    if (!peOra[oraR]) peOra[oraR] = [];
    peOra[oraR].push(r);
  });

  const html = `
    <div class="day-nav">
      <button class="btn day-nav-arrow" onclick="schimbaZiuaMobil(-1)">&larr;</button>
      <div class="day-nav-info">
        <div class="day-nav-titlu">${numeZi}, ${d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'long' })}</div>
        ${ziuaMobilCurenta === astazi ? '<div class="day-nav-azi">azi</div>' : '<div class="day-nav-azi clickabil" onclick="ziuaMobilAstazi()">&larr; inapoi la azi</div>'}
      </div>
      <button class="btn day-nav-arrow" onclick="schimbaZiuaMobil(1)">&rarr;</button>
    </div>
    <input type="date" class="day-nav-date-input" value="${ziuaMobilCurenta}" onchange="schimbaZiuaMobilData(this.value)" onclick="this.showPicker && this.showPicker()">
    <button class="btn" style="width:100%;margin:10px 0" onclick="aratatFormularProgramareNoua('${ziuaMobilCurenta}', null)">+ Programare noua</button>
    ${esteWeekendZi
      ? '<div class="card" style="text-align:center;color:#9a988e;font-size:13px">Cabinetul este inchis in weekend.</div>'
      : `<div class="day-view">
          ${ORE_DISPONIBILE.map(ora => {
            const toate = peOra[ora] || [];
            return `
              <div class="day-view-row">
                <div class="day-view-ora">${ora}</div>
                <div class="day-view-chips">
                  ${toate.map(p => randPacientRand(p)).join('')}
                  <span class="day-view-add" onclick="aratatFormularProgramareNoua('${ziuaMobilCurenta}','${ora}')">+ adauga</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>`}
  `;

  document.getElementById('panel-calendar').innerHTML = html;
}

function randPacientRand(p) {
  const ramase = (p.total_sedinte != null) ? (p.total_sedinte - p.sedinte_efectuate) : '-';
  const culoareStatusDeschis = { programat: '#8a8880', prezent: '#1f8a5a', absent: '#c14343', reprogramat: '#b8860b' };
  const tooltipId = `tooltip-${p.id}`;
  return `
    <div class="pacient-chip" style="display:inline-flex;align-items:center;gap:2px;border:1px solid #d8d6cd;border-radius:4px;padding:1px 3px;background:#f6f5f1">
      <span style="font-size:12px;cursor:pointer;max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${culoareStatusDeschis[p.status] || '#2b2a26'};font-weight:600" onclick="toggleMeniuStatus('${p.id}')">${p.prenume}</span>
      <span style="font-size:11px;cursor:pointer;color:#9a988e;padding:0 2px" onclick="toggleInfoChip('${tooltipId}')" title="Detalii">&#9432;</span>
      <span style="font-size:11px;cursor:pointer;color:#9a988e;padding:0 2px" onclick="aratatMeniuProgramare('${p.id}','${p.prenume}')" title="Editeaza programarea">&#9998;</span>
      <div id="status-meniu-${p.id}" style="display:none;position:absolute;top:100%;left:0;z-index:60;background:#ffffff;border:1px solid #d8d6cd;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.15);min-width:90px;overflow:hidden">
        <div style="padding:7px 12px;font-size:12px;color:#1f8a5a;cursor:pointer;white-space:nowrap" onclick="marcheaza('${p.id}','prezent')">Prezent</div>
        <div style="padding:7px 12px;font-size:12px;color:#c14343;cursor:pointer;white-space:nowrap;border-top:1px solid #eae8e1" onclick="marcheaza('${p.id}','absent')">Absent</div>
      </div>
      <div id="${tooltipId}" class="pacient-tooltip">
        <div style="font-weight:500;margin-bottom:4px">${p.nume} ${p.prenume}</div>
        <div>Kineto: ${p.kineto_nume || 'Nealocat'}</div>
        <div>Diagnostic: ${p.diagnostic || '-'}</div>
        <div>Sedinte efectuate: ${p.sedinte_efectuate ?? '-'}</div>
        <div>Sedinte ramase: ${ramase}</div>
      </div>
    </div>
  `;
}

function toggleMeniuStatus(id) {
  const el = document.getElementById(`status-meniu-${id}`);
  const eraDeschis = el.style.display === 'block';
  document.querySelectorAll('[id^="status-meniu-"]').forEach(m => m.style.display = 'none');
  el.style.display = eraDeschis ? 'none' : 'block';
}

function toggleInfoChip(id) {
  const el = document.getElementById(id);
  const eraVizibil = el.classList.contains('vizibil');
  document.querySelectorAll('.pacient-tooltip.vizibil').forEach(t => t.classList.remove('vizibil'));
  el.classList.toggle('vizibil', !eraVizibil);
}

let pacientiProgramareCache = [];

async function aratatFormularProgramareNoua(dataPresetata, oraPresetata) {
  pacientiProgramareCache = await apel('/api/pacienti');
  const kinetoUtilizatori = await apel('/api/utilizatori');

  const html = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:100" onclick="if(event.target===this) inchideModalProgramare()">
      <div class="card" style="max-width:420px;width:90%">
        <h2>Programare noua</h2>

        <label>Pacient</label>
        <input type="text" id="prog-pacient-cautare" placeholder="Scrie numele pacientului..." style="width:100%;margin-bottom:4px" oninput="filtreazaPacientiProgramare(this.value)" onfocus="filtreazaPacientiProgramare(this.value)" autocomplete="off">
        <input type="hidden" id="prog-pacient-id">
        <div id="prog-pacient-rezultate" style="max-height:160px;overflow-y:auto;margin-bottom:10px"></div>

        <label>Kineto</label>
        <select id="prog-kineto" style="width:100%;margin-bottom:10px">
          <option value="">Nealocat</option>
          ${kinetoUtilizatori.map(u => `<option value="${u.id}">${u.nume}</option>`).join('')}
        </select>

        <label>Data</label>
        <input id="prog-data" type="date" style="width:100%;margin-bottom:10px" value="${dataPresetata || dataLocala(new Date())}" onclick="this.showPicker && this.showPicker()">

        <label>Ora</label>
        <select id="prog-ora" style="width:100%;margin-bottom:14px">
          ${ORE_DISPONIBILE.map(o => `<option value="${o}" ${o === oraPresetata ? 'selected' : ''}>${o}</option>`).join('')}
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

  const cautare = text.toLowerCase().trim();
  const gasiti = (cautare
    ? pacientiProgramareCache.filter(p => `${p.nume} ${p.prenume}`.toLowerCase().includes(cautare))
    : pacientiProgramareCache
  ).slice(0, 20);

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
const ziSaptamanii = new Date(data + 'T00:00:00').getDay(); if (ziSaptamanii === 0 || ziSaptamanii === 6) { eroareEl.textContent = 'Nu se pot face programari sambata sau duminica.'; return; }

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

function aratatMeniuProgramare(id, prenume) {
  const html = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:100" onclick="if(event.target===this) inchideModalProgramare()">
      <div class="card" style="max-width:360px;width:90%">
        <h2>Programare - ${prenume}</h2>
        <label>Data noua</label>
        <input id="reprog-data" type="date" style="width:100%;margin-bottom:10px" value="${dataLocala(new Date())}" onclick="this.showPicker && this.showPicker()">
        <label>Ora noua</label>
        <select id="reprog-ora" style="width:100%;margin-bottom:14px">
          ${ORE_DISPONIBILE.map(o => `<option value="${o}">${o}</option>`).join('')}
        </select>
        <button class="btn" style="width:100%" onclick="salveazaReprogramare('${id}')">Reprogrameaza</button>
        <button class="btn secundar" style="width:100%;margin-top:8px;color:#e08585" onclick="stergeProgramare('${id}')">Sterge programarea</button>
        <button class="btn secundar" style="width:100%;margin-top:8px" onclick="inchideModalProgramare()">Inchide</button>
      </div>
    </div>
  `;
  document.getElementById('modal-container').innerHTML = html;
}

async function salveazaReprogramare(id) {
  const data = document.getElementById('reprog-data').value;
  const ora = document.getElementById('reprog-ora').value;
  if (!data || !ora) return;
  const ziSaptamanii = new Date(data + 'T00:00:00').getDay();
  if (ziSaptamanii === 0 || ziSaptamanii === 6) {
    alert('Nu se pot face programari sambata sau duminica.');
    return;
  }
  const data_ora_noua = `${data} ${ora}:00`;
  const rezultat = await apel(`/api/programari/${id}/reprogrameaza`, { method: 'PATCH', body: JSON.stringify({ data_ora_noua }) });
  if (rezultat.eroare) {
    alert(rezultat.eroare);
    return;
  }
  inchideModalProgramare();
  incarcaCalendarSaptamana();
}

async function stergeProgramare(id) {
  if (!confirm('Sigur stergi aceasta programare?')) return;
  await apel(`/api/programari/${id}`, { method: 'DELETE' });
  inchideModalProgramare();
  incarcaCalendarSaptamana();
}

let sumeDeblocate = false;
const LUNI_RO_STATS = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];

async function incarcaStatistici() {
  const s = await apel('/api/statistici');
  const acum = new Date();
  document.getElementById('panel-statistici').innerHTML = `
    <div class="card">
      <h2>Saptamana aceasta</h2>
      <div class="grid-2">
        <div class="metric"><div class="label">Pacienti</div><div class="value">${s.pacienti_saptamana}</div></div>
        <div class="metric"><div class="label">Incasari</div><div class="value">${sumeDeblocate ? s.incasari_saptamana + ' lei' : '••• lei'}</div></div>
      </div>
    </div>
    <div class="card">
      <h2>Luna aceasta</h2>
      <div class="grid-2">
        <div class="metric"><div class="label">Pacienti</div><div class="value">${s.pacienti_luna}</div></div>
        <div class="metric"><div class="label">Incasari</div><div class="value">${sumeDeblocate ? s.incasari_luna + ' lei' : '••• lei'}</div></div>
      </div>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <h2 style="margin:0">Incasari dupa metoda (luna aceasta)</h2>
        <button class="btn" onclick="${sumeDeblocate ? 'blocheazaSume()' : 'cereParolaSume()'}">${sumeDeblocate ? 'Blocheaza sumele' : 'Arata sumele'}</button>
      </div>
      ${sumeDeblocate
        ? (s.incasari_dupa_metoda.map(m => `<div style="font-size:13px;margin-bottom:4px">${m.metoda}: ${m.total} lei</div>`).join('') || '<div style="font-size:13px;color:#9a988e">Fara plati inregistrate.</div>')
        : '<div style="font-size:13px;color:#9a988e">Sumele sunt ascunse. Apasa "Arata sumele" pentru a le vedea.</div>'}
      <div id="eroare-parola-sume" style="color:#e08585;font-size:12px;margin-top:8px"></div>

      <div style="border-top:1px solid #3a3937;margin-top:16px;padding-top:12px">
        <div style="font-weight:500;font-size:13px;margin-bottom:8px">Descarca raport PDF</div>
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <select id="pdf-luna" style="flex:1">
            ${LUNI_RO_STATS.map((l, i) => `<option value="${i + 1}" ${i === acum.getMonth() ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
          <input id="pdf-an" type="number" value="${acum.getFullYear()}" style="width:90px">
        </div>
        <button class="btn secundar" style="width:100%" onclick="descarcaPdfStatistici()">Descarca PDF</button>
      </div>
    </div>
  `;
}

async function descarcaPdfStatistici() {
  const luna = document.getElementById('pdf-luna').value;
  const an = document.getElementById('pdf-an').value;

  if (!sumeDeblocate) {
    cereParolaSume();
    if (!sumeDeblocate) return;
  }

  const r = await fetch(`/api/statistici/pdf?an=${an}&luna=${luna}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) {
    alert('Eroare la generarea raportului PDF.');
    return;
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `raport-${luna}-${an}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function cereParolaSume() {
  const parola = prompt('Introdu parola pentru a vedea sumele incasate:');
  if (parola === null) return;
  if (parola === 'Reset2020cash') {
    sumeDeblocate = true;
    incarcaStatistici();
  } else {
    alert('Parola gresita.');
  }
}

function blocheazaSume() {
  sumeDeblocate = false;
  incarcaStatistici();
}

function delogare() {
  localStorage.removeItem('reset_token');
  sessionStorage.removeItem('tabActiv');
  location.reload();
}

let swipeStartX = null;
let swipeStartY = null;

function initSwipeCalendar() {
  const el = document.getElementById('panel-calendar');
  if (!el || el.dataset.swipeInit) return;
  el.dataset.swipeInit = '1';

  el.addEventListener('touchstart', e => {
    if (!esteMobil() || e.touches.length !== 1) return;
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
  }, { passive: true });

  el.addEventListener('touchend', e => {
    if (!esteMobil() || swipeStartX === null) return;
    const dx = e.changedTouches[0].clientX - swipeStartX;
    const dy = e.changedTouches[0].clientY - swipeStartY;
    swipeStartX = null;
    swipeStartY = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      schimbaZiuaMobil(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
}
initSwipeCalendar();

let esteMobilAnterior = esteMobil();
let redimensionareTimeout = null;
window.addEventListener('resize', () => {
  clearTimeout(redimensionareTimeout);
  redimensionareTimeout = setTimeout(() => {
    if (esteMobil() !== esteMobilAnterior) {
      esteMobilAnterior = esteMobil();
      const panelCalendar = document.getElementById('panel-calendar');
      if (panelCalendar && panelCalendar.style.display !== 'none') incarcaCalendarSaptamana();
    }
  }, 250);
});

if (token) aratatApp();