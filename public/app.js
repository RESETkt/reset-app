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
  aratapanel('fisa');
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

function aratapanel(nume) {
  ['fisa', 'calendar', 'statistici'].forEach(p => {
    document.getElementById(`panel-${p}`).style.display = p === nume ? 'block' : 'none';
  });
  document.querySelectorAll('.top-nav .btn').forEach(b => b.classList.remove('activ'));
  event?.target?.classList.add('activ');
  if (nume === 'calendar') incarcaCalendar();
  if (nume === 'statistici') incarcaStatistici();
}

async function deschideFisa(id) {
  pacientCurent = id;
  const data = await apel(`/api/pacienti/${id}`);
  const p = data.pacient;
  const ab = data.abonament;
  const ramase = ab ? ab.total_sedinte - ab.sedinte_efectuate : '-';

  document.getElementById('panel-fisa').innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-size:16px;font-weight:600">${p.nume} ${p.prenume}</div>
          <div style="font-size:13px;color:#7a7970;margin-top:2px">Diagnostic: ${p.diagnostic || '-'}</div>
        </div>
        ${ab ? `<span class="badge">Abonament ${ab.tip} sedinte</span>` : '<span class="badge" style="background:#f5e5d8;color:#8a5a1c">Fara abonament</span>'}
      </div>

      <div class="grid-3" style="margin-top:16px">
        <div class="metric"><div class="label">Efectuate</div><div class="value">${ab ? ab.sedinte_efectuate : 0}</div></div>
        <div class="metric"><div class="label">Ramase</div><div class="value">${ramase}</div></div>
        <div class="metric"><div class="label">GDPR</div><div class="value" style="font-size:14px">${data.gdpr_semnat ? 'Semnat' : 'Nesemnat'}</div></div>
      </div>

      ${data.ultima_sedinta ? `
      <div style="border-top:1px solid #e3e1d9;margin-top:16px;padding-top:12px">
        <div style="font-weight:500;font-size:13px;margin-bottom:6px">Ultima sedinta (${new Date(data.ultima_sedinta.data_ora).toLocaleDateString('ro-RO')})</div>
        <div style="font-size:13px;color:#555">Exercitii: ${data.ultima_sedinta.exercitii || '-'}</div>
        <div style="font-size:13px;color:#555">Observatii: ${data.ultima_sedinta.observatii || '-'}</div>
      </div>` : ''}

      <div style="border-top:1px solid #e3e1d9;margin-top:16px;padding-top:12px">
        <div style="font-weight:500;font-size:13px;margin-bottom:8px">Contact</div>
        <div style="font-size:13px">Telefon: ${p.telefon || '-'}</div>
        <div style="font-size:13px">Email: ${p.email || '-'}</div>
      </div>
    </div>
  `;
}

async function incarcaCalendar() {
  const azi = new Date().toISOString().slice(0, 10);
  const rows = await apel(`/api/programari?de_la=${azi}&pana_la=${azi}`);
  document.getElementById('panel-calendar').innerHTML = `
    <div class="card">
      <h2>Programari azi</h2>
      ${rows.map(r => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #eee">
          <div>
            <div style="font-size:13px;font-weight:500">${r.nume} ${r.prenume}</div>
            <div style="font-size:12px;color:#7a7970">${new Date(r.data_ora).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })} - ${r.kineto_nume || 'nealocat'} - ${r.status}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn prezent" onclick="marcheaza('${r.id}','prezent')">Prezent</button>
            <button class="btn absent" onclick="marcheaza('${r.id}','absent')">Absent</button>
            <button class="btn" onclick="reprogrameazaPrompt('${r.id}')">Reprogrameaza</button>
          </div>
        </div>
      `).join('') || '<div style="font-size:13px;color:#7a7970">Nicio programare azi.</div>'}
    </div>
  `;
}

async function marcheaza(id, status) {
  if (status === 'prezent') {
    const exercitii = prompt('Exercitii facute azi (pe scurt):') || '';
    const observatii = prompt('Observatii:') || '';
    await apel(`/api/programari/${id}/prezent`, { method: 'PATCH', body: JSON.stringify({ exercitii, observatii }) });
  } else {
    await apel(`/api/programari/${id}/absent`, { method: 'PATCH' });
  }
  incarcaCalendar();
}

async function reprogrameazaPrompt(id) {
  const dataNoua = prompt('Noua data si ora (YYYY-MM-DD HH:MM):');
  if (!dataNoua) return;
  await apel(`/api/programari/${id}/reprogrameaza`, { method: 'PATCH', body: JSON.stringify({ data_ora_noua: dataNoua }) });
  incarcaCalendar();
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
      ${s.incasari_dupa_metoda.map(m => `<div style="font-size:13px;margin-bottom:4px">${m.metoda}: ${m.total} lei</div>`).join('') || '<div style="font-size:13px;color:#7a7970">Fara plati inregistrate.</div>'}
    </div>
  `;
}
