let token = localStorage.getItem('reset_token');
let pacientCurent = null;
let pacientEditareAbonamentCurent = '';
let pacientEditareAbonamentDetalii = null;
let fisaOrigine = 'lista'; // 'lista' sau 'calendar' - de unde s-a deschis fisa, ca "inapoi" sa stie unde te duce

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

function ajusteazaInaltimeTopbar() {
  const bara = document.querySelector('.desktop-topbar');
  if (bara) document.documentElement.style.setProperty('--topbar-h', bara.offsetHeight + 'px');
  const baraMobil = document.querySelector('.mobile-topbar');
  if (baraMobil) document.documentElement.style.setProperty('--mobile-topbar-h', baraMobil.offsetHeight + 'px');
}

function aratatApp() {
  document.getElementById('login').style.display = 'none';
  document.getElementById('app').style.display = 'grid';
  aratapanel(sessionStorage.getItem('tabActiv') || 'calendar');
  actualizeazaNotificari();
  initLive();
  initPush();
  ajusteazaInaltimeTopbar();
  window.addEventListener('resize', ajusteazaInaltimeTopbar);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    actualizeazaNotificari();
    if (!sseConexiune || sseConexiune.readyState === EventSource.CLOSED) initLive();
  });
}

// Conexiune live cu serverul (Server-Sent Events): la orice modificare facuta de oricine,
// oriunde in aplicatie, reimprospatam ce se vede pe ecran - fara refresh manual.
let sseConexiune = null;

function initLive() {
  if (sseConexiune) return;
  sseConexiune = new EventSource(`/api/live?token=${encodeURIComponent(token)}`);
  sseConexiune.onmessage = reimprospateazaDupaSchimbare;
  sseConexiune.onerror = () => {}; // EventSource reincearca singur reconectarea
}

function reimprospateazaDupaSchimbare() {
  actualizeazaNotificari();

  if (document.getElementById('lista-notificari-nerezolvate')) {
    randeazaNotificari();
  } else if (document.getElementById('modal-container').innerHTML.trim() !== '') {
    return; // alt modal e deschis (editare etc.) - nu ii calcam datele pe dedesubt
  }

  const tabActiv = sessionStorage.getItem('tabActiv') || 'calendar';
  const panelActiv = document.getElementById(`panel-${tabActiv}`);
  const focalizatInPanel = document.activeElement
    && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
    && panelActiv?.contains(document.activeElement);
  if (focalizatInPanel) return;

  if (tabActiv === 'calendar') incarcaCalendarSaptamana();
  if (tabActiv === 'echipa') incarcaEchipa();
  if (tabActiv === 'statistici') incarcaStatistici();
  if (tabActiv === 'fisa') {
    if (document.getElementById('cautare')) cautaPacienti(document.getElementById('cautare').value || '');
    else if (document.getElementById('nou-nume')) { /* formular de pacient nou deschis - nu il suprascriem */ }
    else if (pacientCurent) deschideFisa(pacientCurent);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const bruta = atob(base64);
  return Uint8Array.from([...bruta].map(c => c.charCodeAt(0)));
}

// Notificari push: functioneaza si cand aplicatia e inchisa (ex: notificare noua de la un coleg)
async function initPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const inregistrare = await navigator.serviceWorker.ready;
    let abonament = await inregistrare.pushManager.getSubscription();

    if (!abonament) {
      if (Notification.permission === 'denied') return;
      const permisiune = await Notification.requestPermission();
      if (permisiune !== 'granted') return;

      const { cheiePublica } = await apel('/api/push/cheie-publica');
      if (!cheiePublica) return;

      abonament = await inregistrare.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(cheiePublica)
      });
    }

    await apel('/api/push/aboneaza', { method: 'POST', body: JSON.stringify(abonament.toJSON()) });
  } catch (e) {
    console.error('Nu am putut activa notificarile push:', e.message);
  }
}

// Doar bulina/pulsul - conteaza cate notificari nerezolvate sunt, fara sa deschida panoul
async function actualizeazaNotificari() {
  const lista = await apel('/api/notificari');
  if (!Array.isArray(lista)) return;
  const nerezolvate = lista.filter(n => !n.rezolvat).length;

  const badgeSidebar = document.getElementById('badge-notificari');
  const btnSidebar = document.getElementById('btn-notificari');
  const dotMobil = document.getElementById('badge-notificari-dot');
  const btnMobil = document.getElementById('btn-notificari-mobil');

  if (badgeSidebar) { badgeSidebar.textContent = nerezolvate; badgeSidebar.style.display = nerezolvate > 0 ? 'flex' : 'none'; }
  if (btnSidebar) btnSidebar.classList.toggle('are-noutati', nerezolvate > 0);
  if (dotMobil) dotMobil.style.display = nerezolvate > 0 ? 'block' : 'none';
  if (btnMobil) btnMobil.classList.toggle('are-noutati', nerezolvate > 0);
}

let notificariAratatRezolvate = false;

function iconaNotificare(tip) {
  if (tip === 'reprogramare') return '📅';
  if (tip === 'pacient_nou') return '🆕';
  return '📝';
}

