// Planul de lucru: ce au de lucrat colegii cu pacientul, scos singur din evaluare.
// Zonele de baza vin din testele colorate (galben/rosu/durere). Zonele extra (genunchi, cot, lombar...)
// se citesc din notitele kinetoterapeutului si apar cu inel rosu. Editarile (text, culoare, stergere)
// stau in date.plan.edit[cheie] al evaluarii, ca sa ramana cand evaluarea se modifica.
// Foloseste functiile din evaluare.js (evEl, evNormalizeaza, evCuloareTest etc.).

const EVP_R = '#e5594d', EVP_Y = '#e0b030', EVP_N = '#34332f', EVP_J = '#3f3e3a';

const EVP_CAT = { 1: 'Postură', 2: 'Mișcare', 3: 'Mobilitate', 4: 'Forță și stabilitate', 5: 'Stabilitate', 6: 'Mobilitate',
  7: 'Mobilitate', 8: 'Mobilitate', 9: 'Mobilitate', 10: 'Core', 11: 'Forță', 12: 'Stabilitate' };
const EVP_ZONE_TEST = { 1: ['cap'], 2: [], 3: ['glezna'], 4: ['picior'], 5: ['picior'], 6: ['umar'], 7: ['sold'], 8: ['toracal'],
  9: ['spatcoapsa'], 10: ['core'], 11: ['core', 'upper'], 12: ['core', 'lombar'] };
const EVP_TITLU = { 1: 'Cap și umeri', 2: 'Deep squat cu brațele sus', 3: 'Gleznă', 4: 'Picior', 5: 'Picior', 6: 'Umăr', 7: 'Șold',
  8: 'Toracal', 9: 'Spatele coapsei', 10: 'Core', 11: 'Core și upper body', 12: 'Core și lombar' };

const EVP_ZONA_NUME = { cap: 'Cap și umeri', gat: 'Gât', core: 'Core', upper: 'Upper body', umar: 'Umăr', cot: 'Cot', mana: 'Mână',
  sold: 'Șold', genunchi: 'Genunchi', picior: 'Picior', glezna: 'Gleznă', toracal: 'Toracal', interomoplat: 'Între omoplați',
  omoplat: 'Omoplat', lombar: 'Lombar', spatcoapsa: 'Spatele coapsei' };
const EVP_ZONA_SPATE = new Set(['toracal', 'interomoplat', 'omoplat', 'lombar', 'spatcoapsa']);
const EVP_ZONA_LATERALA = new Set(['umar', 'cot', 'mana', 'sold', 'genunchi', 'picior', 'glezna', 'omoplat', 'spatcoapsa']);

// Cum se scriu butoanele bifate in plan (pe test; ce nu e aici se scrie ca pe buton)
const EVP_CHIP = {
  1: { 'capul înainte': 'capul în proiecție anterioară', 'umerii în față': 'umeri rotunjiți', 'un umăr mai sus': 'un umăr mai sus decât celălalt', 'bazinul înclinat': 'bazin înclinat' },
  2: { 'călcâiele se ridică': 'ridică călcâiele', 'genunchii cad înăuntru': 'genunchii cad în valg', 'trunchiul se apleacă mult': 'compensează cu aplecarea trunchiului', 'brațele cad în față': 'nu menține brațele sus', 'spatele se rotunjește jos': 'spatele se rotunjește la coborâre', 'se mută pe o parte': 'se deplasează pe o parte' },
  3: { 'călcâiul se ridică': 'ridică călcâiul', 'genunchiul cade înăuntru': 'genunchiul cade în valg', 'piciorul se rotește în afară': 'compensează rotind piciorul în afară', 'jenă în fața gleznei': 'blocaj în fața gleznei' },
  4: { 'genunchiul cade înăuntru': 'genunchiul cade în valg', 'bazinul coboară pe partea cealaltă': 'bazinul cade pe partea opusă', 'trunchiul se înclină': 'compensează cu trunchiul mișcarea de ridicare', 'se împinge cu celălalt picior': 'se ajută cu celălalt picior' },
  5: { 'trunchiul se înclină': 'compensează cu trunchiul ca să se echilibreze', 'piciorul ridicat atinge solul': 'pune piciorul jos', 'sare pe loc': 'sare pe loc ca să se echilibreze' },
  6: { 'spatele se arcuiește': 'arcuiește lombarul', 'coatele se îndoaie': 'nu menține coatele întinse', 'umerii urcă spre urechi': 'ridică umerii spre urechi' },
  7: { 'bazinul se ridică de pe masă': 'compensează ridicând bazinul', 'trunchiul se înclină': 'compensează cu trunchiul' },
  8: { 'bazinul se rotește': 'compensează prin rotația bazinului', 'genunchii se mișcă': 'compensează din genunchi', 'trunchiul se înclină lateral': 'compensează cu înclinarea laterală a trunchiului' },
  9: { 'genunchiul se îndoaie': 'nu poate ține genunchiul întins', 'celălalt picior se ridică': 'celălalt picior se ridică de pe sol', 'bazinul se rotește': 'compensează prin rotația bazinului' },
  10: { 'respiră doar din piept': 'respirație doar toracică', 'își ține respirația': 'își ține respirația în efort', 'abdomenul se bombează': 'pierde controlul abdominal, abdomenul se bombează' },
  11: { 'bazinul rămâne în urmă': 'bazinul nu urmează trunchiul', 'spatele se lasă': 'lombarul cedează' },
  12: { 'bazinul se rotește': 'compensează prin rotația bazinului', 'spatele se arcuiește': 'arcuiește lombarul', 'se sprijină să nu cadă': 'se sprijină ca să nu cadă', 'nu întinde complet': 'nu extinde complet brațul și piciorul' },
};

