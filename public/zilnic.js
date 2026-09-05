// ---------- Date locale (fara cont, fara server: totul traieste in acest telefon) ----------
const CHEIE_DATE = 'reset-zilnic-date-v1';

function dateImplicite() {
  return {
    jurnal: {},
    memento: {
      hidratare: { activ: true, intervalMin: 120, ultima: 0 },
      miscare: { activ: true, intervalMin: 90, ultima: 0 },
      postura: { activ: false, intervalMin: 60, ultima: 0 }
    }
  };
}

let date = incarcaDate();

function incarcaDate() {
  try {
    const brut = localStorage.getItem(CHEIE_DATE);
    if (!brut) return dateImplicite();
    const parsat = JSON.parse(brut);
    return Object.assign(dateImplicite(), parsat, {
      memento: Object.assign(dateImplicite().memento, parsat.memento || {})
    });
  } catch {
    return dateImplicite();
  }
}

function salveazaDate() {
  localStorage.setItem(CHEIE_DATE, JSON.stringify(date));
}

function dataAzi() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function oraSalutului() {
  const h = new Date().getHours();
  if (h < 12) return 'Buna dimineata';
  if (h < 18) return 'Buna ziua';
  return 'Buna seara';
}

// ---------- Biblioteca de exercitii (30sec - 1min, fara pretentii medicale) ----------
const EXERCITII = [
  { id: 'gat-rotatii', zona: 'gat', tip: 'miscare', titlu: 'Rotatii lente de gat', durata: 30,
    text: 'Roteste capul lent, in cerc, de 3 ori intr-o parte, apoi 3 ori in cealalta. Miscari line, fara sa fortezi.' },
  { id: 'umeri-ridicari', zona: 'umeri', tip: 'miscare', titlu: 'Ridicari de umeri', durata: 30,
    text: 'Ridica umerii spre urechi, tine 2 secunde, apoi lasa-i jos relaxat. Repeta de 8-10 ori.' },
  { id: 'gat-lateral', zona: 'gat', tip: 'miscare', titlu: 'Intindere laterala de gat', durata: 45,
    text: 'Apleaca usor capul spre umarul drept pana simti o intindere usoara pe partea stanga a gatului. Tine 15-20 secunde, apoi schimba partea.' },
  { id: 'spate-pisica', zona: 'spate', tip: 'miscare', titlu: 'Pisica-camila, asezat', durata: 45,
    text: 'Asezat pe scaun, pune mainile pe genunchi. Arcuieste spatele inainte, apoi rotunjeste-l inapoi. Repeta lent de 6-8 ori.' },
  { id: 'spate-rasucire', zona: 'spate', tip: 'miscare', titlu: 'Rasucire usoara a trunchiului', durata: 30,
    text: 'Asezat, tine spatele drept si roteste lent trunchiul spre dreapta, tine 5 secunde, revino, apoi spre stanga.' },
  { id: 'picioare-varfuri', zona: 'picioare', tip: 'miscare', titlu: 'Ridicari pe varfuri', durata: 30,
    text: 'Din picioare, ridica-te pe varfuri, tine 2 secunde, coboara lent. Repeta de 10-12 ori - ajuta circulatia.' },
  { id: 'picioare-glezne', zona: 'picioare', tip: 'miscare', titlu: 'Rotatii de glezna', durata: 30,
    text: 'Asezat, ridica un picior si roteste glezna de 8 ori intr-o directie, apoi 8 ori in cealalta. Schimba piciorul.' },
  { id: 'general-intindere', zona: 'general', tip: 'miscare', titlu: 'Marea intindere', durata: 30,
    text: 'Ridica bratele deasupra capului, intinde-te bine pe toata lungimea corpului, apoi lasa-le jos expirand lung. Repeta de 3 ori.' },
  { id: 'general-relaxare', zona: 'general', tip: 'miscare', titlu: 'Relaxare musculara rapida', durata: 60,
    text: 'Incordeaza toti muschii corpului 5 secunde (pumni, umeri, picioare), apoi relaxeaza brusc totul. Repeta de 3 ori.' },
  { id: 'resp-4-7-8', zona: 'respiratie', tip: 'respiratie', titlu: 'Respiratie 4-7-8 (pentru somn)',
    text: 'Ajuta sa adormi mai repede.', cicluri: 3, faze: [
      { eticheta: 'Inspira', sec: 4 }, { eticheta: 'Tine', sec: 7 }, { eticheta: 'Expira', sec: 8 }
    ] },
  { id: 'resp-cutie', zona: 'respiratie', tip: 'respiratie', titlu: 'Respiratie in cutie (pentru stres)',
    text: 'Calmeaza rapid sistemul nervos.', cicluri: 4, faze: [
      { eticheta: 'Inspira', sec: 4 }, { eticheta: 'Tine', sec: 4 }, { eticheta: 'Expira', sec: 4 }, { eticheta: 'Tine', sec: 4 }
    ] },
  { id: 'resp-calmanta', zona: 'respiratie', tip: 'respiratie', titlu: 'Respiratie calmanta',
    text: 'Expiratia lunga linisteste corpul rapid.', cicluri: 5, faze: [
      { eticheta: 'Inspira', sec: 4 }, { eticheta: 'Expira', sec: 6 }
    ] }
];