function formateazaCandNotificare(data) {
  return new Date(data).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function scapaHtml(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

function randNotificare(n) {
  const cine = n.rezolvat
    ? `rezolvat de ${n.rezolvat_de_nume || '?'} - ${formateazaCandNotificare(n.rezolvat_la)}`
    : `adaugat de ${n.creat_de_nume || 'sistem'} - ${formateazaCandNotificare(n.creat_la)}`;
  return `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #3a3937;${n.rezolvat ? 'opacity:0.5' : ''}">
      <input type="checkbox" ${n.rezolvat ? 'checked' : ''} style="width:18px;height:18px;margin-top:2px;flex-shrink:0;cursor:pointer"
        onchange="this.checked ? rezolvaNotificareItem('${n.id}') : redeschideNotificareItem('${n.id}')">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;${n.rezolvat ? 'text-decoration:line-through' : ''}">${iconaNotificare(n.tip)} ${scapaHtml(n.text)}</div>
        <div style="font-size:11px;color:#9a988e;margin-top:2px">${cine}</div>
      </div>
      <svg onclick="stergeNotificareItem('${n.id}')" title="Sterge" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#9a988e;cursor:pointer;flex-shrink:0;margin-top:3px">
        <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </div>
  `;
}

async function deschideNotificari() {
  await randeazaNotificari();
  document.getElementById('notificare-text-nou')?.focus();
}

async function randeazaNotificari() {
  const inputCurent = document.getElementById('notificare-text-nou');
  if (inputCurent && document.activeElement === inputCurent && inputCurent.value) return;

  const lista = await apel('/api/notificari');
  if (!Array.isArray(lista)) {
    document.getElementById('modal-container').innerHTML = `
      <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:100" onclick="if(event.target===this) inchideModalProgramare()">
        <div class="card" style="max-width:360px;width:90%">
          <h2>Notificari</h2>
          <div style="color:#e08585;font-size:13px">Nu am putut incarca notificarile: ${lista?.eroare || 'eroare necunoscuta'}</div>
          <button class="btn secundar" style="width:100%;margin-top:14px" onclick="inchideModalProgramare()">Inchide</button>
        </div>
      </div>
    `;
    return;
  }
  const nerezolvate = lista.filter(n => !n.rezolvat);
  const rezolvate = lista.filter(n => n.rezolvat);

  const textNesalvat = document.getElementById('notificare-text-nou')?.value || '';

  const html = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 12px;z-index:100" onclick="if(event.target===this) inchideModalProgramare()">
      <div class="card" style="max-width:460px;width:100%">
        <h2>Notificari</h2>
        <div style="display:flex;gap:8px;margin-bottom:14px">
          <input id="notificare-text-nou" placeholder="Scrie ceva ce trebuie stiut sau facut..." style="flex:1" onkeydown="if(event.key==='Enter') adaugaNotificare()">
          <button class="btn" onclick="adaugaNotificare()">Adauga</button>
        </div>
        <div id="lista-notificari-nerezolvate">
          ${nerezolvate.map(randNotificare).join('') || '<div style="font-size:13px;color:#9a988e;padding:8px 0">Nimic in asteptare. 🎉</div>'}
        </div>
        <div style="font-size:12px;color:#9a988e;margin-top:10px;cursor:pointer" onclick="notificariAratatRezolvate=!notificariAratatRezolvate; deschideNotificari()">
          ${notificariAratatRezolvate ? 'Ascunde rezolvate' : `Vezi rezolvate (${rezolvate.length})`}
        </div>
        ${notificariAratatRezolvate ? `<div style="margin-top:6px">${rezolvate.map(randNotificare).join('') || '<div style="font-size:13px;color:#9a988e;padding:8px 0">Niciuna inca.</div>'}</div>` : ''}
        <button class="btn secundar" style="width:100%;margin-top:14px" onclick="inchideModalProgramare()">Inchide</button>
      </div>
    </div>
  `;
  document.getElementById('modal-container').innerHTML = html;
  const inputNou = document.getElementById('notificare-text-nou');
  if (inputNou) inputNou.value = textNesalvat;
}

async function adaugaNotificare() {
  const input = document.getElementById('notificare-text-nou');
  const text = input.value.trim();
  if (!text) return;
  await apel('/api/notificari', { method: 'POST', body: JSON.stringify({ text }) });
  await deschideNotificari();
  actualizeazaNotificari();
}

async function rezolvaNotificareItem(id) {
  await apel(`/api/notificari/${id}/rezolva`, { method: 'PATCH' });
  await deschideNotificari();
  actualizeazaNotificari();
}

async function redeschideNotificareItem(id) {
  await apel(`/api/notificari/${id}/redeschide`, { method: 'PATCH' });
  await deschideNotificari();
  actualizeazaNotificari();
}

async function stergeNotificareItem(id) {
  await apel(`/api/notificari/${id}`, { method: 'DELETE' });
  await deschideNotificari();
  actualizeazaNotificari();
}

async function apel(cale, optiuni = {}) {
  const r = await fetch(cale, {
    ...optiuni,
    cache: 'no-store',
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

let cautarePacientiTimeout = null;
let cautarePacientiToken = 0;

function cautaPacientiDebounced(q) {
  clearTimeout(cautarePacientiTimeout);
  cautarePacientiTimeout = setTimeout(() => cautaPacienti(q), 150);
}

async function cautaPacienti(q) {
  const lista = document.getElementById('lista-pacienti');
  if (!lista) return;
  const cerereId = ++cautarePacientiToken;
  const arhivati = document.getElementById('toggle-arhivati')?.checked ? '1' : '0';
  const rows = await apel(`/api/pacienti?q=${encodeURIComponent(q)}&arhivati=${arhivati}`);
  if (cerereId !== cautarePacientiToken) return;
  lista.innerHTML = rows.map(p => `
    <div class="patient-row" onclick="deschideFisa('${p.id}')">
      <div class="nume">${p.nume} ${p.prenume}</div>
      <div class="info">${p.diagnostic || 'fara diagnostic'}</div>
    </div>
  `).join('') || '<div style="font-size:12px;color:#9a988e;padding:8px">Niciun pacient gasit.</div>';
}

let cautareGlobalaTimeout = null;
let cautareGlobalaToken = 0;

function cautaGlobalDebounced(q, mobil) {
  clearTimeout(cautareGlobalaTimeout);
  cautareGlobalaTimeout = setTimeout(() => cautaGlobala(q, mobil), 150);
}

async function cautaGlobala(q, mobil) {
  const rezultateEl = document.getElementById(mobil ? 'global-cautare-rezultate-mobil' : 'global-cautare-rezultate');
  if (!rezultateEl) return;
  const query = (q || '').trim();
  const cerereId = ++cautareGlobalaToken;
  if (!query) {
    rezultateEl.innerHTML = '';
    rezultateEl.style.display = 'none';
    return;
  }
  const rows = await apel(`/api/pacienti?q=${encodeURIComponent(query)}`);
  if (cerereId !== cautareGlobalaToken) return;
  const gasiti = rows.slice(0, 8);
  rezultateEl.innerHTML = gasiti.map(p => `
    <div class="global-cautare-item" onclick="selecteazaCautareGlobala('${p.id}')">
      <div class="nume">${p.nume} ${p.prenume}</div>
      <div class="info">${p.diagnostic || 'fara diagnostic'}</div>
    </div>
  `).join('') || '<div class="global-cautare-gol">Niciun pacient gasit.</div>';
  rezultateEl.style.display = 'block';
}

function cautareGlobalaTasta(event, mobil) {
  if (event.key === 'Escape') {
    inchideCautareGlobala();
  } else if (event.key === 'Enter') {
    const rezultateEl = document.getElementById(mobil ? 'global-cautare-rezultate-mobil' : 'global-cautare-rezultate');
    const primul = rezultateEl?.querySelector('.global-cautare-item');
    if (primul) primul.click();
  }
}

function selecteazaCautareGlobala(id) {
  inchideCautareGlobala();
  aratapanel('fisa');
  deschideFisa(id);
}

function inchideCautareGlobala() {
  const inputD = document.getElementById('global-cautare');
  const inputM = document.getElementById('global-cautare-mobil');
  if (inputD) inputD.value = '';
  if (inputM) inputM.value = '';
  ['global-cautare-rezultate', 'global-cautare-rezultate-mobil'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.innerHTML = ''; el.style.display = 'none'; }
  });
}

document.addEventListener('click', (event) => {
  document.querySelectorAll('.global-search-wrap').forEach(wrap => {
    if (wrap.contains(event.target)) return;
    const rezultate = wrap.querySelector('.global-cautare-dropdown');
    if (rezultate) rezultate.style.display = 'none';
  });
});

function marcheazaActiv(nume) {
  document.querySelectorAll('.top-nav-btn, .bottom-nav-btn').forEach(b => b.classList.toggle('activ', b.dataset.panel === nume));
}

function aratapanel(nume) {
  sessionStorage.setItem('tabActiv', nume);
  ['fisa', 'calendar', 'echipa', 'statistici'].forEach(p => {
    document.getElementById(`panel-${p}`).style.display = p === nume ? 'block' : 'none';
  });
  marcheazaActiv(nume);
  document.body.classList.toggle('pagina-fara-scroll', nume === 'calendar' || nume === 'echipa');
  if (nume === 'calendar') incarcaCalendarSaptamana();
  if (nume === 'echipa') incarcaEchipa();
  if (nume === 'statistici') incarcaStatistici();
  if (nume === 'fisa') aratatListaPacienti();
}

function aratatListaPacienti() {
  fisaOrigine = 'lista';
  document.getElementById('panel-fisa').innerHTML = `
    <div class="card" style="max-width:460px">
      <h2>Pacienti</h2>
      <input id="cautare" placeholder="Cauta pacient" oninput="cautaPacientiDebounced(this.value)" style="width:100%;margin-bottom:10px" autofocus>
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
    <div class="panel-cols-2">
      <div class="card">
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
      <div class="card">
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

  const buton = event.target;
  buton.disabled = true;
  const rezultat = await apel('/api/utilizatori', {
    method: 'POST',
    body: JSON.stringify({ nume, email, parola })
  });

  if (rezultat.eroare) {
    eroareEl.textContent = rezultat.eroare;
    buton.disabled = false;
    return;
  }

  incarcaEchipa();
}

async function stergeKineto(id, nume) {
  if (!confirm(`Sigur vrei sa stergi \"${nume}\" din echipa? Programarile lui vechi raman, dar devin nealocate.`)) return;
  const rezultat = await apel(`/api/utilizatori/${id}`, { method: 'DELETE' });
  if (rezultat.eroare) {
    document.getElementById('eroare-echipa').textContent = rezultat.eroare;
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
      <input id="nou-telefon" type="tel" style="width:100%;margin-bottom:10px" placeholder="07xxxxxxxx">
      <label>Email</label>
      <input id="nou-email" type="email" style="width:100%;margin-bottom:10px">
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

  const buton = event.target;
  buton.disabled = true;
  const pacient = await apel('/api/pacienti', {
    method: 'POST',
    body: JSON.stringify({ nume, prenume, telefon, email, diagnostic })
  });

  if (pacient.eroare) {
    eroareEl.textContent = pacient.eroare;
    buton.disabled = false;
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

function inapoiDinFisa() {
  if (fisaOrigine === 'calendar') aratapanel('calendar');
  else aratatListaPacienti();
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
      <button class="btn secundar" onclick="inapoiDinFisa()">&larr; ${fisaOrigine === 'calendar' ? 'Calendar' : 'Toti pacientii'}</button>
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

  const buton = event.target;
  buton.disabled = true;
  const rezultat = await apel('/api/programari/sedinta-trecuta', {
    method: 'POST',
    body: JSON.stringify({ pacient_id: pacientId, kineto_id, data_ora: `${data} 12:00:00`, exercitii, observatii })
  });

  if (rezultat.eroare) {
    eroareEl.textContent = rezultat.eroare;
    buton.disabled = false;
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
    pacientEditareAbonamentDetalii = ab;
    const html = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 12px;z-index:100" onclick="if(event.target===this) inchideModalProgramare()">
        <div class="card" style="max-width:400px;width:90%;max-height:calc(100vh - 48px);overflow-y:auto">
          <h2>Editeaza pacient</h2>
          <label>Prenume</label>
          <input id="edit-prenume" value="${p.prenume}" style="width:100%;margin-bottom:10px">
          <label>Nume</label>
          <input id="edit-nume" value="${p.nume}" style="width:100%;margin-bottom:10px">
          <label>Telefon</label>
          <input id="edit-telefon" type="tel" value="${p.telefon || ''}" style="width:100%;margin-bottom:10px">
          <label>Email</label>
          <input id="edit-email" type="email" value="${p.email || ''}" style="width:100%;margin-bottom:10px">
          <label>Diagnostic</label>
          <input id="edit-diagnostic" value="${p.diagnostic || ''}" style="width:100%;margin-bottom:14px">
          <label>Abonament</label>
          <select id="edit-abonament" onchange="actualizeazaInfoAbonament(this.value)" style="width:100%;margin-bottom:6px">
            <option value="" ${!ab ? 'selected' : ''}>Fara abonament</option>
            <option value="8" ${ab && ab.tip === '8' ? 'selected' : ''}>8 sedinte</option>
            <option value="12" ${ab && ab.tip === '12' ? 'selected' : ''}>12 sedinte</option>
            <option value="individual" ${ab && ab.tip === 'individual' ? 'selected' : ''}>Sedinta individuala</option>
          </select>
          <div id="abonament-info" style="font-size:12px;color:#9a988e;margin-bottom:14px">${ab ? `Are deja ${ab.sedinte_efectuate}/${ab.total_sedinte} sedinte efectuate.` : 'Pacientul nu are niciun abonament momentan.'}</div>
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

function actualizeazaInfoAbonament(tip) {
  const info = document.getElementById('abonament-info');
  const ab = pacientEditareAbonamentDetalii;
  if (tip === pacientEditareAbonamentCurent) {
    info.textContent = ab ? `Are deja ${ab.sedinte_efectuate}/${ab.total_sedinte} sedinte efectuate.` : 'Pacientul nu are niciun abonament momentan.';
  } else if (pacientEditareAbonamentCurent) {
    info.textContent = 'Atentie: schimbarea tipului de abonament reseteaza la 0 contorul de sedinte efectuate.';
  } else {
    info.textContent = tip ? `Se va crea un abonament nou de ${textAbonament(tip)}.` : 'Pacientul nu are niciun abonament momentan.';
  }
}

async function salveazaEditarePacient(id) {
  const nume = document.getElementById('edit-nume').value.trim();
  const prenume = document.getElementById('edit-prenume').value.trim();
  const telefon = document.getElementById('edit-telefon').value.trim();
  const email = document.getElementById('edit-email').value.trim();
  const diagnostic = document.getElementById('edit-diagnostic').value.trim();
  const abonamentEl = document.getElementById('edit-abonament');
  const tipAbonament = abonamentEl ? abonamentEl.value : '';

  event.target.disabled = true;
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
  pacientCurent = null;
  await apel(`/api/pacienti/${id}`, { method: 'DELETE' });
  aratatListaPacienti();
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
  event.target.disabled = true;
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

  const buton = event.target;
  buton.disabled = true;
  const rezultat = await apel(`/api/pacienti/${pacientId}/plati`, {
    method: 'POST',
    body: JSON.stringify({ suma, metoda, tip_plata, motiv, data_plata: data })
  });

  if (rezultat.eroare) {
    eroareEl.textContent = rezultat.eroare;
    buton.disabled = false;
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
    <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#9a988e">
        <span style="cursor:pointer;padding:4px 6px" onclick="schimbaLuna(-1)" title="Luna anterioara">&larr;</span>
        <span style="min-width:100px;text-align:center">${LUNI_RO[dataCurenta.getMonth()]} ${dataCurenta.getFullYear()}</span>
        <span style="cursor:pointer;padding:4px 6px" onclick="schimbaLuna(1)" title="Luna urmatoare">&rarr;</span>
      </div>
      <div style="display:flex;justify-content:center">
        <div class="week-nav">
          <button class="week-nav-btn" onclick="schimbaSaptamana(-1)">&larr; Saptamana trecuta</button>
          <button class="week-nav-btn azi" onclick="saptamanaAceasta()">Azi</button>
          <button class="week-nav-btn" onclick="schimbaSaptamana(1)">Saptamana urmatoare &rarr;</button>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end">
        <button class="btn btn-adauga" onclick="aratatFormularProgramareNoua(null, null)">+ Programare noua</button>
      </div>
    </div>
    <div class="card" style="padding:0;background:#ffffff;border-color:#dcdad4">
      <table style="border-collapse:collapse;table-layout:fixed;width:100%">
        <tr>
          <th style="text-align:left;padding:10px 8px;font-size:12px;color:#6b6a63;width:60px;border:1px solid #e2e0d9;background:#f4f3ef">Ora</th>
          ${zile.map((z, i) => `<th style="text-align:left;padding:10px 8px;font-size:12px;color:${z === astazi ? '#ffffff' : '#6b6a63'};border:1px solid #e2e0d9;background:${z === astazi ? '#1f8a7a' : '#f4f3ef'}">${ZILE_SAPTAMANA[i]}<br><span style="font-size:11px">${new Date(z).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' })}</span></th>`).join('')}
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

function deschideCalendarZi() {
  const input = document.getElementById('day-nav-date-input');
  if (!input) return;
  if (input.showPicker) input.showPicker();
  else input.focus();
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
      <div class="day-nav-info" onclick="deschideCalendarZi()">
        <div class="day-nav-titlu">${numeZi}, ${d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'long' })}</div>
        ${ziuaMobilCurenta === astazi ? '<div class="day-nav-azi">azi</div>' : '<div class="day-nav-azi clickabil" onclick="event.stopPropagation(); ziuaMobilAstazi()">&larr; inapoi la azi</div>'}
      </div>
      <button class="btn day-nav-arrow" onclick="schimbaZiuaMobil(1)">&rarr;</button>
      <input type="date" id="day-nav-date-input" class="day-nav-date-input" value="${ziuaMobilCurenta}" onchange="schimbaZiuaMobilData(this.value)">
    </div>
    <button class="btn btn-adauga" style="width:100%;margin:10px 0" onclick="aratatFormularProgramareNoua('${ziuaMobilCurenta}', null)">+ Programare noua</button>
    <div class="global-search-wrap">
      <input id="global-cautare-mobil" type="text" placeholder="Cauta pacient..." autocomplete="off" oninput="cautaGlobalDebounced(this.value, true)" onkeydown="cautareGlobalaTasta(event, true)">
      <div id="global-cautare-rezultate-mobil" class="global-cautare-dropdown"></div>
    </div>
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
      ${ramase === 1 ? '<span style="width:6px;height:6px;border-radius:50%;background:#e0b85e;flex-shrink:0" title="Ultima sedinta din abonament"></span>' : ''}
      <span style="font-size:12px;cursor:pointer;max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${culoareStatusDeschis[p.status] || '#2b2a26'};font-weight:600" onclick="toggleMeniuStatus('${p.id}', event)">${p.prenume}</span>
      <span style="font-size:11px;cursor:pointer;color:#9a988e;padding:0 2px" onclick="aratatMeniuProgramare('${p.id}','${p.prenume}')" title="Editeaza programarea">&#9998;</span>
      <div id="status-meniu-${p.id}" style="display:none;position:absolute;top:100%;left:0;z-index:60;background:#ffffff;border:1px solid #d8d6cd;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.15);min-width:90px;overflow:hidden">
        <div style="padding:7px 12px;font-size:12px;color:#1f8a5a;cursor:pointer;white-space:nowrap" onclick="aratatFormularPrezenta('${p.id}','${p.prenume}',${p.total_sedinte ?? 'null'},${p.sedinte_efectuate ?? 'null'},'${p.status}')">Prezent</div>
        <div style="padding:7px 12px;font-size:12px;color:#c14343;cursor:pointer;white-space:nowrap;border-top:1px solid #eae8e1" onclick="marcheaza('${p.id}','absent')">Absent</div>
        <div style="padding:7px 12px;font-size:12px;color:#2b2a26;cursor:pointer;white-space:nowrap;border-top:1px solid #eae8e1" onclick="fisaOrigine='calendar'; deschideFisa('${p.pacient_id}')">Fisa</div>
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

function toggleMeniuStatus(id, event) {
  if (event) event.stopPropagation();
  const el = document.getElementById(`status-meniu-${id}`);
  const eraDeschis = el.style.display === 'block';
  document.querySelectorAll('[id^="status-meniu-"]').forEach(m => m.style.display = 'none');
  el.style.display = eraDeschis ? 'none' : 'block';
}

document.addEventListener('click', () => {
  document.querySelectorAll('[id^="status-meniu-"]').forEach(m => m.style.display = 'none');
});

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

        <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" id="prog-recurenta" style="width:auto" onchange="toggleRecurentaProgramare()">
          Repeta in fiecare saptamana
        </label>

        <div id="prog-recurenta-detalii" style="display:none;margin-top:8px">
          <label>In zilele</label>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">
            ${ZILE_SAPTAMANA.map((z, i) => `
              <label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer">
                <input type="checkbox" class="prog-recurenta-zi" value="${i + 1}" style="width:auto">
                ${z}
              </label>
            `).join('')}
          </div>
          <label>Pana la data (inclusiv)</label>
          <input id="prog-recurenta-pana" type="date" style="width:100%;margin-bottom:10px" onclick="this.showPicker && this.showPicker()">
        </div>

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

function toggleRecurentaProgramare() {
  const activ = document.getElementById('prog-recurenta').checked;
  document.getElementById('prog-recurenta-detalii').style.display = activ ? 'block' : 'none';
}

// Genereaza sirul de date (YYYY-MM-DD) intre start si sfarsit (inclusiv) care cad in zileSaptamana (1=Luni..5=Vineri)
function genereazaDateRecurente(start, sfarsit, zileSaptamana) {
  const rezultat = [];
  const curent = new Date(start + 'T00:00:00');
  const limita = new Date(sfarsit + 'T00:00:00');
  while (curent <= limita) {
    if (zileSaptamana.includes(curent.getDay())) {
      rezultat.push(dataLocala(curent));
    }
    curent.setDate(curent.getDate() + 1);
  }
  return rezultat;
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

  const recurenta = document.getElementById('prog-recurenta').checked;
  let dateDeCreat = [data];

  if (recurenta) {
    const zileSelectate = Array.from(document.querySelectorAll('.prog-recurenta-zi:checked')).map(el => Number(el.value));
    const panaLa = document.getElementById('prog-recurenta-pana').value;
    if (!zileSelectate.length) {
      eroareEl.textContent = 'Bifeaza cel putin o zi din saptamana.';
      return;
    }
    if (!panaLa) {
      eroareEl.textContent = 'Completeaza pana la ce data se repeta programarea.';
      return;
    }
    if (panaLa < data) {
      eroareEl.textContent = '"Pana la data" trebuie sa fie dupa data de inceput.';
      return;
    }
    dateDeCreat = genereazaDateRecurente(data, panaLa, zileSelectate);
  }

  const buton = event.target;
  buton.disabled = true;

  const esuate = [];
  for (const zi of dateDeCreat) {
    const data_ora = `${zi} ${ora}:00`;
    const rezultat = await apel('/api/programari', {
      method: 'POST',
      body: JSON.stringify({ pacient_id, kineto_id, data_ora })
    });
    if (rezultat.eroare) {
      esuate.push(`${zi}: ${rezultat.eroare}`);
    }
  }

  if (esuate.length === dateDeCreat.length) {
    eroareEl.textContent = esuate[0];
    buton.disabled = false;
    return;
  }

  inchideModalProgramare();
  incarcaCalendarSaptamana();

  if (esuate.length) {
    alert(`${dateDeCreat.length - esuate.length} programari create. ${esuate.length} nu au putut fi create:\n${esuate.join('\n')}`);
  }
}

async function marcheaza(id, status) {
  await apel(`/api/programari/${id}/${status}`, { method: 'PATCH' });
  incarcaCalendarSaptamana();
}

function aratatFormularPrezenta(id, prenume, totalSedinte, sedinteEfectuate, statusCurent) {
  const html = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:200;padding:16px" onclick="if(event.target===this) inchideModalProgramare()">
      <div class="card" style="max-width:380px;width:90%">
        <h2>Prezenta - ${prenume}</h2>
        <label>Exercitii</label>
        <textarea id="prezenta-exercitii" rows="3" style="width:100%;margin-bottom:10px"></textarea>
        <label>Cum s-a simtit / Observatii</label>
        <textarea id="prezenta-observatii" rows="3" style="width:100%;margin-bottom:14px"></textarea>
        <button class="btn" style="width:100%" onclick="confirmaPrezenta('${id}','${prenume}',${totalSedinte ?? 'null'},${sedinteEfectuate ?? 'null'},'${statusCurent}')">Salveaza</button>
        <button class="btn secundar" style="width:100%;margin-top:8px" onclick="inchideModalProgramare()">Anuleaza</button>
      </div>
    </div>
  `;
  document.getElementById('modal-container').innerHTML = html;
}

async function confirmaPrezenta(id, prenume, totalSedinte, sedinteEfectuate, statusCurent) {
  const exercitii = document.getElementById('prezenta-exercitii').value.trim();
  const observatii = document.getElementById('prezenta-observatii').value.trim();
  await apel(`/api/programari/${id}/prezent`, { method: 'PATCH', body: JSON.stringify({ exercitii, observatii }) });

  const areMaiPutinDe3 = statusCurent !== 'prezent' && totalSedinte != null && sedinteEfectuate != null
    && totalSedinte - (sedinteEfectuate + 1) === 2;
  if (areMaiPutinDe3) {
    aratatPopupSedinteRamase(prenume);
  } else {
    inchideModalProgramare();
  }

  incarcaCalendarSaptamana();
}

function aratatPopupSedinteRamase(prenume) {
  const html = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:200;padding:16px" onclick="if(event.target===this) inchideModalProgramare()">
      <div class="card" style="max-width:340px;width:90%;text-align:center;padding:32px 26px">
        <div style="font-size:38px;margin-bottom:16px">&#9203;</div>
        <div style="font-size:25px;font-weight:700;line-height:1.35;margin-bottom:22px">${prenume} mai are <span style="color:#e0b85e">2 sedinte</span></div>
        <button class="btn" style="width:100%" onclick="inchideModalProgramare()">Am inteles</button>
      </div>
    </div>
  `;
  document.getElementById('modal-container').innerHTML = html;
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
        <div id="eroare-reprogramare" style="color:#e08585;font-size:12px;margin-top:8px"></div>
      </div>
    </div>
  `;
  document.getElementById('modal-container').innerHTML = html;
}

async function salveazaReprogramare(id) {
  const data = document.getElementById('reprog-data').value;
  const ora = document.getElementById('reprog-ora').value;
  const eroareEl = document.getElementById('eroare-reprogramare');
  eroareEl.textContent = '';
  if (!data || !ora) return;
  const ziSaptamanii = new Date(data + 'T00:00:00').getDay();
  if (ziSaptamanii === 0 || ziSaptamanii === 6) {
    eroareEl.textContent = 'Nu se pot face programari sambata sau duminica.';
    return;
  }
  const data_ora_noua = `${data} ${ora}:00`;
  const rezultat = await apel(`/api/programari/${id}/reprogrameaza`, { method: 'PATCH', body: JSON.stringify({ data_ora_noua }) });
  if (rezultat.eroare) {
    eroareEl.textContent = rezultat.eroare;
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

let parolaSumeCurenta = null;
let ultimeleStatisticiDate = null;
const LUNI_RO_STATS = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];

async function incarcaStatistici() {
  const query = parolaSumeCurenta ? `?parola=${encodeURIComponent(parolaSumeCurenta)}` : '';
  const s = await apel(`/api/statistici${query}`);
  ultimeleStatisticiDate = s;
  const sumeDeblocate = s.incasari_luna != null;
  if (parolaSumeCurenta && !sumeDeblocate) parolaSumeCurenta = null;
  const acum = new Date();
  document.getElementById('panel-statistici').innerHTML = `
    <div class="panel-cols-2">
      <div id="statistici-coloana-stanga" style="display:flex;flex-direction:column;gap:16px">
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
      </div>
      <div id="statistici-card-incasari" class="card">
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
    </div>

    <div class="card" style="margin-top:16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div>
          <h2 style="margin:0 0 2px">Sedinte pe luna</h2>
          <div style="font-size:11.5px;color:#6f6d64">Anul ${acum.getFullYear()}</div>
        </div>
        ${cardTendinta(s.sedinte_pe_luna, acum.getMonth())}
      </div>
      <div id="grafic-sedinte-luna" style="margin-top:10px"></div>
    </div>

    <div class="card" style="margin-top:16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div>
          <h2 style="margin:0 0 2px">Incasari pe luna</h2>
          <div style="font-size:11.5px;color:#6f6d64">Anul ${acum.getFullYear()}</div>
        </div>
        ${sumeDeblocate ? cardTendinta(s.incasari_pe_luna, acum.getMonth()) : ''}
      </div>
      ${sumeDeblocate
        ? `<div id="grafic-incasari-luna" style="margin-top:10px"></div>`
        : '<div style="font-size:13px;color:#9a988e;margin-top:10px">Sumele sunt ascunse. Apasa "Arata sumele" din cardul de mai sus pentru a le vedea.</div>'}
    </div>

    <div class="card" style="margin-top:16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div>
          <h2 style="margin:0 0 2px">Rata de reinnoire a abonamentelor</h2>
          <div style="font-size:11.5px;color:#6f6d64">Anul ${acum.getFullYear()} &middot; pachete 8/12 sedinte</div>
        </div>
        ${cardTendintaRata(s.reinnoiri_pe_luna, acum.getMonth())}
      </div>
      <div id="grafic-reinnoiri-luna" style="margin-top:10px"></div>
    </div>
  `;
  egalizeazaColoaneStatistici();
  deseneazaGraficBare('grafic-sedinte-luna', s.sedinte_pe_luna, '#1FA1AB', acum.getMonth());
  if (sumeDeblocate) deseneazaGraficBare('grafic-incasari-luna', s.incasari_pe_luna, '#EA532F', acum.getMonth(), formatLei);
  deseneazaGraficBare('grafic-reinnoiri-luna', s.reinnoiri_pe_luna, '#E9B44C', acum.getMonth(), formatRata);
}

// Deseneaza un grafic cu bare in containerul dat, folosind latimea lui reala (masurata in
// DOM, ca la canvas-ul de semnatura GDPR) - nu scalare CSS, ca sa nu se deformeze barele.
// indexCurent = indexul lunii curente in serie (celelalte de dupa el sunt viitoare, inca 0).
function deseneazaGraficBare(idContainer, serie, culoare, indexCurent, formatValoare) {
  const container = document.getElementById(idContainer);
  if (!container) return;
  requestAnimationFrame(() => {
    const latimeContainer = container.clientWidth;
    if (!latimeContainer) return;
    container.innerHTML = svgGraficBare(serie, culoare, latimeContainer, indexCurent, formatValoare);
  });
}

// Grafic simplu cu bare, la latimea reala primita (in pixeli). Luna curenta e plina si
// etichetata cu valoarea; lunile trecute sunt tot mai transparente, cele viitoare abia vizibile.
function svgGraficBare(serie, culoare, latimeContainer, indexCurent, formatValoare) {
  formatValoare = formatValoare || (l => l.total);
  const marginLateral = 4, sus = 28, jos = 20, inaltimeGrafic = 180;
  const inaltimeTotal = sus + inaltimeGrafic + jos;
  const yBaza = sus + inaltimeGrafic;
  const n = serie.length;
  const spatiuUtil = latimeContainer - marginLateral * 2;
  const raportGol = 0.8; // spatiul dintre bare = 80% din latimea unei bare - coloane inguste
  const latimeBara = Math.min(spatiuUtil / (n + (n - 1) * raportGol), 34);
  const pasBara = latimeBara * (1 + raportGol);
  const latimeContinut = n * pasBara - latimeBara * raportGol;
  const start = marginLateral + Math.max(0, (spatiuUtil - latimeContinut) / 2);
  const maxim = Math.max(...serie.map(l => l.total), 1);

  const bare = serie.map((l, i) => {
    const x = start + i * pasBara;
    const h = Math.max((l.total / maxim) * inaltimeGrafic, l.total > 0 ? 3 : 1);
    const y = yBaza - h;
    const ultima = i === indexCurent;
    const viitor = i > indexCurent;
    const opacitate = viitor ? 0.12 : (ultima ? 1 : 0.35 + (i / Math.max(indexCurent, 1)) * 0.55);
    return `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${latimeBara.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${culoare}" opacity="${opacitate.toFixed(2)}"/>
      ${ultima ? `<text x="${(x + latimeBara / 2).toFixed(1)}" y="${(y - 7).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" fill="#ece9e2">${formatValoare(l)}</text>` : ''}
      <text x="${(x + latimeBara / 2).toFixed(1)}" y="${yBaza + 14}" text-anchor="middle" font-size="9" fill="${ultima ? '#ece9e2' : '#6f6d64'}" font-weight="${ultima ? 600 : 400}">${l.eticheta}</text>
    `;
  }).join('');

  return `
    <svg width="${latimeContainer}" height="${inaltimeTotal}" viewBox="0 0 ${latimeContainer} ${inaltimeTotal}" style="display:block">
      <line x1="${marginLateral}" y1="${yBaza + 0.5}" x2="${latimeContainer - marginLateral}" y2="${yBaza + 0.5}" stroke="#3a3937" stroke-width="1"/>
      ${bare}
    </svg>
  `;
}

function formatLei(l) {
  return `${Math.round(l.total).toLocaleString('ro-RO')} lei`;
}

function formatRata(l) {
  return l.total_finalizate > 0 ? `${l.total}%` : '—';
}

// Rezumat scurt al tendintei: compara media primei jumatati a anului (de pana acum) cu a doua.
// Ignora lunile viitoare (dupa indexCurent), care sunt mereu 0 pentru ca inca nu au avut loc.
function cardTendinta(serieCompleta, indexCurent) {
  const serie = serieCompleta.slice(0, indexCurent + 1);
  let stare, text;
  if (serie.length < 2) {
    stare = 'stabil'; text = 'Inceput de an';
  } else {
    const mijloc = Math.ceil(serie.length / 2);
    const primaJumatate = serie.slice(0, mijloc);
    const aDouaJumatate = serie.slice(mijloc);
    const primele = primaJumatate.reduce((s, l) => s + l.total, 0) / primaJumatate.length;
    const ultimele = aDouaJumatate.reduce((s, l) => s + l.total, 0) / aDouaJumatate.length;
    if (primele === 0) {
      stare = ultimele > 0 ? 'sus' : 'stabil';
      text = ultimele > 0 ? 'In crestere' : 'Fara activitate inca';
    } else {
      const variatie = (ultimele - primele) / primele;
      if (variatie >= 0.08) { stare = 'sus'; text = 'In crestere'; }
      else if (variatie <= -0.08) { stare = 'jos'; text = 'In scadere'; }
      else { stare = 'stabil'; text = 'Stagnare'; }
    }
  }
  return randeazaBadgeTendinta(stare, text);
}

// Aceeasi idee ca cardTendinta, dar pentru o rata (reinnoiri/finalizate), nu o suma -
// media pe jumatate de an trebuie ponderata (cate reinnoiri la cate finalizari in total),
// nu media simpla a procentelor lunare, altfel lunile fara nicio finalizare ar trage gresit tendinta in jos.
function cardTendintaRata(serieCompleta, indexCurent) {
  const serie = serieCompleta.slice(0, indexCurent + 1);
  let stare, text;
  if (serie.length < 2) {
    stare = 'stabil'; text = 'Inceput de an';
  } else {
    const mijloc = Math.ceil(serie.length / 2);
    const prima = serie.slice(0, mijloc);
    const aDoua = serie.slice(mijloc);
    const finalizatePrima = prima.reduce((s, l) => s + l.total_finalizate, 0);
    const reinnoitePrima = prima.reduce((s, l) => s + l.total_reinnoite, 0);
    const finalizateADoua = aDoua.reduce((s, l) => s + l.total_finalizate, 0);
    const reinnoiteADoua = aDoua.reduce((s, l) => s + l.total_reinnoite, 0);

    if (finalizatePrima === 0 && finalizateADoua === 0) {
      stare = 'stabil'; text = 'Inca fara abonamente finalizate';
    } else if (finalizatePrima === 0) {
      stare = reinnoiteADoua > 0 ? 'sus' : 'stabil';
      text = reinnoiteADoua > 0 ? 'In crestere' : 'Fara reinnoiri inca';
    } else if (finalizateADoua === 0) {
      stare = 'stabil'; text = 'Inca prea putine date';
    } else {
      const rataPrima = reinnoitePrima / finalizatePrima;
      const rataADoua = reinnoiteADoua / finalizateADoua;
      const variatiePuncte = rataADoua - rataPrima;
      if (variatiePuncte >= 0.08) { stare = 'sus'; text = 'In crestere'; }
      else if (variatiePuncte <= -0.08) { stare = 'jos'; text = 'In scadere'; }
      else { stare = 'stabil'; text = 'Stagnare'; }
    }
  }
  return randeazaBadgeTendinta(stare, text);
}

function randeazaBadgeTendinta(stare, text) {
  const culori = { sus: '#7fd9a8', jos: '#e08585', stabil: '#9a988e' };
  const iconuri = {
    sus: '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
    jos: '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="5 12 12 19 19 12"/>',
    stabil: '<line x1="5" y1="12" x2="19" y2="12"/>'
  };
  return `
    <span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;padding:4px 9px;border-radius:20px;white-space:nowrap;flex-shrink:0;color:${culori[stare]};background:${culori[stare]}24">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${iconuri[stare]}</svg>
      ${text}
    </span>
  `;
}

function egalizeazaColoaneStatistici() {
  const stanga = document.getElementById('statistici-coloana-stanga');
  const dreapta = document.getElementById('statistici-card-incasari');
  if (!stanga || !dreapta) return;
  const carduriStanga = Array.from(stanga.children);
  carduriStanga.forEach(c => c.style.minHeight = '');
  // Sub 760px, .panel-cols-2 devine 1 coloana (totul stivuit) - pe telefon nu egalizam nimic
  if (window.innerWidth <= 760) return;
  requestAnimationFrame(() => {
    if (window.innerWidth <= 760) return;
    const gapTotal = (carduriStanga.length - 1) * 16;
    const fiecare = (dreapta.offsetHeight - gapTotal) / carduriStanga.length;
    if (fiecare > 0) carduriStanga.forEach(c => c.style.minHeight = fiecare + 'px');
  });
}

async function descarcaPdfStatistici() {
  const luna = document.getElementById('pdf-luna').value;
  const an = document.getElementById('pdf-an').value;

  if (!parolaSumeCurenta) {
    await cereParolaSume();
    if (!parolaSumeCurenta) return;
  }

  const r = await fetch(`/api/statistici/pdf?an=${an}&luna=${luna}&parola=${encodeURIComponent(parolaSumeCurenta)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) {
    const eroareEl = document.getElementById('eroare-parola-sume');
    if (eroareEl) eroareEl.textContent = 'Eroare la generarea raportului PDF.';
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

async function cereParolaSume() {
  const parola = prompt('Introdu parola pentru a vedea sumele incasate:');
  if (parola === null) return;
  const s = await apel(`/api/statistici?parola=${encodeURIComponent(parola)}`);
  if (s.incasari_luna == null) {
    const eroareEl = document.getElementById('eroare-parola-sume');
    if (eroareEl) eroareEl.textContent = 'Parola gresita.';
    return;
  }
  parolaSumeCurenta = parola;
  incarcaStatistici();
}

function blocheazaSume() {
  parolaSumeCurenta = null;
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
    if (ultimeleStatisticiDate) {
      deseneazaGraficBare('grafic-sedinte-luna', ultimeleStatisticiDate.sedinte_pe_luna, '#1FA1AB', new Date().getMonth());
      if (ultimeleStatisticiDate.incasari_pe_luna) {
        deseneazaGraficBare('grafic-incasari-luna', ultimeleStatisticiDate.incasari_pe_luna, '#EA532F', new Date().getMonth(), formatLei);
      }
      deseneazaGraficBare('grafic-reinnoiri-luna', ultimeleStatisticiDate.reinnoiri_pe_luna, '#E9B44C', new Date().getMonth(), formatRata);
    }
  }, 250);
});

if (token) aratatApp();