// Masajul: tab separat in Programari ("Terapie | Masaj"), cu ziua pe randuri de 30 de minute (07:30-19:00, luni-vineri),
// masaje de 30 sau 50 de minute, plata cash/card si pachete de 4 masaje. Foloseste functiile din app.js
// (apel, dataLocala, adaugaZile, ziLucratoareVecina, scapaHtml, aratatPopupConfirmare...).

const MJ_DESCHIDE = 7 * 60 + 30;
const MJ_INCHIDE = 19 * 60;
const MJ_PAS = 30;
const MJ_INALT = 56;                       // inaltimea unui rand de 30 de minute, in px
const MJ_PRET = { 30: 150, 50: 200 };
const MJ_PRET_PACHET = { 30: 540, 50: 720 };

const mjOra = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

function modCalendar() {
  try { return sessionStorage.getItem('modCalendar') === 'masaj' ? 'masaj' : 'terapie'; } catch { return 'terapie'; }
}

function schimbaModCalendar(mod) {
  try { sessionStorage.setItem('modCalendar', mod); } catch { /* fara stocare: ramane doar pe sesiunea asta */ }
  document.body.classList.toggle('pagina-fara-scroll', mod !== 'masaj' && esteMobil());
  incarcaCalendarSaptamana();
}

function tabsCalendarHtml(mod) {
  const m = (mod || modCalendar()) === 'masaj';
  return `<div class="mj-tabs"><button class="${m ? '' : 'on t'}" onclick="schimbaModCalendar('terapie')">Terapie</button><button class="${m ? 'on m' : ''}" onclick="schimbaModCalendar('masaj')">Masaj</button></div>`;
}

// ---------- ziua de masaj ----------

function mjZiLucratoare(iso) {
  let d = iso;
  let zi = new Date(d + 'T00:00:00').getDay();
  while (zi === 0 || zi === 6) { d = adaugaZile(d, 1); zi = new Date(d + 'T00:00:00').getDay(); }
  return d;
}

let masajZi = mjZiLucratoare(dataLocala(new Date()));
let masajRez = [];   // masajele zilei afisate

function schimbaZiuaMasaj(dir) { masajZi = ziLucratoareVecina(masajZi, dir); incarcaCalendarMasaj(); }
function masajAzi() { masajZi = mjZiLucratoare(dataLocala(new Date())); incarcaCalendarMasaj(); }
function masajData(v) { if (v) { masajZi = mjZiLucratoare(v); incarcaCalendarMasaj(); } }
function masajDeschideData() {
  const i = document.getElementById('masaj-data-input');
  if (i && i.showPicker) i.showPicker(); else if (i) i.focus();
}

// Telefon: ziua. Calculator: saptamana.
async function incarcaCalendarMasaj() {
  if (esteMobil()) return incarcaMasajZi();
  return incarcaMasajSaptamana();
}

let masajSapt = luniAlSaptamanii(dataLocala(new Date()));   // luni din saptamana afisata (calculator)

function schimbaSaptamanaMasaj(dir) { masajSapt = adaugaZile(masajSapt, dir * 7); incarcaCalendarMasaj(); }
function masajSaptamanaAceasta() { masajSapt = luniAlSaptamanii(dataLocala(new Date())); incarcaCalendarMasaj(); }

async function incarcaMasajSaptamana() {
  document.body.classList.remove('pagina-fara-scroll');
  const panou = document.getElementById('panel-calendar');
  const zile = [0, 1, 2, 3, 4].map(i => adaugaZile(masajSapt, i));
  const astazi = dataLocala(new Date());
  masajZi = zile.includes(astazi) ? astazi : zile[0];   // ziua implicita pentru "+ Masaj"
  const rows = await apel(`/api/masaj?de_la=${zile[0]}&pana_la=${zile[4]}`);
  masajRez = Array.isArray(rows) ? rows : [];
  const nrRanduri = (MJ_INCHIDE - MJ_DESCHIDE) / MJ_PAS;
  const luna = new Date(masajSapt + 'T00:00:00');
  let ore = '';
  for (let i = 0; i < nrRanduri; i++) ore += `<div class="mj-rand"><span class="mj-o">${mjOra(MJ_DESCHIDE + i * MJ_PAS)}</span></div>`;
  const coloane = zile.map(z => {
    let randuri = '';
    for (let i = 0; i < nrRanduri; i++) randuri += `<div class="mj-rand"><div class="mj-gol" onclick="masajFormNou(${MJ_DESCHIDE + i * MJ_PAS}, null, '${z}')"></div></div>`;
    const blocuri = masajRez.filter(r => r.data === z).map(r => {
      const top = (r.minute - MJ_DESCHIDE) / MJ_PAS * MJ_INALT + 3;
      const inalt = r.durata_min / MJ_PAS * MJ_INALT - 6;
      return `<div class="mj-rez ${r.status}" style="top:${top}px;height:${inalt}px" onclick="masajDetalii('${r.id}')">
        <div class="mj-etichete">${r.pachet_id ? '<span>pachet</span>' : ''}${r.plata_metoda ? '<span class="ok">plătit</span>' : ''}</div>
        <b>${scapaHtml(r.nume + ' ' + r.prenume)}</b><small>${mjOra(r.minute)} - ${mjOra(r.minute + r.durata_min)} · ${r.durata_min} min</small></div>`;
    }).join('');
    return `<div class="mj-col ${z === astazi ? 'azi' : ''}">${randuri}<div class="mj-straturi">${blocuri}</div></div>`;
  }).join('');
  panou.innerHTML = `<div class="mj-wrap lat">
    ${tabsCalendarHtml('masaj')}
    <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;margin-bottom:12px">
      <div style="font-size:13px;color:#9a988e">${LUNI_RO[luna.getMonth()]} ${luna.getFullYear()}</div>
      <div style="display:flex;justify-content:center">
        <div class="week-nav">
          <button class="week-nav-btn" onclick="schimbaSaptamanaMasaj(-1)">&larr; Saptamana trecuta</button>
          <button class="week-nav-btn azi" onclick="masajSaptamanaAceasta()">Azi</button>
          <button class="week-nav-btn" onclick="schimbaSaptamanaMasaj(1)">Saptamana urmatoare &rarr;</button>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end"><button class="btn mj-btn" onclick="masajFormNou(null)">+ Masaj</button></div>
    </div>
    <div class="mj-sapt">
      <div class="mj-cap"></div>
      ${zile.map((z, i) => `<div class="mj-cap ${z === astazi ? 'azi' : ''}">${ZILE_SAPTAMANA[i]}<small>${new Date(z + 'T00:00:00').toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' })}</small></div>`).join('')}
      <div class="mj-ore-col">${ore}</div>
      ${coloane}
    </div>
  </div>`;
}

async function incarcaMasajZi() {
  document.body.classList.remove('pagina-fara-scroll');   // ziua de masaj e mai lunga decat ecranul: trebuie sa deruleze
  const panou = document.getElementById('panel-calendar');
  const rows = await apel(`/api/masaj?de_la=${masajZi}&pana_la=${masajZi}`);
  masajRez = Array.isArray(rows) ? rows : [];
  const d = new Date(masajZi + 'T00:00:00');
  const astazi = dataLocala(new Date());
  const nrRanduri = (MJ_INCHIDE - MJ_DESCHIDE) / MJ_PAS;
  let grila = '';
  for (let i = 0; i < nrRanduri; i++) {
    const m = MJ_DESCHIDE + i * MJ_PAS;
    grila += `<div class="mj-rand"><span class="mj-o">${mjOra(m)}</span><div class="mj-gol" onclick="masajFormNou(${m})"></div></div>`;
  }
  const blocuri = masajRez.map(r => {
    const top = (r.minute - MJ_DESCHIDE) / MJ_PAS * MJ_INALT + 3;
    const inalt = r.durata_min / MJ_PAS * MJ_INALT - 6;
    return `<div class="mj-rez ${r.status}" style="top:${top}px;height:${inalt}px" onclick="masajDetalii('${r.id}')">
      <div class="mj-etichete">${r.pachet_id ? '<span>pachet</span>' : ''}${r.plata_metoda ? '<span class="ok">plătit</span>' : ''}</div>
      <b>${scapaHtml(r.nume + ' ' + r.prenume)}</b><small>${mjOra(r.minute)} - ${mjOra(r.minute + r.durata_min)} · ${r.durata_min} min</small></div>`;
  }).join('');
  panou.innerHTML = `<div class="mj-wrap">
    ${tabsCalendarHtml('masaj')}
    <div class="day-nav">
      <button class="btn day-nav-arrow" onclick="schimbaZiuaMasaj(-1)">&larr;</button>
      <div class="day-nav-info" onclick="masajDeschideData()">
        <div class="day-nav-titlu">${ZILE_SAPTAMANA[d.getDay() - 1]}, ${d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'long' })}</div>
        ${masajZi === astazi ? '<div class="day-nav-azi">azi</div>' : '<div class="day-nav-azi clickabil" onclick="event.stopPropagation(); masajAzi()">&larr; inapoi la azi</div>'}
      </div>
      <button class="btn day-nav-arrow" onclick="schimbaZiuaMasaj(1)">&rarr;</button>
      <input type="date" id="masaj-data-input" class="day-nav-date-input" value="${masajZi}" onchange="masajData(this.value)">
    </div>
    <button class="mj-add" onclick="masajFormNou(null)">+ Masaj</button>
    <div class="mj-grila">${grila}<div class="mj-straturi">${blocuri}</div></div>
  </div>`;
}

// ---------- programare noua ----------

const MJ = { data: null, rez: [], p: null, pachete: [], dur: null, start: null, eroare: '' };
let mjCautareTimer = null, mjCautareToken = 0;

function mjLiber(start, dur) {
  if (start + dur > MJ_INCHIDE) return false;
  return !MJ.rez.some(r => r.status !== 'absent' && start < r.minute + r.durata_min && r.minute < start + dur);
}

async function masajFormNou(minute, pacient, data) {
  MJ.data = data || masajZi;
  MJ.rez = masajRez.filter(r => r.data === MJ.data);
  MJ.p = pacient || null;
  MJ.pachete = [];
  MJ.dur = null;
  MJ.start = minute;
  MJ.eroare = '';
  if (MJ.p) await mjIncarcaPachete();
  mjDeseneazaForm();
}

async function mjIncarcaPachete() {
  const r = await apel(`/api/masaj/pacient/${MJ.p.id}`);
  MJ.pachete = r && Array.isArray(r.pachete) ? r.pachete : [];
}

function mjPachetPentru(dur) {
  const azi = MJ.data;
  return MJ.pachete.find(p => p.durata_min === dur && p.ramase > 0 && (!p.valabil_pana_txt || p.valabil_pana_txt >= azi));
}

function mjDeseneazaForm() {
  const ziTxt = new Date(MJ.data + 'T00:00:00').toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
  let ore = '';
  for (let m = MJ_DESCHIDE; m < MJ_INCHIDE; m += MJ_PAS) {
    const ok = mjLiber(m, MJ.dur || 30);
    ore += `<button type="button" class="mj-ora ${MJ.start === m ? 'on' : ''}" ${ok ? '' : 'disabled'} onclick="MJ.start=${m}; mjDeseneazaForm()">${mjOra(m)}</button>`;
  }
  const pachet = MJ.dur ? mjPachetPentru(MJ.dur) : null;
  const gata = MJ.p && MJ.dur && MJ.start != null;
  const pretTxt = MJ.dur ? (pachet ? `din pachet (${pachet.ramase} rămase)` : `${MJ_PRET[MJ.dur]} lei`) : '';
  const infoPachet = MJ.p && MJ.pachete.some(p => p.ramase > 0)
    ? `<div class="mj-info">Are pachet: ${MJ.pachete.filter(p => p.ramase > 0).map(p => `${p.ramase} masaje de ${p.durata_min} min rămase${p.inclus ? ' (inclus în abonament)' : ''}`).join(', ')}.</div>` : '';
  document.getElementById('modal-container').innerHTML = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:100" onclick="if(event.target===this) inchideModalProgramare()">
      <div class="card" style="max-width:440px;width:92%;max-height:calc(100vh - 32px);overflow-y:auto">
        <h2 style="margin-bottom:10px">Masaj nou</h2>
        <label>Pacient</label>
        ${MJ.p
          ? `<div class="mj-ales"><b>${scapaHtml(MJ.p.nume + ' ' + MJ.p.prenume)}</b><span onclick="MJ.p=null; MJ.pachete=[]; mjDeseneazaForm()">schimbă</span></div>${infoPachet}`
          : `<input id="mj-cauta" placeholder="Cauta pacient" autocomplete="off" oninput="mjCautaDebounced(this.value)" style="width:100%" autofocus>
             <div id="mj-rez" class="mj-lista" style="display:none"></div>`}
        <label>Durata</label>
        <div class="mj-durate">
          <button type="button" class="mj-dur ${MJ.dur === 30 ? 'on' : ''}" onclick="MJ.dur=30; mjRecalculeaza()">30 min<small>${MJ_PRET[30]} lei</small></button>
          <button type="button" class="mj-dur ${MJ.dur === 50 ? 'on' : ''}" onclick="MJ.dur=50; mjRecalculeaza()">50 min<small>${MJ_PRET[50]} lei</small></button>
        </div>
        <label>Data</label>
        <input type="date" id="mj-data" value="${MJ.data}" onchange="mjSchimbaData(this.value)" onclick="this.showPicker && this.showPicker()" style="width:100%">
        <label>Ora</label>
        <div class="mj-ore">${ore}</div>
        ${gata ? `<div class="mj-rezumat"><b>${scapaHtml(MJ.p.nume + ' ' + MJ.p.prenume)}</b><br>${ziTxt}, ${mjOra(MJ.start)} - ${mjOra(MJ.start + MJ.dur)} · ${MJ.dur} min<br>${pretTxt}</div>` : ''}
        <div id="mj-eroare" style="color:#e08585;font-size:12px;margin-top:8px">${scapaHtml(MJ.eroare)}</div>
        <button class="btn mj-btn" style="width:100%;margin-top:12px" ${gata ? '' : 'disabled'} onclick="masajProgrameaza()">Programează</button>
        <button class="btn secundar" style="width:100%;margin-top:8px" onclick="inchideModalProgramare()">Renunță</button>
      </div>
    </div>`;
  if (!MJ.p) { const c = document.getElementById('mj-cauta'); if (c) c.focus(); }
}