const ZONE = [
  { id: 'gat', eticheta: 'Gat' },
  { id: 'umeri', eticheta: 'Umeri' },
  { id: 'spate', eticheta: 'Spate' },
  { id: 'picioare', eticheta: 'Picioare/solduri' },
  { id: 'general', eticheta: 'Tensiune generala' },
  { id: 'nimic', eticheta: 'Nimic, sunt bine' }
];

function exercitiiPentruZone(zoneSelectate) {
  const alese = [];
  for (const zona of zoneSelectate) {
    if (zona === 'nimic') continue;
    const ex = EXERCITII.find(e => e.zona === zona && e.tip === 'miscare' && !alese.includes(e));
    if (ex) alese.push(ex);
    if (alese.length >= 2) break;
  }
  return alese;
}

function exercitiuDupaId(id) {
  return EXERCITII.find(e => e.id === id);
}

// ---------- Navigare intre ecrane ----------
function aratavizual(id) {
  document.querySelectorAll('.vizual').forEach(v => v.style.display = 'none');
  document.getElementById(id).style.display = 'block';
  document.getElementById('nav-jos').style.display = ['vizual-acasa', 'vizual-exercitii', 'vizual-setari'].includes(id) ? 'flex' : 'none';
  document.querySelectorAll('.nav-buton').forEach(b => b.classList.toggle('activ', b.dataset.tinta === id));
  window.scrollTo(0, 0);
}

