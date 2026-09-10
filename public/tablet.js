let dateCheckin = null;
let telefonTastat = '';

const ruleazaInstalat = window.navigator.standalone === true
  || window.matchMedia('(display-mode: standalone)').matches;

function reincarcaAplicatia() {
  if ((telefonTastat || dateCheckin) && !confirm('Reincarci aplicatia? Se pierde ce e completat acum pe ecran.')) return;
  location.reload();
}

function comutaTema() {
  const zi = document.documentElement.classList.toggle('zi');
  localStorage.setItem('reset-tablet-tema', zi ? 'zi' : 'noapte');
  actualizeazaIconTema();
}

function actualizeazaIconTema() {
  const zi = document.documentElement.classList.contains('zi');
  const buton = document.getElementById('buton-tema');
  buton.textContent = zi ? '☾' : '☀';
  buton.title = zi ? 'Comuta in mod noapte' : 'Comuta in mod zi';
}

function ascundeBannerInstalare() {
  document.getElementById('banner-instalare').style.display = 'none';
  localStorage.setItem('reset-tablet-banner-ascuns', '1');
}

function initInstalare() {
  if (ruleazaInstalat) return;
  if (!localStorage.getItem('reset-tablet-banner-ascuns')) {
    document.getElementById('banner-instalare').style.display = 'flex';
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw-tablet.js').catch(() => {}));
}

initInstalare();
actualizeazaIconTema();

// Reseteaza ecranul daca cineva incepe sa introduca un numar si pleaca fara sa termine,
// ca urmatorul pacient sa gaseasca mereu tastatura goala, nu un ecran pe jumatate completat.
// Pe ecranul de confirmare (nume + sedinte ramase ale altcuiva) timpul e mai scurt, ca datele
// personale sa nu ramana vizibile prea mult daca pacientul pleaca fara sa apese Confirma.
let timerInactivitate = null;
function reseteazaTimerInactivitate() {
  clearTimeout(timerInactivitate);
  if (telefonTastat === '' && document.getElementById('pas-cautare').style.display !== 'none') return;
  const peConfirmare = document.getElementById('pas-confirmare').style.display !== 'none';
  timerInactivitate = setTimeout(() => {
    dateCheckin = null;
    golesteTelefon();
    ascundeToate();
    document.getElementById('pas-cautare').style.display = 'block';
  }, peConfirmare ? 12000 : 30000);
}
document.addEventListener('click', reseteazaTimerInactivitate);
document.addEventListener('touchstart', reseteazaTimerInactivitate);

function apasaCifra(cifra) {
  telefonTastat += cifra;
  actualizeazaAfisajTelefon();
  incarcaSugestii();
}

function stergeCifra() {
  telefonTastat = telefonTastat.slice(0, -1);
  actualizeazaAfisajTelefon();
  incarcaSugestii();
}

function golesteTelefon() {
  telefonTastat = '';
  actualizeazaAfisajTelefon();
  document.getElementById('sugestii-telefon').innerHTML = '';
}

function actualizeazaAfisajTelefon() {
  document.getElementById('afisaj-telefon').textContent = telefonTastat || '\u00a0';
  document.getElementById('btn-continua').disabled = telefonTastat.length === 0;
}

async function incarcaSugestii() {
  const el = document.getElementById('sugestii-telefon');
  if (telefonTastat.length < 4) { el.innerHTML = ''; return; }
  try {
    const r = await fetch(`/api/checkin/sugestii?prefix=${encodeURIComponent(telefonTastat)}`);
    const rezultate = await r.json();
    el.innerHTML = rezultate.map(p => `
      <span class="sugestie-btn" onclick="selecteazaSugestie('${p.telefon}')">${p.prenume} ..${p.telefon.slice(-2)}</span>
    `).join('');
  } catch {
    // sugestiile sunt doar un ajutor optional - o eroare de retea aici nu trebuie sa opreasca tastarea
  }
}

function selecteazaSugestie(telefon) {
  telefonTastat = telefon;
  actualizeazaAfisajTelefon();
  document.getElementById('sugestii-telefon').innerHTML = '';
  cautaProgramare();
}

function ascundeToate() {
  ['pas-cautare', 'pas-confirmare', 'pas-gata'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
}

async function cautaProgramare() {
  const telefon = telefonTastat.trim();
  const eroareEl = document.getElementById('eroare-cautare');
  eroareEl.textContent = '';
  if (!telefon) { eroareEl.textContent = 'Introdu un numar de telefon.'; return; }

  let r, data;
  try {
    r = await fetch(`/api/checkin?telefon=${encodeURIComponent(telefon)}`);
    data = await r.json();
  } catch {
    eroareEl.textContent = 'Nu am conexiune la internet. Incearca din nou.';
    return;
  }
  if (!r.ok) { eroareEl.textContent = (data.eroare || 'Eroare necunoscuta') + ' - cere ajutorul receptiei.'; return; }

  dateCheckin = data;
  aratatConfirmare();
}

function aratatConfirmare() {
  ascundeToate();
  document.getElementById('pas-confirmare').style.display = 'block';
  document.getElementById('salut-nume').textContent = `Hai, ca bine a fi, ${dateCheckin.pacient.prenume}!`;
  document.getElementById('eroare-confirmare').textContent = '';

  if (dateCheckin.programare) {
    const ora = new Date(dateCheckin.programare.data_ora).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('detalii-programare').textContent = `Programare confirmata, azi ${ora}`;
  } else {
    document.getElementById('detalii-programare').textContent = 'Nu am gasit o programare azi pentru acest numar.';
  }
  document.getElementById('btn-confirma-prezenta').disabled = !dateCheckin.programare;

  const ab = dateCheckin.abonament;
  document.getElementById('sedinte-ramase').textContent = ab
    ? `${ab.total_sedinte - ab.sedinte_efectuate} / ${ab.total_sedinte}`
    : '-';
}

function inapoiLaCautare() {
  dateCheckin = null;
  golesteTelefon();
  ascundeToate();
  document.getElementById('pas-cautare').style.display = 'block';
}

async function trimiteConfirmareSedinta() {
  if (!dateCheckin.programare) return;

  const buton = document.getElementById('btn-confirma-prezenta');
  const eroareEl = document.getElementById('eroare-confirmare');
  eroareEl.textContent = '';
  buton.disabled = true;

  let r;
  try {
    r = await fetch(`/api/checkin/${dateCheckin.programare.id}/confirma`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
  } catch {
    eroareEl.textContent = 'Nu am conexiune la internet. Incearca din nou.';
    buton.disabled = false;
    return;
  }

  if (!r.ok) {
    eroareEl.textContent = 'Nu am putut confirma prezenta. Incearca din nou sau cere ajutorul receptiei.';
    buton.disabled = false;
    return;
  }

  ascundeToate();
  document.getElementById('pas-gata').style.display = 'block';
  setTimeout(() => {
    dateCheckin = null;
    golesteTelefon();
    ascundeToate();
    document.getElementById('pas-cautare').style.display = 'block';
  }, 4000);
}