function mjRecalculeaza() {
  if (MJ.start != null && !mjLiber(MJ.start, MJ.dur || 30)) MJ.start = null;
  mjDeseneazaForm();
}

async function mjSchimbaData(v) {
  if (!v) return;
  const zi = new Date(v + 'T00:00:00').getDay();
  if (zi === 0 || zi === 6) { MJ.eroare = 'Masajul se face doar de luni pana vineri.'; mjDeseneazaForm(); return; }
  MJ.data = v;
  MJ.eroare = '';
  const rows = await apel(`/api/masaj?de_la=${v}&pana_la=${v}`);
  MJ.rez = Array.isArray(rows) ? rows : [];
  mjRecalculeaza();
}

function mjCautaDebounced(q) {
  clearTimeout(mjCautareTimer);
  mjCautareTimer = setTimeout(() => mjCauta(q), 150);
}

async function mjCauta(q) {
  const el = document.getElementById('mj-rez');
  if (!el) return;
  const text = (q || '').trim();
  const id = ++mjCautareToken;
  if (text.length < 2) { el.style.display = 'none'; return; }
  const rows = await apel(`/api/pacienti?q=${encodeURIComponent(text)}`);
  if (id !== mjCautareToken || !document.getElementById('mj-rez')) return;
  MJ.gasiti = Array.isArray(rows) ? rows.slice(0, 8) : [];
  el.style.display = 'block';
  el.innerHTML = MJ.gasiti.map((p, i) => `<div onclick="mjAlegePacient(${i})">${scapaHtml(p.nume + ' ' + p.prenume)}<small>${scapaHtml(p.diagnostic || '')}</small></div>`).join('')
    || '<div style="color:#9a988e">Niciun pacient gasit.</div>';
}