// ---------- Streak ----------
function calculStreak() {
  let streak = 0;
  let d = new Date();
  // daca azi inca nu a facut niciun checkin, verificarea porneste de ieri (nu ii rupem streak-ul degeaba seara devreme)
  if (!date.jurnal[dataAzi()]) d.setDate(d.getDate() - 1);
  while (true) {
    const cheie = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (date.jurnal[cheie]) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

// ---------- Ecranul Acasa ----------
function renderAcasa() {
  document.getElementById('salut').textContent = oraSalutului();
  const azi = date.jurnal[dataAzi()] || {};
  const streak = calculStreak();
  document.getElementById('streak-text').textContent = streak > 0
    ? `${streak} ${streak === 1 ? 'zi' : 'zile'} la rand`
    : 'Inca niciun check-in - hai sa incepem';

  const cont = document.getElementById('carduri-checkin');
  cont.innerHTML = '';

  if (!azi.dimineata) {
    cont.innerHTML += cardCheckin('dimineata', 'Check-in de dimineata', 'Cateva secunde: cum ai dormit si cum te simti azi.');
  }
  if (!azi.seara) {
    cont.innerHTML += cardCheckin('seara', 'Check-in de seara', 'Cum a fost ziua si un exercitiu de relaxare, daca vrei.');
  }
  if (azi.dimineata && azi.seara) {
    cont.innerHTML += `<div class="card"><div class="card-titlu">Bravo, ai bifat ambele check-in-uri azi.</div><div class="card-text">Poti oricand sa faci un exercitiu scurt din tabul Exercitii.</div></div>`;
  }
}

function cardCheckin(tip, titlu, text) {
  return `<div class="card card-actiune" onclick="incepeCheckin('${tip}')">
    <div class="card-titlu">${titlu}</div>
    <div class="card-text">${text}</div>
    <div class="card-sageata">Incepe &rarr;</div>
  </div>`;
}

// ---------- Wizard check-in ----------
let stareCheckin = null;

function incepeCheckin(tip) {
  stareCheckin = { tip, pas: 0, raspunsuri: {} };
  aratavizual('vizual-checkin');
  renderPasCheckin();
}

function renderPasCheckin() {
  const { tip, pas } = stareCheckin;
  const cont = document.getElementById('checkin-continut');
  const pasiDimineata = ['somn', 'dureri', 'exercitii', 'dispozitie', 'final'];
  const pasiSeara = ['dispozitie', 'stres', 'dureri', 'exercitii', 'respiratie', 'final'];
  const numePas = (tip === 'dimineata' ? pasiDimineata : pasiSeara)[pas];

  if (numePas === 'somn') {
    cont.innerHTML = scalaEmoji('Cum ai dormit azi noapte?', ['😩', '🙁', '😐', '🙂', '😴'], 'somn');
  } else if (numePas === 'dispozitie') {
    cont.innerHTML = scalaEmoji(tip === 'dimineata' ? 'Cum te simti in general azi?' : 'Cum a fost ziua ta?', ['😩', '🙁', '😐', '🙂', '😄'], 'dispozitie');
  } else if (numePas === 'stres') {
    cont.innerHTML = scalaEmoji('Cat de stresat(a) te simti acum?', ['😌', '🙂', '😐', '😟', '😣'], 'stres');
  } else if (numePas === 'dureri') {
    cont.innerHTML = selectorZone();
  } else if (numePas === 'exercitii') {
    const zone = stareCheckin.raspunsuri.zone || [];
    const exs = exercitiiPentruZone(zone);
    if (exs.length === 0) { urmatorulPasCheckin(); return; }
    cont.innerHTML = listaExercitiiRecomandate(exs);
  } else if (numePas === 'respiratie') {
    const stres = stareCheckin.raspunsuri.stres ?? 3;
    const recomandat = stres >= 4 ? 'resp-cutie' : 'resp-4-7-8';
    cont.innerHTML = pasRespiratieRecomandata(recomandat);
  } else if (numePas === 'final') {
    salveazaCheckinCurent();
    const streak = calculStreak();
    cont.innerHTML = `<div class="ecran-final">
      <div class="emoji-mare">✅</div>
      <div class="card-titlu">Check-in salvat${tip === 'seara' ? '. Somn usor!' : '!'}</div>
      <div class="card-text">${streak} ${streak === 1 ? 'zi' : 'zile'} la rand.</div>
      <button class="btn-mare" onclick="aratavizual('vizual-acasa'); renderAcasa();">Inapoi acasa</button>
    </div>`;
  }
}

function scalaEmoji(intrebare, emojiuri, cheie) {
  return `<div class="card-titlu centrat">${intrebare}</div>
    <div class="scala-emoji">
      ${emojiuri.map((e, i) => `<button class="buton-emoji" onclick="raspundeCheckin('${cheie}', ${i + 1})">${e}</button>`).join('')}
    </div>`;
}

function selectorZone() {
  const alese = stareCheckin.raspunsuri.zone || [];
  return `<div class="card-titlu centrat">Ai vreo durere, tensiune sau jena acum?</div>
    <div class="chips">
      ${ZONE.map(z => `<button class="chip ${alese.includes(z.id) ? 'chip-activ' : ''}" onclick="comutaZona('${z.id}')">${z.eticheta}</button>`).join('')}
    </div>
    <button class="btn-mare" style="margin-top:18px" onclick="urmatorulPasCheckin()">Continua</button>`;
}

function comutaZona(id) {
  let alese = stareCheckin.raspunsuri.zone || [];
  if (id === 'nimic') {
    alese = alese.includes('nimic') ? [] : ['nimic'];
  } else {
    alese = alese.filter(z => z !== 'nimic');
    alese = alese.includes(id) ? alese.filter(z => z !== id) : [...alese, id];
  }
  stareCheckin.raspunsuri.zone = alese;
  renderPasCheckin();
}

function listaExercitiiRecomandate(exs) {
  return `<div class="card-titlu centrat">Un exercitiu scurt te-ar putea ajuta</div>
    ${exs.map(e => `<div class="card">
      <div class="card-titlu">${e.titlu} · ${e.durata}s</div>
      <div class="card-text">${e.text}</div>
      <button class="btn-secundar" onclick="deschideExercitiu('${e.id}', true)">Fa exercitiul</button>
    </div>`).join('')}
    <button class="btn-mare" style="margin-top:8px" onclick="urmatorulPasCheckin()">Continua</button>`;
}

function pasRespiratieRecomandata(idRecomandat) {
  const ex = exercitiuDupaId(idRecomandat);
  return `<div class="card-titlu centrat">Vrei un exercitiu de respiratie inainte de culcare?</div>
    <div class="card">
      <div class="card-titlu">${ex.titlu}</div>
      <div class="card-text">${ex.text}</div>
      <button class="btn-secundar" onclick="deschideExercitiu('${ex.id}', true)">Incepe</button>
    </div>
    <button class="btn-mare" style="margin-top:8px" onclick="urmatorulPasCheckin()">Sar peste, continua</button>`;
}

function raspundeCheckin(cheie, valoare) {
  stareCheckin.raspunsuri[cheie] = valoare;
  urmatorulPasCheckin();
}

function urmatorulPasCheckin() {
  stareCheckin.pas++;
  renderPasCheckin();
}

function salveazaCheckinCurent() {
  const azi = dataAzi();
  if (!date.jurnal[azi]) date.jurnal[azi] = {};
  const r = stareCheckin.raspunsuri;
  if (stareCheckin.tip === 'dimineata') {
    date.jurnal[azi].dimineata = { somn: r.somn, dispozitie: r.dispozitie, zone: r.zone || [], ora: Date.now() };
  } else {
    date.jurnal[azi].seara = { dispozitie: r.dispozitie, stres: r.stres, zone: r.zone || [], ora: Date.now() };
  }
  salveazaDate();
}

// ---------- Ecranul Exercitii ----------
function renderExercitii() {
  const miscare = EXERCITII.filter(e => e.tip === 'miscare');
  const respiratie = EXERCITII.filter(e => e.tip === 'respiratie');
  const grupeaza = (lista, titluGrup) => `<div class="grup-titlu">${titluGrup}</div>` +
    lista.map(e => `<div class="card">
      <div class="card-titlu">${e.titlu}${e.durata ? ' · ' + e.durata + 's' : ''}</div>
      <div class="card-text">${e.text}</div>
      <button class="btn-secundar" onclick="deschideExercitiu('${e.id}', false)">Start</button>
    </div>`).join('');

  document.getElementById('lista-exercitii').innerHTML =
    grupeaza(miscare, 'Miscare & intindere') + grupeaza(respiratie, 'Respiratie');
}

// ---------- Exercitiu ghidat ----------
let cronometruExercitiu = null;
let exercitiuDinCheckin = false;

function deschideExercitiu(id, dinCheckin) {
  const ex = exercitiuDupaId(id);
  exercitiuDinCheckin = dinCheckin;
  aratavizual('vizual-exercitiu');
  document.getElementById('exercitiu-titlu').textContent = ex.titlu;
  document.getElementById('nav-jos').style.display = 'none';
  document.getElementById('buton-inapoi-exercitiu').onclick = () => {
    opresteExercitiuGhidat();
    if (dinCheckin) { aratavizual('vizual-checkin'); } else { aratavizual('vizual-exercitii'); }
  };

  if (ex.tip === 'respiratie') {
    porneteRespiratie(ex);
  } else {
    porneteTimerMiscare(ex);
  }
}

function porneteTimerMiscare(ex) {
  const cont = document.getElementById('exercitiu-continut');
  let ramas = ex.durata;
  cont.innerHTML = `<div class="card-text centrat" style="margin-bottom:20px">${ex.text}</div>
    <div class="cerc-progres" id="cerc-progres"><span id="numar-timer">${ramas}</span></div>
    <button class="btn-mare" style="margin-top:24px" onclick="finalizeazaExercitiuGhidat()">Am terminat</button>`;
  const cerc = document.getElementById('cerc-progres');
  const total = ex.durata;
  cronometruExercitiu = setInterval(() => {
    ramas--;
    document.getElementById('numar-timer').textContent = Math.max(ramas, 0);
    cerc.style.setProperty('--progres', `${((total - ramas) / total) * 360}deg`);
    if (ramas <= 0) finalizeazaExercitiuGhidat();
  }, 1000);
}

function porneteRespiratie(ex) {
  const cont = document.getElementById('exercitiu-continut');
  cont.innerHTML = `<div class="card-text centrat" style="margin-bottom:20px">${ex.text}</div>
    <div class="cerc-respiratie" id="cerc-respiratie"><span id="eticheta-respiratie"></span></div>
    <div class="card-text centrat" id="ciclu-respiratie" style="margin-top:16px"></div>
    <button class="btn-mare" style="margin-top:24px" onclick="finalizeazaExercitiuGhidat()">Am terminat</button>`;

  let ciclu = 1;
  let indexFaza = 0;
  const cerc = document.getElementById('cerc-respiratie');
  const eticheta = document.getElementById('eticheta-respiratie');
  const cicluText = document.getElementById('ciclu-respiratie');

  function ruleazaFaza() {
    if (ciclu > ex.cicluri) { finalizeazaExercitiuGhidat(); return; }
    const faza = ex.faze[indexFaza];
    eticheta.textContent = faza.eticheta;
    cicluText.textContent = `Ciclul ${ciclu} din ${ex.cicluri}`;
    cerc.style.transition = `transform ${faza.sec}s ease-in-out`;
    cerc.style.transform = faza.eticheta === 'Inspira' ? 'scale(1.35)' : (faza.eticheta === 'Expira' ? 'scale(0.75)' : cerc.style.transform);

    cronometruExercitiu = setTimeout(() => {
      indexFaza++;
      if (indexFaza >= ex.faze.length) { indexFaza = 0; ciclu++; }
      ruleazaFaza();
    }, faza.sec * 1000);
  }
  ruleazaFaza();
}

function opresteExercitiuGhidat() {
  clearInterval(cronometruExercitiu);
  clearTimeout(cronometruExercitiu);
}

function finalizeazaExercitiuGhidat() {
  opresteExercitiuGhidat();
  document.getElementById('exercitiu-continut').innerHTML = `<div class="ecran-final">
    <div class="emoji-mare">✅</div>
    <div class="card-titlu">Bravo!</div>
    <button class="btn-mare" onclick="${exercitiuDinCheckin ? "aratavizual('vizual-checkin')" : "aratavizual('vizual-exercitii')"}">Inapoi</button>
  </div>`;
}

// ---------- Setari & mementouri ----------
function renderSetari() {
  const m = date.memento;
  document.getElementById('setari-continut').innerHTML = randMemento('hidratare', '💧 Hidratare', m.hidratare) +
    randMemento('miscare', '🚶 Pauza activa / miscare', m.miscare) +
    randMemento('postura', '🧍 Verificare postura', m.postura) +
    `<div class="card">
      <div class="card-text">Mementourile apar intre orele 08:00-21:00, doar cat aplicatia e deschisa sau pornita pe telefon. Pe unele telefoane (mai ales iPhone), trebuie sa redeschizi aplicatia din cand in cand ca sa continue sa functioneze.</div>
      <button class="btn-secundar" style="margin-top:10px" onclick="cerePermisiuneNotificari()">Activeaza notificarile</button>
      <div class="card-text" id="stare-permisiune" style="margin-top:8px"></div>
    </div>`;
  actualizeazaStarePermisiune();
}

function randMemento(cheie, titlu, config) {
  return `<div class="card">
    <div class="card-titlu">
      <label class="comutator">
        <input type="checkbox" ${config.activ ? 'checked' : ''} onchange="comutaMemento('${cheie}', this.checked)">
        <span>${titlu}</span>
      </label>
    </div>
    <div class="card-text">La fiecare
      <select onchange="schimbaIntervalMemento('${cheie}', this.value)">
        ${[30, 60, 90, 120, 180].map(m => `<option value="${m}" ${config.intervalMin === m ? 'selected' : ''}>${m} min</option>`).join('')}
      </select>
    </div>
  </div>`;
}

function comutaMemento(cheie, activ) {
  date.memento[cheie].activ = activ;
  salveazaDate();
}

function schimbaIntervalMemento(cheie, valoare) {
  date.memento[cheie].intervalMin = parseInt(valoare, 10);
  salveazaDate();
}

function cerePermisiuneNotificari() {
  if (!('Notification' in window)) return;
  Notification.requestPermission().then(actualizeazaStarePermisiune);
}

function actualizeazaStarePermisiune() {
  const el = document.getElementById('stare-permisiune');
  if (!el || !('Notification' in window)) return;
  const stari = { granted: 'Notificarile sunt active.', denied: 'Notificarile sunt blocate din setarile telefonului.', default: 'Notificarile nu sunt activate inca.' };
  el.textContent = stari[Notification.permission];
}

// ---------- Motorul de mementouri (functioneaza cat timp pagina e deschisa) ----------
const MESAJE_MEMENTO = {
  hidratare: { titlu: 'Hidratare', text: 'Timp sa bei un pahar cu apa.' },
  miscare: { titlu: 'Pauza activa', text: 'Ridica-te 2 minute si misca-te putin.' },
  postura: { titlu: 'Postura', text: 'Verifica-ti postura - umeri relaxati, spate drept.' }
};

function initMotorMemento() {
  const acum = Date.now();
  for (const cheie in date.memento) {
    if (!date.memento[cheie].ultima) date.memento[cheie].ultima = acum;
  }
  salveazaDate();
  setInterval(verificaMemento, 30000);
}

function verificaMemento() {
  const acum = Date.now();
  const ora = new Date().getHours();
  if (ora < 8 || ora >= 21) return;
  let s = false;
  for (const cheie in date.memento) {
    const m = date.memento[cheie];
    if (!m.activ) continue;
    if (acum - m.ultima >= m.intervalMin * 60000) {
      declanseazaMemento(cheie);
      m.ultima = acum;
      s = true;
    }
  }
  if (s) salveazaDate();
}

function declanseazaMemento(cheie) {
  const { titlu, text } = MESAJE_MEMENTO[cheie];
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(`RESET Zilnic - ${titlu}`, { body: text, icon: 'icon-192.png' }); } catch {}
  } else {
    aratatoast(`${titlu}: ${text}`);
  }
}

function aratatoast(text) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('vizibil'), 10);
  setTimeout(() => { t.classList.remove('vizibil'); setTimeout(() => t.remove(), 300); }, 5000);
}

// ---------- Instalare pe ecranul principal ----------
const ruleazaInstalat = window.navigator.standalone === true
  || window.matchMedia('(display-mode: standalone)').matches;

function ascundeBannerInstalare() {
  document.getElementById('banner-instalare').style.display = 'none';
  localStorage.setItem('reset-zilnic-banner-ascuns', '1');
}

function initInstalare() {
  if (ruleazaInstalat || localStorage.getItem('reset-zilnic-banner-ascuns')) return;
  document.getElementById('banner-instalare').style.display = 'block';
}

// ---------- Pornire ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw-zilnic.js').catch(() => {}));
}

renderAcasa();
renderExercitii();
renderSetari();
aratavizual('vizual-acasa');
initInstalare();
initMotorMemento();