// ---------- ce e de lucrat, scos din evaluare ----------

function evpPeste(a, b) { // cea mai slaba dintre doua culori (g/r), ignora ce nu e galben/rosu
  const gr = x => (x === 'g' || x === 'r') ? x : null;
  a = gr(a); b = gr(b);
  if (!a) return b;
  if (!b) return a;
  return (a === 'r' || b === 'r') ? 'r' : 'g';
}

function evpCulori(t, st) {
  const out = { S: null, D: null, U: null };
  t.randuri.forEach(rd => Object.entries(st.r[rd.k]).forEach(([p, cel]) => { out[p] = evpPeste(out[p], cel.c); }));
  return out;
}

function evpPartiText(parti) { return parti.length === 2 ? 'D și S' : parti[0]; }

function evpItemeTeste(teste) {
  const iteme = [];
  EV_TESTE.forEach(t => {
    const st = teste[t.id], cs = evpCulori(t, st), zone = [];
    let c = null;
    let titlu = EVP_TITLU[t.id];
    const durere = !!st.durere;
    EVP_ZONE_TEST[t.id].forEach(z => {
      if (EVP_ZONA_LATERALA.has(z)) {
        const parti = [];
        ['D', 'S'].forEach(p => {
          const col = durere ? 'r' : evpPeste(cs[p], cs.U);
          if (!col) return;
          parti.push(p);
          zone.push({ z, p, c: col, ring: durere });
          c = evpPeste(c, col);
        });
        if (parti.length) titlu = EVP_TITLU[t.id] + ' ' + evpPartiText(parti);
      } else {
        const col = durere ? 'r' : evpPeste(evpPeste(cs.S, cs.D), cs.U);
        if (col) { zone.push({ z, c: col, ring: durere }); c = evpPeste(c, col); }
      }
    });
    if (!EVP_ZONE_TEST[t.id].length) c = durere ? 'r' : evpPeste(evpPeste(cs.S, cs.D), cs.U);
    if (!c) return;
    const fraze = EVP_CHIP[t.id] || {};
    iteme.push({
      key: 't' + t.id, tip: 'test', test: t.id, titlu, cat: EVP_CAT[t.id], sub: t.id === 2 ? '' : t.nume,
      c, durere, tags: st.comp.map(x => fraze[x] || x), nota: (st.nota || '').trim(), zone,
    });
  });
  return iteme;
}

// ---------- zone extra, citite din notite ----------