async function mjAlegePacient(i) {
  const p = MJ.gasiti[i];
  if (!p) return;
  MJ.p = { id: p.id, nume: p.nume, prenume: p.prenume };
  await mjIncarcaPachete();
  mjDeseneazaForm();
}

async function masajProgrameaza() {
  const r = await apel('/api/masaj', {
    method: 'POST',
    body: JSON.stringify({ pacient_id: MJ.p.id, data_ora: `${MJ.data} ${mjOra(MJ.start)}:00`, durata_min: MJ.dur })
  });
  if (r && r.eroare) { MJ.eroare = r.eroare; mjDeseneazaForm(); return; }
  inchideModalProgramare();
  masajZi = MJ.data;
  masajSapt = luniAlSaptamanii(MJ.data);   // calendarul sare la saptamana masajului nou
  if (document.getElementById('masaj-fisa')) incarcaMasajFisa(MJ.p.id);
  if (document.querySelector('.mj-wrap')) incarcaCalendarMasaj();
}

// ---------- un masaj existent ----------

function masajDetalii(id) {
  const r = masajRez.find(x => x.id === id);
  if (!r) return;
  const plata = (m, txt) => `<button class="btn ${r.plata_metoda === m ? 'mj-btn' : 'secundar'}" style="flex:1" onclick="masajPlata('${r.id}', ${r.plata_metoda === m ? 'null' : `'${m}'`})">${txt}</button>`;
  document.getElementById('modal-container').innerHTML = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:100" onclick="if(event.target===this) inchideModalProgramare()">
      <div class="card" style="max-width:380px;width:92%">
        <h2 style="margin-bottom:2px">${scapaHtml(r.nume + ' ' + r.prenume)}</h2>
        <div style="font-size:13px;color:#9a988e;margin-bottom:14px">${mjOra(r.minute)} - ${mjOra(r.minute + r.durata_min)} · ${r.durata_min} min${r.pachet_id ? ' · din pachet' : ' · ' + MJ_PRET[r.durata_min] + ' lei'}</div>
        <div style="display:flex;gap:8px">
          <button class="btn ${r.status === 'prezent' ? '' : 'secundar'}" style="flex:1;${r.status === 'prezent' ? '' : 'color:#4fb38a'}" onclick="masajStare('${r.id}','prezent')">Prezent</button>
          <button class="btn ${r.status === 'absent' ? '' : 'secundar'}" style="flex:1;${r.status === 'absent' ? 'background:#c2504a;border-color:#a13f3a' : 'color:#e08585'}" onclick="masajStare('${r.id}','absent')">Absent</button>
        </div>
        ${r.pachet_id
          ? '<div style="font-size:12px;color:#9a988e;margin-top:14px">Masajul face parte dintr-un pachet, nu are plata separata.</div>'
          : `<label style="margin-top:14px">Plata · ${MJ_PRET[r.durata_min]} lei</label><div style="display:flex;gap:8px">${plata('cash', 'Cash')}${plata('card', 'Card')}</div>
             <div style="font-size:12px;color:#9a988e;margin-top:6px">${r.plata_metoda ? 'Platit ' + (r.plata_metoda === 'cash' ? 'cash' : 'cu cardul') + '. Apare la incasari.' : 'Inca neplatit.'}</div>`}
        <button class="btn secundar" style="width:100%;margin-top:14px;color:#e08585" onclick="masajSterge('${r.id}')">Sterge masajul</button>
        <button class="btn secundar" style="width:100%;margin-top:8px" onclick="inchideModalProgramare()">Inchide</button>
      </div>
    </div>`;
}

async function masajStare(id, stare) {
  const r = masajRez.find(x => x.id === id);
  await apel(`/api/masaj/${id}`, { method: 'PATCH', body: JSON.stringify({ status: r && r.status === stare ? 'programat' : stare }) });
  inchideModalProgramare();
  incarcaCalendarMasaj();
}

async function masajPlata(id, metoda) {
  await apel(`/api/masaj/${id}`, { method: 'PATCH', body: JSON.stringify({ plata_metoda: metoda }) });
  inchideModalProgramare();
  incarcaCalendarMasaj();
}

function masajSterge(id) {
  aratatPopupConfirmare({ titlu: 'Stergi masajul?', mesaj: 'Daca era platit, si plata se sterge.', textConfirma: 'Sterge', periculos: true }, async () => {
    await apel(`/api/masaj/${id}`, { method: 'DELETE' });
    incarcaCalendarMasaj();
  });
}

// ---------- fisa pacientului: pachete si istoric de masaj ----------

async function incarcaMasajFisa(pacientId) {
  const box = document.getElementById('masaj-fisa');
  if (!box) return;
  const r = await apel(`/api/masaj/pacient/${pacientId}`);
  if (!r || !Array.isArray(r.pachete) || !document.getElementById('masaj-fisa')) return;
  const pacient = { id: pacientId, nume: box.dataset.nume || '', prenume: box.dataset.prenume || '' };
  window.__masajPacient = pacient;
  const stari = { programat: 'programat', prezent: 'prezent', absent: 'absent' };
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
      <h2 style="margin:0">Masaj</h2>
      <div style="display:flex;gap:8px"><button class="btn secundar" onclick="masajPachetNou('${pacientId}')">+ Pachet</button><button class="btn mj-btn" onclick="masajFormNou(null, window.__masajPacient)">+ Masaj</button></div>
    </div>
    ${r.pachete.length ? r.pachete.map(p => `
      <div class="mj-pachet">
        <div><b>${p.total} masaje de ${p.durata_min} min</b>${p.inclus ? ' <span class="mj-tag">inclus în abonament</span>' : ''}
          <div style="font-size:12px;color:#9a988e">${p.ramase} rămase${p.valabil_pana_txt ? ' · valabil până pe ' + new Date(p.valabil_pana_txt + 'T00:00:00').toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' }) : ''}</div></div>
        <span class="ev-link" style="color:#e08585" onclick="masajStergePachet('${p.id}','${pacientId}')">Sterge</span>
      </div>`).join('') : '<div style="font-size:13px;color:#9a988e;margin-top:8px">Niciun pachet.</div>'}
    ${r.masaje.length ? `<div style="margin-top:10px;font-size:12px;color:#9a988e">Ultimele masaje</div>${r.masaje.slice(0, 6).map(m => `
      <div style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px solid #3a3937">
        <span>${new Date(m.data + 'T00:00:00').toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' })} ${m.ora} · ${m.durata_min} min</span>
        <span style="color:#9a988e">${stari[m.status]}${m.pachet_id ? ' · pachet' : m.plata_metoda ? ' · ' + m.plata_metoda : ''}</span>
      </div>`).join('')}` : ''}`;
}

function masajPachetNou(pacientId) {
  document.getElementById('modal-container').innerHTML = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:100" onclick="if(event.target===this) inchideModalProgramare()">
      <div class="card" style="max-width:400px;width:92%">
        <h2 style="margin-bottom:4px">Pachet de masaj</h2>
        <div style="font-size:12px;color:#9a988e;margin-bottom:12px">4 masaje, câte unul pe săptămână. Valabil 6 săptămâni.</div>
        <label>Durata</label>
        <div class="mj-durate">
          <button type="button" class="mj-dur on" id="mjp-30" onclick="mjPachetDur(30)">4 × 30 min<small>${MJ_PRET_PACHET[30]} lei</small></button>
          <button type="button" class="mj-dur" id="mjp-50" onclick="mjPachetDur(50)">4 × 50 min<small>${MJ_PRET_PACHET[50]} lei</small></button>
        </div>
        <label style="margin-top:12px">Plata</label>
        <div style="display:flex;gap:8px"><button class="btn mj-btn" style="flex:1" onclick="masajCumparaPachet('${pacientId}','cash')">Cash</button><button class="btn mj-btn" style="flex:1" onclick="masajCumparaPachet('${pacientId}','card')">Card</button></div>
        <button class="btn secundar" style="width:100%;margin-top:8px" onclick="masajCumparaPachet('${pacientId}', null)">Inclus în abonamentul de terapie (fără plată)</button>
        <div id="mjp-eroare" style="color:#e08585;font-size:12px;margin-top:8px"></div>
        <button class="btn secundar" style="width:100%;margin-top:8px" onclick="inchideModalProgramare()">Renunță</button>
      </div>
    </div>`;
  window.__mjPachetDur = 30;
}

function mjPachetDur(d) {
  window.__mjPachetDur = d;
  document.getElementById('mjp-30').classList.toggle('on', d === 30);
  document.getElementById('mjp-50').classList.toggle('on', d === 50);
}

async function masajCumparaPachet(pacientId, metoda) {
  const r = await apel('/api/masaj/pachete', {
    method: 'POST',
    body: JSON.stringify({ pacient_id: pacientId, durata_min: window.__mjPachetDur || 30, inclus: metoda === null, metoda })
  });
  if (r && r.eroare) { document.getElementById('mjp-eroare').textContent = r.eroare; return; }
  inchideModalProgramare();
  incarcaMasajFisa(pacientId);
}

function masajStergePachet(id, pacientId) {
  aratatPopupConfirmare({ titlu: 'Stergi pachetul?', mesaj: 'Masajele deja programate din el raman, dar nu mai sunt legate de pachet. Daca era platit, si plata se sterge.', textConfirma: 'Sterge', periculos: true }, async () => {
    await apel(`/api/masaj/pachete/${id}`, { method: 'DELETE' });
    incarcaMasajFisa(pacientId);
  });
}
