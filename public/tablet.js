let dateCheckin = null;

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
  const telefon = document.getElementById('telefon').value.trim();
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
    method: