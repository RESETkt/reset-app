let dateCheckin = null;
let telefonTastat = '';

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

function pregatesteCanvas(id) {
  const canvas = document.getElementById(id);
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
  const mută = (e) => { if (!deseneaza) return; const p = pozitie(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); };
  const stop = () => { deseneaza = false; };

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', mută);
  window.addEventListener('mouseup', stop);
  canvas.addEventListener('touchstart', start);
  canvas.addEventListener('touchmove', mută);
  canvas.addEventListener('touchend', stop);
}

function stergeCanvas(id) {
  const canvas = document.getElementById(id);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function canvasEsteGol(id) {
  const canvas = document.getElementById(id);
  const ctx = canvas.getContext('2d');
  const date = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  return !date.some((valoare, i) => i % 4 === 3 && valoare !== 0);
}

function ascundeToate() {
  ['pas-cautare', 'pas-gdpr', 'pas-confirmare', 'pas-gata'].forEach(id => {
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

  if (!data.gdpr_semnat) {
    ascundeToate();
    document.getElementById('pas-gdpr').style.display = 'block';
    const gdprR = await fetch('/api/gdpr/text');
    const gdprData = await gdprR.json();
    document.getElementById('gdpr-text').textContent = gdprData.text;
    pregatesteCanvas('canvas-gdpr');
  } else {
    aratatConfirmare();
  }
}

async function trimiteGDPR() {
  if (canvasEsteGol('canvas-gdpr')) { alert('Semneaza inainte de a confirma.'); return; }
  const semnatura_svg = document.getElementById('canvas-gdpr').toDataURL();
  const r = await fetch(`/api/gdpr/${dateCheckin.pacient.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ semnatura_svg })
  });
  if (!r.ok) { const d = await r.json(); alert(d.eroare); return; }
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

  pregatesteCanvas('canvas-sedinta');
}

async function trimiteConfirmareSedinta() {
  if (!dateCheckin.programare) { alert('Nu exista o programare azi de confirmat.'); return; }
  if (canvasEsteGol('canvas-sedinta')) { alert('Semneaza inainte de a confirma.'); return; }

  const semnatura_svg = document.getElementById('canvas-sedinta').toDataURL();
  await fetch(`/api/checkin/${dateCheckin.programare.id}/confirma`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ semnatura_svg })
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