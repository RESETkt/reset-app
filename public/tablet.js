let dateCheckin = null;
let telefonTastat = '';

function comutaFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
}

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
  const r = await fetch(`/api/checkin/sugestii?prefix=${encodeURIComponent(telefonTastat)}`);
  const rezultate = await r.json();
  el.innerHTML = rezultate.map(p => `
    <span class="sugestie-btn" onclick="selecteazaSugestie('${p.telefon}')">${p.prenume}</span>
  `).join('');
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

  const r = await fetch(`/api/checkin?telefon=${encodeURIComponent(telefon)}`);
  const data = await r.json();
  if (!r.ok) { eroareEl.textContent = data.eroare; return; }

  dateCheckin = data;
  aratatConfirmare();
}

function aratatConfirmare() {
  ascundeToate();
  document.getElementById('pas-confirmare').style.display = 'block';
  document.getElementById('salut-nume').textContent = `Hai, ca bine a fi, ${dateCheckin.pacient.prenume}!`;

  if (dateCheckin.programare) {
    const ora = new Date(dateCheckin.programare.data_ora).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('detalii-programare').textContent = `Programare confirmata, azi ${ora}`;
  } else {
    document.getElementById('detalii-programare').textContent = 'Nu am gasit o programare azi pentru acest numar.';
  }

  const ab = dateCheckin.abonament;
  document.getElementById('sedinte-ramase').textContent = ab
    ? `${ab.total_sedinte - ab.sedinte_efectuate} / ${ab.total_sedinte}`
    : '-';
}

async function trimiteConfirmareSedinta() {
  if (!dateCheckin.programare) { alert('Nu exista o programare azi de confirmat.'); return; }

  await fetch(`/api/checkin/${dateCheckin.programare.id}/confirma`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  ascundeToate();
  document.getElementById('pas-gata').style.display = 'block';
  setTimeout(() => {
    dateCheckin = null;
    golesteTelefon();
    ascundeToate();
    document.getElementById('pas-cautare').style.display = 'block';
  }, 4000);
}