function evpFaraDiacritice(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

const EVP_CAUTA = [
  ['interomoplat', /intre omoplat\w*/],
  ['omoplat', /\bomoplat\w*/],
  ['genunchi', /\bgenunch\w*/],
  ['cot', /\b(cot|cotul|cotului|coate|coatele)\b/],
  ['mana', /\b(mana|maini|mainile|incheietur\w*|pumn\w*)\b/],
  ['umar', /\b(umar\w*|umer\w*)/],
  ['gat', /\b(gat|gatul|gatului|cervical\w*)\b/],
  ['lombar', /\blombar\w*/],
  ['toracal', /\b(torac\w*)/],
  ['sold', /\bsold\w*/],
  ['glezna', /\bglezn\w*/],
];
const EVP_PROBLEMA = [
  ['Durere', /\b(durere|dureri|dureros\w*|dureroas\w*|doare|dor)\b/],
  ['Tensiune', /\b(tensiune|tensionat\w*)\b/],
  ['Jenă', /\b(jena)\b/],
  ['Blocaj', /\b(blocaj|blocat\w*)\b/],
  ['Disconfort', /\b(disconfort|strang\w*|intepat\w*|inflam\w*)\b/],
];
const EVP_NEGAT = /\b(fara|nu are|nu simte|nu apare|nicio|nici o|nu exista|nu doare)\b/;

function evpExtra(teste) {
  const gasite = new Map();
  EV_TESTE.forEach(t => {
    const nota = (teste[t.id].nota || '').trim();
    if (!nota) return;
    nota.split(/[.;\n,]+/).forEach(clauza => {
      const brut = clauza.trim();
      if (!brut) return;
      const txt = evpFaraDiacritice(brut);
      if (EVP_NEGAT.test(txt)) return;
      const prob = EVP_PROBLEMA.find(([, re]) => re.test(txt));
      if (!prob) return;   // fara cuvant de problema (durere, doare, tensiune...) nu e semn de atentie
      const dr = /\b(d(?!-)|drept|dreapta|dreptul)\b/.test(txt), st = /\b(s(?!-)|stang|stanga|stangul)\b/.test(txt);
      const ambele = (dr && st) || /\b(ambii|ambele|bilateral)\b/.test(txt);
      const interomoplat = /intre omoplat/.test(txt);
      EVP_CAUTA.forEach(([z, re]) => {
        if (!re.test(txt)) return;
        if (z === 'omoplat' && interomoplat) return;
        const lat = EVP_ZONA_LATERALA.has(z);
        const parti = !lat ? [null] : ambele ? ['D', 'S'] : dr ? ['D'] : st ? ['S'] : [];
        // pe silueta: zona laterala doar cu partea scrisa. Fara parte, dar cu problema, apare doar in lista.
        const arataPeSilueta = lat ? parti.length > 0 : true;
        (parti.length ? parti : [null]).forEach(p => {
          const cheie = 'x' + z + (p || '');
          const e = gasite.get(cheie) || {
            key: cheie, tip: 'extra', z, p, c: 'r', cat: '', sub: '', durere: false, tags: [], nota: '', test: t.id,
            titlu: prob[0] + ' ' + EVP_ZONA_NUME[z].toLowerCase() + (p ? ' ' + p : ''),
            zone: arataPeSilueta ? [{ z, p: p || undefined, c: null, ring: true }] : [], clauze: [],
          };
          if (!e.titlu.startsWith('Durere') && prob[0] === 'Durere') e.titlu = 'Durere ' + EVP_ZONA_NUME[z].toLowerCase() + (p ? ' ' + p : '');
          if (!e.clauze.includes(brut)) e.clauze.push(brut);
          e.nota = e.clauze.join(', ');
          e.titlu = e.titlu.charAt(0).toUpperCase() + e.titlu.slice(1);
          gasite.set(cheie, e);
        });
      });
    });
  });
  return [...gasite.values()];
}

// Aplica editarile (ascuns / text / culoare) si da lista finala
function evpIteme(date) {
  const edit = (date.plan && date.plan.edit) || {};
  const toate = [...evpExtra(date.teste), ...evpItemeTeste(date.teste)];
  const vizibile = [], ascunse = [];
  toate.forEach(it => {
    const ed = edit[it.key] || {};
    it.ed = ed;
    if (ed.c && it.tip === 'test') { it.c = ed.c; it.cSuprascris = ed.c; }
    if (ed.ascuns) { ascunse.push(it); return; }
    vizibile.push(it);
  });
  return { vizibile, ascunse };
}

// ---------- silueta ----------

const evpLn = (x1, y1, x2, y2, w, c, op) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-opacity="${op || 1}"/>`;
const evpRr = (x, y, w, h, r, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}"/>`;
const evpCi = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;

function evpX(fata, p, d) { return 100 + (fata ? (p === 'D' ? -1 : 1) : (p === 'S' ? -1 : 1)) * d; }

// forma zonei (umplere), inelul din jurul ei si punctul unde pleaca linia etichetei
function evpGeom(z, p, fata) {
  const X = d => evpX(fata, p, d);
  switch (z) {
    case 'cap': return { fill: c => evpCi(100, 30, 17, c) + evpRr(68, 64, 64, 54, 16, c), ring: [100, 30, 23, 23], tint: [117, 30] };
    case 'gat': return { fill: c => evpRr(94, 48, 12, 14, 4, c), ring: [100, 55, 12, 12], tint: [108, 55] };
    case 'core': return { fill: c => evpRr(74, 122, 52, 48, 14, c), ring: [100, 146, 32, 34], tint: [126, 142] };
    case 'upper': return { fill: c => [-1, 1].map(k => evpLn(100 + k * 46, 80, 100 + k * 57, 128, 16, c, .75) + evpLn(100 + k * 58, 138, 100 + k * 65, 205, 14, c, .75)).join(''), ring: null, tint: [158, 165] };
    case 'umar': return { fill: c => evpCi(X(46), 76, 10, c), ring: [X(46), 76, 15, 15], tint: [X(46), 76] };
    case 'cot': return { fill: c => evpCi(X(57), 133, 9, c), ring: [X(57), 133, 14, 14], tint: [X(57), 133] };
    case 'mana': return { fill: c => evpCi(X(65), 210, 8, c), ring: [X(65), 210, 13, 13], tint: [X(65), 210] };
    case 'sold': return { fill: c => evpCi(X(14), 186, 11, c), ring: [X(14), 186, 16, 16], tint: [X(14), 186] };
    case 'genunchi': return { fill: c => evpCi(X(16), 288, 12, c), ring: [X(16), 288, 17, 17], tint: [X(16), 288] };
    case 'picior': return { fill: c => evpLn(X(12), 202, X(16), 282, 24, c) + evpLn(X(16), 294, X(19), 348, 20, c) + evpCi(X(16), 288, 12, c), ring: [X(15), 282, 21, 86], tint: [X(15), 250] };
    case 'glezna': return { fill: c => evpCi(X(19), 353, 11, c) + evpLn(X(19), 360, X(20), 392, 18, c), ring: [X(19), 372, 18, 28], tint: [X(19), 372] };
    case 'toracal': return { fill: c => evpRr(68, 64, 64, 54, 16, c), ring: [100, 92, 38, 30], tint: [100, 92] };
    case 'interomoplat': return { fill: () => '', ring: [100, 90, 14, 22], tint: [100, 90] };
    case 'omoplat': return { fill: c => evpCi(X(18), 88, 11, c), ring: [X(18), 88, 16, 16], tint: [X(18), 88] };
    case 'lombar': return { fill: c => evpRr(74, 122, 52, 48, 14, c), ring: [100, 146, 32, 34], tint: [100, 146] };
    case 'spatcoapsa': return { fill: c => evpLn(X(12), 202, X(16), 282, 24, c), ring: [X(14), 242, 19, 46], tint: [X(14), 242] };
  }
  return null;
}

function evpCorp(fata) {
  let s = evpCi(100, 30, 17, EVP_N) + evpRr(94, 48, 12, 14, 4, EVP_N) + evpRr(68, 64, 64, 54, 16, EVP_N)
    + evpRr(74, 122, 52, 48, 14, EVP_N) + evpRr(72, 174, 56, 20, 10, EVP_N);
  [-1, 1].forEach(k => {
    const x = d => 100 + k * d;
    s += evpLn(x(46), 80, x(57), 128, 16, EVP_N) + evpLn(x(58), 138, x(65), 205, 14, EVP_N)
      + evpLn(x(12), 202, x(16), 282, 24, EVP_N) + evpLn(x(16), 294, x(19), 348, 20, EVP_N) + evpLn(x(19), 360, x(20), 392, 18, EVP_N);
    s += evpCi(x(46), 76, 10, EVP_J) + evpCi(x(57), 133, 9, EVP_J) + evpCi(x(65), 210, 8, EVP_J)
      + evpCi(x(14), 186, 11, EVP_J) + evpCi(x(16), 288, 12, EVP_J) + evpCi(x(19), 353, 11, EVP_J);
    if (!fata) s += evpCi(x(18), 88, 11, EVP_J);
  });
  const lit = fata ? ['D', 'S'] : ['S', 'D'];
  return s + `<text class="evp-sd" x="22" y="16">${lit[0]}</text><text class="evp-sd" x="178" y="16">${lit[1]}</text>`;
}

function evpImparte(text, max) {
  const cuv = text.split(' '), linii = [];
  let cur = '';
  cuv.forEach(w => {
    if (cur && (cur + ' ' + w).length > max) { linii.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
  });
  if (cur) linii.push(cur);
  return linii;
}

function evpEsc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// iteme: lista vizibila; fata: true = din fata, false = din spate
function evpSvg(iteme, fata) {
  const FX = 150;
  const zone = new Map();   // cheia zonei -> { z, p, c, ring, cats }
  const extra = [];         // etichete pentru zonele din notite
  iteme.forEach(it => it.zone.forEach(zn => {
    const apartine = EVP_ZONA_SPATE.has(zn.z) ? !fata : fata;   // zona se vede pe silueta asta?
    if (!apartine) return;
    if (it.tip === 'extra') { extra.push({ z: zn.z, p: zn.p, titlu: it.titlu }); return; }
    const cheie = zn.z + (zn.p || '');
    const cur = zone.get(cheie) || { z: zn.z, p: zn.p, c: null, ring: false, cats: [] };
    cur.c = evpPeste(cur.c, it.cSuprascris || zn.c);
    cur.ring = cur.ring || zn.ring;
    if (it.cat) it.cat.toLowerCase().split(/ și |, /).forEach(w => { if (!cur.cats.includes(w)) cur.cats.push(w); });
    zone.set(cheie, cur);
  }));

  let umple = '', inele = '';
  const etichete = [];
  const adauga = (z, p, c, ring, text, sub) => {
    const g = evpGeom(z, p, fata);
    if (!g) return;
    // zona si eticheta ei sunt apasabile: arata detaliile punctelor din zona (evpArataZona)
    const k = z + (p || '');
    const apasa = `class="evp-zona" data-k="${k}" onclick="evpArataZona('${k}')"`;
    if (c) umple += `<g ${apasa}>${g.fill(c === 'r' ? EVP_R : EVP_Y)}</g>`;
    if (ring && g.ring) inele += `<g ${apasa}><ellipse cx="${g.ring[0]}" cy="${g.ring[1]}" rx="${g.ring[2]}" ry="${g.ring[3]}" fill="transparent" stroke="${EVP_R}" stroke-width="3.5"/></g>`;
    const lat = EVP_ZONA_LATERALA.has(z);
    const stanga = lat ? g.tint[0] < 100 : !fata;       // mijloc: fata -> dreapta imaginii, spate -> stanga
    if (text) etichete.push({ col: stanga ? 'L' : 'R', tx: g.tint[0], ty: g.tint[1], text, sub, c: c || 'r', k });
  };
  zone.forEach(zn => {
    const nume = EVP_ZONA_NUME[zn.z] + (zn.p ? ' ' + zn.p : '');
    const sub = zn.cats.filter(x => x !== EVP_ZONA_NUME[zn.z].toLowerCase()).join(', ');
    adauga(zn.z, zn.p, zn.c, zn.ring, nume, sub);
  });
  extra.forEach(x => {
    // zona are deja eticheta din test: doar inelul, fara a doua eticheta
    if (zone.has(x.z + (x.p || ''))) adauga(x.z, x.p, null, true, null, null); else adauga(x.z, x.p, null, true, x.titlu, '');
  });

  // etichete pe doua coloane, fara sa se calce una pe alta
  let txt = '';
  ['L', 'R'].forEach(col => {
    const lista = etichete.filter(e => e.col === col).sort((a, b) => a.ty - b.ty);
    let jos = -1e9;
    lista.forEach(e => {
      const linii = evpImparte(e.text, 15);
      const inalt = linii.length * 20 + (e.sub ? 18 : 0) + 8;
      const y = Math.max(e.ty - 10, jos + 4);
      jos = y + inalt;
      const left = col === 'L', ax = left ? 'end' : 'start', lx = FX + (left ? 6 : 194);
      const cul = e.c === 'g' ? EVP_Y : EVP_R;
      const yl = y + 11;
      txt += `<g class="evp-zona" data-k="${e.k}" onclick="evpArataZona('${e.k}')">`
        + `<line x1="${FX + (left ? 10 : 190)}" y1="${yl}" x2="${FX + e.tx}" y2="${e.ty}" stroke="${cul}" stroke-width="2"/>`
        + `<circle cx="${FX + e.tx}" cy="${e.ty}" r="3.5" fill="${cul}"/>`
        + `<rect x="${left ? lx - 135 : lx}" y="${y}" width="135" height="${inalt}" fill="transparent"/>`
        + linii.map((l, i) => `<text class="evp-lb" x="${lx}" y="${y + 16 + i * 20}" text-anchor="${ax}">${evpEsc(l)}</text>`).join('')
        + (e.sub ? `<text class="evp-lbs" x="${lx}" y="${y + 16 + linii.length * 20}" text-anchor="${ax}">${evpEsc(e.sub)}</text>` : '')
        + '</g>';
    });
  });
  return `<svg viewBox="0 0 500 430" role="img" aria-label="${fata ? 'din față' : 'din spate'}"><g transform="translate(${FX},0)">${evpCorp(fata)}${umple}${inele}</g>${txt}</svg>`;
}

// ---------- ecranele "Plan de lucru" ----------
// Doua intrari: de pe fisa pacientului (sursa 'fisa') si din butonul "Plan" (sursa 'plan': lista cu pacientii
// de azi, apoi planul unuia, gandit pentru telefon). Doar adminul poate edita planul.

let evpCurent = null;   // { id, pacientId, pacient, data, date, sursa, ultima, idx, arataAscunse }
const evpPoateEdita = () => typeof rolCurent === 'function' && rolCurent() === 'admin';

async function arataPlanLucru(id) {
  const e = await apel(`/api/evaluari/${id}`);
  if (!e || !e.id) return;
  const fisa = await apel(`/api/pacienti/${e.pacient_id}`);
  evpCurent = { id: e.id, pacientId: e.pacient_id, pacient: fisa.pacient, data: evDataIso(e.data), date: evNormalizeaza(e.date), sursa: 'fisa', ultima: null, idx: -1, arataAscunse: false };
  pacientCurent = e.pacient_id;
  evpRandeaza();
}

function evpSalveaza() {
  const p = evpCurent;
  return apel(`/api/evaluari/${p.id}`, { method: 'PATCH', body: JSON.stringify({ date: p.date }) });
}

function evpEditeaza(key, valori) {
  const date = evpCurent.date;
  date.plan = date.plan || {};
  date.plan.edit = date.plan.edit || {};
  const ed = Object.assign({}, date.plan.edit[key], valori);
  Object.keys(ed).forEach(k => { if (ed[k] === undefined || ed[k] === null || ed[k] === false || ed[k] === '') delete ed[k]; });
  if (Object.keys(ed).length) date.plan.edit[key] = ed; else delete date.plan.edit[key];
  evpSalveaza();
  evpRandeaza();
}

function evpTextImplicit(it) {
  const t = it.tags.length ? it.tags.join(', ') : '';
  return [t ? t.charAt(0).toUpperCase() + t.slice(1) + '.' : '', it.nota].filter(Boolean).join(' ');
}

function evpCard(it, ascuns, faraActiuni) {
  const ed = it.ed || {};
  const cap = evEl('div', { class: 'evp-it-cap' },
    evEl('b', { class: 'evp-it-titlu' }, it.titlu),
    it.cat ? evEl('span', { class: 'evp-cat' }, it.cat) : null);
  const card = evEl('div', { class: 'evp-it ' + (it.tip === 'extra' ? 'x' : it.c) }, cap);
  if (it.tip === 'test' && it.sub) card.append(evEl('div', { class: 'evp-sub' }, it.sub));

  const corp = evEl('div', { class: 'evp-corp' });
  if (ed.text != null && ed.text !== '') {
    corp.append(evEl('div', { class: 'evp-nota' }, ed.text));
  } else {
    if (it.durere) corp.append(evEl('span', { class: 'evp-tag dur' }, 'durere'));
    it.tags.forEach(t => corp.append(evEl('span', { class: 'evp-tag' }, t)));
    if (it.nota) corp.append(evEl('div', { class: 'evp-nota' }, it.nota));
  }
  card.append(corp);

  if (evpPoateEdita() && !faraActiuni) {
    const actiuni = evEl('div', { class: 'evp-act' });
    if (ascuns) actiuni.append(evEl('span', { class: 'ev-link', onclick: () => evpEditeaza(it.key, { ascuns: false }) }, 'Pune la loc'));
    else actiuni.append(evEl('span', { class: 'ev-link', onclick: () => evpEditor(it, corp, actiuni) }, 'Editează'));
    card.append(actiuni);
  }
  return card;
}

function evpEditor(it, corp, actiuni) {
  const ed = it.ed || {};
  const ta = evEl('textarea', { class: 'ev-input' });
  ta.value = ed.text != null && ed.text !== '' ? ed.text : evpTextImplicit(it);
  let culoare = it.c;
  const bC = evEl('div', { class: 'evp-cul' });
  if (it.tip === 'test') {
    [['r', 'Prioritar'], ['g', 'De lucrat']].forEach(([c, n]) => {
      const b = evEl('button', { class: 'evp-cb ' + c + (culoare === c ? ' on' : '') }, n);
      b.onclick = () => { culoare = c; bC.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); };
      bC.append(b);
    });
  }
  corp.innerHTML = ''; corp.append(ta);
  actiuni.innerHTML = '';
  actiuni.append(bC,
    evEl('button', { class: 'btn', onclick: () => {
      const nou = ta.value.trim();
      evpEditeaza(it.key, { text: nou === evpTextImplicit(it) ? undefined : nou, c: culoare !== (it.tip === 'test' ? evpCuloareAuto(it) : it.c) ? culoare : undefined });
    } }, 'Salvează'),
    evEl('button', { class: 'btn secundar', onclick: () => evpRandeaza() }, 'Renunță'),
    evEl('span', { class: 'ev-link', onclick: () => aratatPopupConfirmare(
      { titlu: 'Scoți punctul din plan?', mesaj: 'Îl poți pune la loc oricând.', textConfirma: 'Scoate', periculos: true },
      () => evpEditeaza(it.key, { ascuns: true })) }, 'Șterge'),
    (ed.text || ed.c) ? evEl('span', { class: 'ev-link', onclick: () => evpEditeaza(it.key, { text: null, c: null }) }, 'Revino la textul automat') : null);
  ta.focus();
}

// culoarea de baza a unui test (fara editari), ca sa stim daca s-a schimbat
function evpCuloareAuto(it) {
  const t = EV_TESTE.find(x => x.id === it.test);
  return evCuloareTest(t, evpCurent.date.teste) === 'r' ? 'r' : 'g';
}

function evpZiLuna(iso) {
  return new Date(String(iso).slice(0, 10) + 'T00:00:00').toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' });
}

// Zonele de lucrat, ca etichete scurte: cele din inel primele, apoi prioritare, apoi de lucrat
function evpChipsHtml(items, max) {
  if (!items.length) return '';
  const ord = it => it.tip === 'extra' ? 0 : it.c === 'r' ? 1 : 2;
  const lista = items.slice().sort((a, b) => ord(a) - ord(b));
  const n = max || 99;
  return '<div class="evp-chips">' + lista.slice(0, n).map(i => `<span class="${i.tip === 'extra' ? 'x' : i.c}">${evpEsc(i.titlu)}</span>`).join('')
    + (lista.length > n ? `<span class="mai">+${lista.length - n}</span>` : '') + '</div>';
}

function evpUltimaCard(u) {
  const c = evEl('div', { class: 'evp-ultima' },
    evEl('div', { class: 'evp-ultima-t' }, u ? 'De la ultima ședință · ' + evpZiLuna(u.data) : 'De la ultima ședință'));
  if (!u) c.append(evEl('div', { class: 'evp-ultima-g' }, 'Nicio ședință anterioară.'));
  else if (!u.plan_viitor && !u.exercitii) c.append(evEl('div', { class: 'evp-ultima-g' }, 'Nimic notat la ultima ședință.'));
  else {
    if (u.plan_viitor) c.append(evEl('div', { class: 'evp-ultima-x' }, u.plan_viitor));
    if (u.exercitii) c.append(evEl('div', { class: 'evp-ultima-ex' }, evEl('b', {}, 'Am lucrat: '), u.exercitii));
  }
  return c;
}

let evpZoneMap = {};   // cheia zonei -> punctele din plan care o ating
let evpZonaSel = null;

// Apasare pe o zona (sau pe eticheta ei): cardul de sub siluete arata textul punctelor din zona
function evpArataZona(k) {
  const card = document.getElementById('evp-zona-card');
  if (!card) return;
  if (evpZonaSel === k) k = null;   // a doua apasare inchide
  evpZonaSel = k;
  document.querySelectorAll('.evp-zona').forEach(g => g.classList.toggle('sel', g.dataset.k === k));
  card.innerHTML = '';
  if (!k || !evpZoneMap[k]) {
    evpZonaSel = null;
    card.className = 'evp-zona-card gol';
    card.textContent = 'Apasă pe o zonă ca să vezi detaliile.';
    return;
  }
  card.className = 'evp-zona-card deschis';
  card.append(evEl('button', { class: 'evp-zona-x', onclick: () => evpArataZona(k), 'aria-label': 'Închide' }, '×'),
    ...evpZoneMap[k].map(it => evpCard(it, false, true)));
}

function evpRandeaza() {
  const p = evpCurent, pac = p.pacient, dinPlan = p.sursa === 'plan';
  const panel = document.getElementById(dinPlan ? 'panel-plan' : 'panel-fisa');
  panel.innerHTML = '';
  const { vizibile, ascunse } = p.date ? evpIteme(p.date) : { vizibile: [], ascunse: [] };
  const extra = vizibile.filter(i => i.tip === 'extra');
  const rosii = vizibile.filter(i => i.tip === 'test' && i.c === 'r');
  const galbene = vizibile.filter(i => i.tip === 'test' && i.c === 'g');
  const poate = evpPoateEdita();

  // punctele fiecarei zone de pe siluete, pentru cardul care se deschide la apasare
  evpZoneMap = {};
  evpZonaSel = null;
  vizibile.forEach(it => it.zone.forEach(zn => {
    const k = zn.z + (zn.p || '');
    const l = evpZoneMap[k] = evpZoneMap[k] || [];
    if (!l.includes(it)) l.push(it);
  }));

  const grup = (clasa, titlu, lista) => lista.length ? evEl('div', { class: 'evp-grup' },
    evEl('div', { class: 'evp-gt ' + clasa }, evEl('i'), titlu), lista.map(i => evpCard(i))) : null;

  const completate = p.date ? EV_TESTE.filter(t => evCuloareTest(t, p.date.teste)).length : 0;
  const gol = !vizibile.length;
  const mesajGol = !p.date ? 'Nicio evaluare încă.' : completate ? 'Nimic de lucrat: niciun test galben sau roșu.' : 'Evaluarea nu e completată încă.';

  const siluete = evEl('div', { class: 'evp-siluete' });
  siluete.innerHTML = `<div class="evp-fig"><div class="evp-fc">din față</div>${evpSvg(vizibile, true)}</div>`
    + `<div class="evp-fig"><div class="evp-fc">din spate</div>${evpSvg(vizibile, false)}</div>`;
  const legenda = evEl('div', { class: 'evp-leg' },
    evEl('span', {}, evEl('i', { style: 'background:' + EVP_R }), 'Prioritar'),
    evEl('span', {}, evEl('i', { style: 'background:' + EVP_Y }), 'De lucrat'),
    evEl('span', {}, evEl('i', { class: 'inel' }), 'Durere / atenție'));

  let sus, antet;
  if (dinPlan) {
    const exista = j => !!evpAzi[j];
    sus = evEl('div', { class: 'evp-sus' },
      evEl('button', { class: 'evp-b', onclick: () => incarcaPlanAzi() }, '← Plan'),
      p.idx >= 0 ? evEl('div', { class: 'evp-sag' },
        evEl('button', { class: 'evp-b', disabled: !exista(p.idx - 1), onclick: () => evpUrmatorul(-1) }, '‹'),
        evEl('span', {}, `${p.idx + 1} din ${evpAzi.length}`),
        evEl('button', { class: 'evp-b', disabled: !exista(p.idx + 1), onclick: () => evpUrmatorul(1) }, '›')) : null);
    antet = [
      evEl('div', { class: 'evp-nm' }, `${pac.nume} ${pac.prenume}`),
      evEl('div', { class: 'evp-dg' }, 'Diagnostic: ' + (pac.diagnostic || '-') + (p.data ? ' · evaluare ' + evpZiLuna(p.data) : '')),
      evpUltimaCard(p.ultima),
    ];
  } else {
    sus = evEl('div', { class: 'ev-sus' },
      evEl('button', { class: 'btn secundar', onclick: () => deschideFisa(p.pacientId) }, `← ${pac.nume} ${pac.prenume}`),
      evEl('span', { class: 'ev-stare' }, evDataRo(p.data)));
    antet = [];
  }

  const chipsDiv = dinPlan && !gol ? evEl('div', { class: 'evp-chips-rand' }) : null;
  if (chipsDiv) chipsDiv.innerHTML = evpChipsHtml(vizibile);

  const corpPlan = gol
    ? [evEl('div', { class: 'ev-gol' }, mesajGol)]
    : [evEl('div', { class: 'evp-wrap-sil' }, siluete, legenda,
        evEl('div', { id: 'evp-zona-card', class: 'evp-zona-card gol' }, 'Apasă pe o zonă ca să vezi detaliile.'))];

  panel.append(evEl('div', { id: 'plan-lucru-ecran' }, sus, antet,
    chipsDiv,
    dinPlan
      ? evEl('div', { class: 'evp-fara-card' }, corpPlan)
      : evEl('div', { class: 'card' },
          evEl('div', { class: 'evp-cap' },
            evEl('div', { style: 'font-size:16px;font-weight:600' }, 'Plan de lucru'),
            poate ? evEl('button', { class: 'btn secundar', onclick: () => deschideEvaluare(p.id) }, 'Evaluare') : null),
          corpPlan),
    grup('x', 'Atenție la', extra),
    grup('r', 'Prioritar', rosii),
    grup('g', 'De lucrat', galbene),
    poate && ascunse.length ? evEl('div', { class: 'evp-ascunse' },
      evEl('span', { class: 'ev-link', onclick: () => { p.arataAscunse = !p.arataAscunse; evpRandeaza(); } },
        (p.arataAscunse ? 'Ascunde' : 'Arată') + ` ${ascunse.length} puncte scoase din plan`),
      p.arataAscunse ? ascunse.map(i => evpCard(i, true)) : null) : null,
    poate ? evEl('div', { class: 'evp-info' }, 'Planul se face singur din evaluare. Ce modifici aici rămâne, chiar dacă evaluarea se schimbă.') : null));
  window.scrollTo(0, 0);
}

// ---------- butonul "Plan": pacientii de azi si cautare ----------

let evpAzi = [];            // pacientii programati azi, cu planul lor
let evpSaltPeste = false;   // cand deschidem direct planul unui pacient, aratapanel('plan') nu mai incarca lista
let evpCautareTimer = null, evpCautareToken = 0;

function evpLaDeschidere() {
  if (evpSaltPeste) { evpSaltPeste = false; return; }
  incarcaPlanAzi();
}

function evpPregateste(r) {
  r.itemi = r.evaluare ? evpIteme(evNormalizeaza(r.evaluare.date)).vizibile : [];
  return r;
}

async function incarcaPlanAzi() {
  const panou = document.getElementById('panel-plan');
  if (!panou) return;
  if (!document.getElementById('evp-azi')) {
    panou.innerHTML = `<div class="evp-lista">
      <h2 class="evp-h">Plan de lucru</h2>
      <input id="evp-cauta" class="evp-cauta" type="search" placeholder="Cauta pacient" autocomplete="off" oninput="evpCautaDebounced(this.value)">
      <div id="evp-rez"></div>
      <div id="evp-azi"><div class="evp-gol">Se încarcă...</div></div>
    </div>`;
  }
  const rows = await apel('/api/evaluari/plan/azi?data=' + dataLocala(new Date()));
  const el = document.getElementById('evp-azi');
  if (!el) return;
  if (!Array.isArray(rows)) { el.innerHTML = '<div class="evp-gol">Nu am putut încărca programările.</div>'; return; }
  evpAzi = rows.map(evpPregateste);
  evpDeseneazaAzi();
}

function evpDeseneazaAzi() {
  const el = document.getElementById('evp-azi');
  if (!el) return;
  const cautare = (document.getElementById('evp-cauta')?.value || '').trim();
  el.style.display = cautare ? 'none' : 'block';
  if (!evpAzi.length) { el.innerHTML = '<div class="evp-gol">Nicio programare azi.</div>'; return; }
  el.innerHTML = '<div class="evp-sect">Azi</div>' + evpAzi.map((r, i) => `
    <div class="evp-pac" onclick="evpDeschideAzi(${i})">
      <div class="evp-n"><span>${evpEsc(r.pacient.nume + ' ' + r.pacient.prenume)}</span><small>${r.ora}${r.status === 'prezent' ? ' · prezent' : ''}</small></div>
      <div class="evp-d">${evpEsc(r.pacient.diagnostic || 'fără diagnostic')}</div>
      ${r.evaluare ? evpChipsHtml(r.itemi, 5) : '<div class="evp-chips"><span class="x0">Nicio evaluare încă</span></div>'}
      ${r.ultima && r.ultima.plan_viitor ? `<div class="evp-viitor"><div class="evp-viitor-t">De lucrat data viitoare</div>${evpEsc(r.ultima.plan_viitor)}</div>` : ''}
    </div>`).join('');
}

function evpCautaDebounced(q) {
  clearTimeout(evpCautareTimer);
  evpCautareTimer = setTimeout(() => evpCauta(q), 150);
}

async function evpCauta(q) {
  const rez = document.getElementById('evp-rez');
  if (!rez) return;
  const text = (q || '').trim();
  const id = ++evpCautareToken;
  if (!text) { rez.innerHTML = ''; evpDeseneazaAzi(); return; }
  const rows = await apel('/api/pacienti?q=' + encodeURIComponent(text));
  if (id !== evpCautareToken || !document.getElementById('evp-rez')) return;
  const azi = document.getElementById('evp-azi');
  if (azi) azi.style.display = 'none';
  rez.innerHTML = Array.isArray(rows) && rows.length
    ? rows.slice(0, 10).map(p => `<div class="evp-pac" onclick="evpDeschideCautat('${p.id}')">
        <div class="evp-n"><span>${evpEsc(p.nume + ' ' + p.prenume)}</span></div>
        <div class="evp-d">${evpEsc(p.diagnostic || 'fără diagnostic')}</div></div>`).join('')
    : '<div class="evp-gol">Niciun pacient găsit.</div>';
}

function evpArataPacient(r, idx) {
  evpCurent = {
    id: r.evaluare ? r.evaluare.id : null, pacientId: r.pacient.id, pacient: r.pacient,
    data: r.evaluare ? r.evaluare.data : null, date: r.evaluare ? evNormalizeaza(r.evaluare.date) : null,
    sursa: 'plan', ultima: r.ultima, idx, arataAscunse: false,
  };
  pacientCurent = r.pacient.id;
  evpRandeaza();
}

function evpDeschideAzi(i) { evpArataPacient(evpAzi[i], i); }

async function evpDeschideCautat(id) {
  const r = await apel('/api/evaluari/plan/pacient/' + id);
  if (!r || !r.pacient) return;
  evpArataPacient(evpPregateste(r), -1);
}

function evpUrmatorul(d) {
  const j = evpCurent.idx + d;
  if (evpAzi[j]) evpArataPacient(evpAzi[j], j);
}

// Reimprospatare cand se schimba ceva (SSE): doar lista, nu pacientul deschis
function evpReimprospateaza() {
  if (document.getElementById('evp-azi') && !(document.getElementById('evp-cauta')?.value || '').trim()) incarcaPlanAzi();
}

// ---------- referinta in formularul de prezenta ----------

let evpRef = null;

async function evpIncarcaReferinta(programareId) {
  if (!document.getElementById('ap-plan-ref')) return;
  const r = await apel('/api/evaluari/plan/programare/' + programareId);
  const el = document.getElementById('ap-plan-ref');
  if (!el || !r || !r.pacient) return;
  evpRef = evpPregateste(r);
  let continut;
  if (!r.evaluare) continut = '<div class="evp-ref-g">Nicio evaluare încă.</div>';
  else if (!evpRef.itemi.length) continut = '<div class="evp-ref-g">Niciun test galben sau roșu.</div>';
  else continut = evpChipsHtml(evpRef.itemi, 6) + '<span class="ev-link" onclick="evpDeschideReferinta()">Vezi planul complet</span>';
  el.innerHTML = `<div class="evp-ref"><div class="evp-ref-t">Plan de lucru</div>${continut}</div>`;
}

function evpDeschideReferinta() {
  inchideModalProgramare();
  evpSaltPeste = true;
  aratapanel('plan');
  evpArataPacient(evpRef, -1);
}
