// Evaluarea functionala (cele 12 teste RESET) pe fisa pacientului: notare cu semafor, cifre unde
// conteaza, compensari bifate; raportul pentru client si comparatia "atunci si acum" se fac singure.
// Testele, criteriile si regulile stau aici, ca sa le putem regla din mers fara migrari.

const EV_V = 'v', EV_G = 'g', EV_R = 'r';
const EV_SCOR = { v: 3, g: 2, r: 1 };

const EV_TESTE = [
  { id: 1, nume: 'Postura', poza: true,
    randuri: [{ k: 'a' }],
    cum: 'Stă în picioare relaxat, picioarele la lățimea șoldurilor, privirea înainte. Nu-i spui să stea drept. O poză din față și una din lateral, de la vreo 3 m, cu telefonul la înălțimea bazinului.',
    crit: [['v', 'nimic vizibil'], ['g', '1-2 abateri ușoare'], ['r', 'abateri clare sau mai multe']],
    comp: ['capul înainte', 'umerii în față', 'un umăr mai sus', 'bazinul înclinat', 'genunchi în hiperextensie', 'piciorul rotit în afară'],
    dom: ['postura'], prob: 'Postura în repaus' },
  { id: 2, nume: 'Genuflexiunea completă cu brațele sus',
    randuri: [{ k: 'a' }],
    cum: 'Picioarele la lățimea umerilor, vârfurile înainte, bățul ținut sus cu brațele întinse. Coboară cât de jos poate, cu călcâiele pe sol, și revine. 3 repetări, privești din față și din lateral.',
    crit: [['v', 'coapsele sub orizontală, călcâiele jos, brațele în linie cu trunchiul'], ['g', 'ajunge jos cu compensări ușoare'], ['r', 'nu coboară la orizontală sau compensări mari']],
    comp: ['călcâiele se ridică', 'genunchii cad înăuntru', 'trunchiul se apleacă mult', 'brațele cad în față', 'spatele se rotunjește jos', 'se mută pe o parte'],
    dom: ['coordonare', 'postura'], prob: 'Genuflexiunea completă: corpul nu lucrează încă împreună' },
  { id: 3, nume: 'Glezna la perete',
    randuri: [{ k: 'a', sides: true, num: 'cm', auto: n => n >= 10 ? EV_V : n >= 6 ? EV_G : EV_R, asim: 2 }],
    cum: 'Cu fața la perete, piciorul testat în față. Genunchiul împinge spre perete pe direcția degetului doi, fără să se ridice călcâiul. Mută piciorul înapoi până când genunchiul abia mai atinge. Măsori de la vârful degetului mare la perete. 3 încercări, notezi cea mai bună.',
    crit: [['v', '10 cm sau mai mult'], ['g', '6-9 cm'], ['r', 'sub 6 cm'], ['', 'Diferență S/D de 2 cm sau mai mult = asimetrie. La oameni foarte înalți sau scunzi, ajustează culoarea.']],
    comp: ['călcâiul se ridică', 'genunchiul cade înăuntru', 'piciorul se rotește în afară', 'jenă în fața gleznei'],
    dom: ['mobilitate'], prob: 'Glezna {s} se îndoaie puțin', s: ['stângă', 'dreaptă'] },
  { id: 4, nume: 'Ridicarea de pe ladă, pe un picior',
    randuri: [{ k: 'a', sides: true }],
    cum: 'Ladă de 45-50 cm. Un picior pe ladă, celălalt jos, brațele încrucișate pe piept. Urcă doar din piciorul de pe ladă, fără să se împingă din celălalt, și coboară controlat. 2-3 ridicări pe fiecare parte.',
    crit: [['v', '2-3 ridicări controlate'], ['g', 'reușește, dar cu compensări'], ['r', 'nu reușește sau se împinge cu celălalt picior']],
    comp: ['genunchiul cade înăuntru', 'bazinul coboară pe partea cealaltă', 'trunchiul se înclină', 'se împinge cu celălalt picior', 'pierde echilibrul'],
    dom: ['forta'], prob: 'Piciorul {s} are forță și control mai slabe', s: ['stâng', 'drept'] },
  { id: 5, nume: 'Echilibrul pe un picior, ochii închiși',
    randuri: [{ k: 'a', sides: true, num: 'sec', auto: n => n >= 10 ? EV_V : n >= 5 ? EV_G : EV_R, asim: 5 }],
    cum: 'Mâinile pe șolduri, ridică un picior, apoi închide ochii. Cronometrezi până deschide ochii, pune piciorul jos, ia mâinile de pe șolduri sau mută piciorul de sprijin. Maximum 30 de secunde. 2 încercări pe parte, notezi cea mai bună.',
    crit: [['v', '10 secunde sau mai mult'], ['g', '5-9 secunde'], ['r', 'sub 5 secunde']],
    comp: ['trunchiul se înclină', 'piciorul ridicat atinge solul', 'sare pe loc'],
    dom: ['stabilitate'], prob: 'Echilibrul pe piciorul {s}', s: ['stâng', 'drept'] },
  { id: 6, nume: 'Brațele pe perete și mâinile la spate', palma: true,
    randuri: [
      { k: 'perete', et: 'Perete' },
      { k: 'pumni', et: 'Pumni', sides: true, num: 'cm', auto: (n, st) => !st.palma ? null : n <= st.palma ? EV_V : n <= st.palma * 1.5 ? EV_G : EV_R, asimPalma: 0.5 }],
    cum: 'Perete: spatele și capul lipite de perete, picioarele la o palmă de perete, genunchii ușor îndoiți. Ridică brațele întinse spre perete, fără să se dezlipească zona lombară. Pumni: pumnii strânși cu degetul mare înăuntru; într-o singură mișcare, o mână coboară pe spate peste umăr, cealaltă urcă pe sub. Măsori distanța dintre pumni. S = mâna stângă sus. Palma: de la pliul încheieturii la vârful degetului mijlociu.',
    crit: [['', 'Perete:'], ['v', 'brațele întinse ating peretele, spatele nu se arcuiește'], ['g', 'ajunge cu arcuire ușoară sau coatele îndoite'], ['r', 'nu ajunge'],
           ['', 'Pumni, comparat cu lungimea palmei:'], ['v', 'până la o palmă'], ['g', 'până la o palmă și jumătate'], ['r', 'peste']],
    comp: ['spatele se arcuiește', 'coatele se îndoaie', 'umerii urcă spre urechi', 'omoplatul se dezlipește'],
    dom: ['mobilitate', 'postura'], prob: 'Umerii nu urcă și nu se rotesc liber' },
  { id: 7, nume: 'Rotațiile de șold din șezut',
    randuri: [{ k: 'int', et: 'Rotație internă', sides: true }, { k: 'ext', et: 'Rotație externă', sides: true }],
    cum: 'Pe marginea mesei, genunchii la 90°, coapsele paralele, mâinile încrucișate pe piept. Rotație internă: laba piciorului merge în afară. Rotație externă: laba merge înăuntru. Coapsa rămâne pe loc, bazinul nu se ridică.',
    crit: [['v', 'gamba se rotește cam cât jumătate de unghi drept'], ['g', 'cam o treime'], ['r', 'mai puțin']],
    comp: ['bazinul se ridică de pe masă', 'trunchiul se înclină'],
    dom: ['mobilitate'], prob: 'Șoldul {s} se rotește puțin', s: ['stâng', 'drept'] },
  { id: 8, nume: 'Rotația toracală din șezut',
    randuri: [{ k: 'a', sides: true }],
    cum: 'Pe scaun, genunchii lipiți, bățul pe umeri în spatele gâtului. Se rotește cât poate, fără ca bazinul și genunchii să se miște. Compari bățul cu banda de pe podea.',
    crit: [['v', 'bățul ajunge la banda de pe podea'], ['g', 'aproape'], ['r', 'departe']],
    comp: ['bazinul se rotește', 'genunchii se mișcă', 'trunchiul se înclină lateral'],
    dom: ['mobilitate'], prob: 'Partea de sus a spatelui se rotește puțin spre {s}', s: ['stânga', 'dreapta'] },
  { id: 9, nume: 'Ridicarea piciorului întins',
    randuri: [{ k: 'a', sides: true }],
    cum: 'Întins pe spate, picioarele întinse, vârfurile trase spre el. Ridică un picior cât poate, cu genunchiul întins; celălalt rămâne pe sol. Te uiți unde ajunge glezna față de coapsa celuilalt picior.',
    crit: [['v', 'glezna trece de mijlocul coapsei celeilalte'], ['g', 'între mijlocul coapsei și genunchi'], ['r', 'sub genunchi']],
    comp: ['genunchiul se îndoaie', 'celălalt picior se ridică', 'bazinul se rotește'],
    dom: ['mobilitate'], prob: 'Spatele coapsei {s} e scurtat', s: ['stângi', 'drepte'] },
  { id: 10, nume: 'Coborârea picioarelor și respirația',
    randuri: [{ k: 'a' }],
    cum: 'Respirația: întins pe spate, o mână pe piept și una pe abdomen, câteva respirații normale; te uiți ce se mișcă. Coborârea: mâna ta sub zona lombară, picioarele întinse la vertical. Lipește spatele de mâna ta și coboară încet ambele picioare, respirând normal. Te oprești când spatele se dezlipește.',
    crit: [['v', 'picioarele coboară aproape de sol cu spatele lipit'], ['g', 'spatele se dezlipește la jumătate'], ['r', 'spatele se dezlipește aproape de vertical']],
    comp: ['respiră doar din piept', 'își ține respirația', 'abdomenul se bombează', 'umerii urcă la inspir'],
    dom: ['stabilitate'], prob: 'Abdomenul nu ține încă spatele stabil' },
  { id: 11, nume: 'Flotare',
    randuri: [{ k: 'a' }],
    cum: 'Culcat pe burtă, mâinile la nivelul frunții (bărbați) sau bărbiei (femei), genunchii întinși, vârfurile pe sol. Împinge; pieptul și bazinul urcă deodată. Dacă nu reușește, mâinile coboară o treaptă și mai încearcă o dată.',
    crit: [['v', 'mâinile la frunte (bărbați) / la bărbie (femei)'], ['g', 'reușește doar cu mâinile mai jos'], ['r', 'nu reușește dintr-o bucată']],
    comp: ['bazinul rămâne în urmă', 'spatele se lasă', 'coatele ies lateral', 'capul cade'],
    dom: ['stabilitate', 'forta'], prob: 'Trunchiul nu ține ca un bloc la efort' },
  { id: 12, nume: 'Patrupedie, braț și picior opus',
    randuri: [{ k: 'a', sides: true }],
    cum: 'Mâinile sub umeri, genunchii sub șolduri, spatele drept. Întinde brațul și piciorul opus în linie cu trunchiul, ține 2 secunde, revine. 5 repetări pe parte. S = brațul stâng cu piciorul drept.',
    crit: [['v', '5 repetări pe parte, stabil, spatele drept'], ['g', 'se clatină ușor sau spatele se rotește'], ['r', 'pierde echilibrul sau nu duce mișcarea la capăt']],
    comp: ['bazinul se rotește', 'spatele se arcuiește', 'se sprijină să nu cadă', 'nu întinde complet'],
    dom: ['stabilitate', 'coordonare'], prob: 'Controlul trunchiului în mișcare' },
];

const EV_DOMENII = [
  ['mobilitate', 'Mobilitate'], ['stabilitate', 'Stabilitate'], ['forta', 'Forță'],
  ['coordonare', 'Coordonare'], ['echilibru', 'Echilibru muscular'], ['postura', 'Postură'],
];

const EV_REC = {
  kineto: ['Kinetoterapie', 'Pentru că a apărut durere la unele teste, începem cu kinetoterapie: lucrăm întâi pe ce doare, apoi pe restul.'],
  stick: ['StickMobility Posture', 'Ce iese în evidență ține mai ales de mobilitate și postură. Clasa de postură cu StickMobility lucrează exact pe asta.'],
  move: ['MoveBetter', 'Te miști liber, iar următorul pas e forța și controlul. MoveBetter te duce acolo, în siguranță.'],
  nimic: ['Fără recomandare', 'Corpul tău se mișcă bine. Păstrează ce faci acum și revino la o reevaluare peste câteva luni.'],
};

const EV_ETICHETA = { v: 'bine', g: 'de lucrat', r: 'prioritar' };
const EV_SAPTAMANI_REEVALUARE = 8;

// ---------- starea unei evaluari ----------

// Completeaza structura lipsa (evaluare noua, sau un test adaugat ulterior in EV_TESTE)
function evNormalizeaza(date) {
  const teste = (date && date.teste) || {};
  EV_TESTE.forEach(t => {
    const st = teste[t.id] = teste[t.id] || {};
    st.r = st.r || {};
    t.randuri.forEach(rd => {
      const cel = st.r[rd.k] = st.r[rd.k] || {};
      (rd.sides ? ['S', 'D'] : ['U']).forEach(p => { cel[p] = cel[p] || {}; });
    });
    st.comp = Array.isArray(st.comp) ? st.comp : [];
    st.durere = !!st.durere;
    st.nota = st.nota || '';
  });
  return { teste };
}

function evCuloareTest(t, teste) {
  const st = teste[t.id];
  if (st.durere) return EV_R;
  const cs = [];
  t.randuri.forEach(rd => Object.values(st.r[rd.k]).forEach(c => c.c && cs.push(c.c)));
  if (!cs.length) return null;
  return cs.reduce((a, b) => EV_SCOR[b] < EV_SCOR[a] ? b : a);
}

function evAsimetrii(t, teste) {
  const st = teste[t.id]; let nr = 0;
  t.randuri.forEach(rd => {
    if (!rd.sides) return;
    const s = st.r[rd.k].S, d = st.r[rd.k].D;
    const cifre = s.n != null && d.n != null;
    let da = !!(s.c && d.c && s.c !== d.c);
    if (rd.asim && cifre && Math.abs(s.n - d.n) >= rd.asim) da = true;
    if (rd.asimPalma && st.palma && cifre && Math.abs(s.n - d.n) >= st.palma * rd.asimPalma) da = true;
    if (da) nr++;
  });
  return nr;
}

// Partea (sau partile) cu cea mai slaba culoare din test
function evPartiSlabe(t, teste) {
  const st = teste[t.id]; const cul = { S: 3, D: 3 };
  t.randuri.forEach(rd => {
    if (!rd.sides) return;
    ['S', 'D'].forEach(x => { const c = st.r[rd.k][x].c; if (c) cul[x] = Math.min(cul[x], EV_SCOR[c]); });
  });
  const min = Math.min(cul.S, cul.D);
  return min === 3 ? [] : ['S', 'D'].filter(x => cul[x] === min);
}

function evFraza(t, parti) {
  const f = t.prob;
  if (!f.includes('{s}')) return f;
  if (parti.length === 1) return f.replace('{s}', t.s[parti[0] === 'S' ? 0 : 1]);
  return f.replace(' {s}', '').replace(' spre', '') + ' (ambele părți)';
}

function evCalcul(teste) {
  const dom = {}; EV_DOMENII.forEach(([k]) => { dom[k] = []; });
  let nrAsim = 0, oriceDurere = false, completate = 0;
  const prio = [];
  EV_TESTE.forEach(t => {
    const st = teste[t.id];
    const c = evCuloareTest(t, teste);
    const as = evAsimetrii(t, teste);
    if (c) completate++;
    nrAsim += as;
    if (st.durere) oriceDurere = true;
    if (c) t.dom.forEach(d => dom[d].push({ c, durere: st.durere }));
    if (st.durere) prio.push({ rang: 0, text: t.nume + ': durere la test', det: st.comp });
    else if (c === EV_R) prio.push({ rang: 1, text: evFraza(t, evPartiSlabe(t, teste)), det: st.comp });
    else if (as) prio.push({ rang: 2, text: 'Diferență între stânga și dreapta: ' + t.nume.toLowerCase(), det: st.comp });
    else if (c === EV_G) prio.push({ rang: 3, text: evFraza(t, evPartiSlabe(t, teste)), det: st.comp });
  });
  const culDom = {};
  EV_DOMENII.forEach(([k]) => {
    if (k === 'echilibru') { culDom[k] = completate ? (nrAsim === 0 ? EV_V : nrAsim <= 2 ? EV_G : EV_R) : null; return; }
    const l = dom[k];
    if (!l.length) { culDom[k] = null; return; }
    if (l.some(x => x.durere)) { culDom[k] = EV_R; return; }
    const m = l.reduce((a, x) => a + EV_SCOR[x.c], 0) / l.length;
    culDom[k] = m >= 2.6 ? EV_V : m >= 1.8 ? EV_G : EV_R;
  });
  prio.sort((a, b) => a.rang - b.rang);
  let rec;
  if (oriceDurere) rec = 'kineto';
  else {
    const slab = k => culDom[k] === EV_R ? 2 : culDom[k] === EV_G ? 1 : 0;
    const mobPost = slab('mobilitate') + slab('postura');
    const fortaCtrl = slab('forta') + slab('stabilitate') + slab('coordonare');
    rec = mobPost + fortaCtrl === 0 ? 'nimic' : mobPost > fortaCtrl ? 'stick' : 'move';
  }
  return { culDom, prio: prio.slice(0, 3), rec, completate };
}

// ---------- utilitare ----------

function evEl(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e[k] = v;
    else e.setAttribute(k, v);
  }
  kids.flat().forEach(k => k != null && k !== false && e.append(k));
  return e;
}

function evDataRo(d) {
  if (!d) return '';
  const x = new Date(String(d).slice(0, 10) + 'T00:00:00');
  return x.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function evDataIso(d) { return String(d).slice(0, 10); }

function evPuncte(culDom) {
  return evEl('div', { class: 'ev-puncte' }, EV_DOMENII.map(([k, n]) =>
    evEl('span', { class: 'ev-punct ' + (culDom[k] || 'x') }, evEl('i'), n)));
}

// ---------- cardul de pe fisa pacientului ----------

async function incarcaEvaluariFisa(pacientId) {
  const box = document.getElementById('evaluari-fisa');
  if (!box) return;
  const lista = await apel(`/api/pacienti/${pacientId}/evaluari`);
  if (!Array.isArray(lista) || pacientCurent !== pacientId || !document.getElementById('evaluari-fisa')) return;

  box.innerHTML = '';
  box.append(evEl('div', { class: 'ev-cap' },
    evEl('h2', { style: 'margin:0' }, 'Evaluari functionale'),
    evEl('button', { class: 'btn', onclick: () => evaluareNoua(pacientId) }, '+ Evaluare noua')));

  if (!lista.length) {
    box.append(evEl('div', { class: 'ev-gol' }, 'Nicio evaluare inca.'));
    return;
  }
  const ultima = lista.length - 1;
  lista.forEach((e, i) => {
    const date = evNormalizeaza(e.date);
    const { culDom, completate } = evCalcul(date.teste);
    box.append(evEl('div', { class: 'ev-rand' },
      evEl('div', { style: 'min-width:0' },
        evEl('div', { class: 'ev-data' }, evDataRo(e.data),
          evEl('span', { class: 'ev-tip' }, ' · ' + (i === ultima ? 'Prima evaluare' : 'Reevaluare') + (e.kineto ? ' · ' + e.kineto : '')
            + (completate < EV_TESTE.length ? ` · ${completate} din ${EV_TESTE.length} teste` : ''))),
        evPuncte(culDom)),
      evEl('div', { class: 'ev-actiuni' },
        evEl('span', { class: 'ev-link', onclick: () => deschideEvaluare(e.id) }, 'Deschide'),
        evEl('span', { class: 'ev-link', onclick: () => arataRaportEvaluare(e.id) }, 'Raport'))));
  });
  if (lista.length > 1) {
    box.append(evEl('div', { style: 'margin-top:10px' },
      evEl('button', { class: 'btn secundar', onclick: () => comparaEvaluari(pacientId) }, 'Compara cu prima evaluare')));
  }
  const urm = new Date(evDataIso(lista[0].data) + 'T00:00:00');
  urm.setDate(urm.getDate() + EV_SAPTAMANI_REEVALUARE * 7);
  box.append(evEl('div', { class: 'ev-reev' }, `Urmatoarea reevaluare: in jur de ${urm.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })}.`));
}

async function evaluareNoua(pacientId) {
  const r = await apel(`/api/pacienti/${pacientId}/evaluari`, { method: 'POST', body: '{}' });
  if (r && r.id) deschideEvaluare(r.id);
}

// ---------- completarea evaluarii ----------

let evCurenta = null;       // { id, pacientId, pacient, data, date, poze }
let evSalvareTimer = null;
let evSalvareInCurs = Promise.resolve();

function evProgramareSalvare() {
  clearTimeout(evSalvareTimer);
  evSalvareTimer = setTimeout(evSalveaza, 700);
  evStareSalvare('Se salveaza...');
}

function evSalveaza(extra = {}) {
  clearTimeout(evSalvareTimer);
  if (!evCurenta) return Promise.resolve();
  const ev = evCurenta;
  const corp = { data: ev.data, date: ev.date, ...extra };
  evSalvareInCurs = evSalvareInCurs.then(() =>
    apel(`/api/evaluari/${ev.id}`, { method: 'PATCH', body: JSON.stringify(corp) })
      .then(r => evStareSalvare(r && r.id ? 'Salvat' : 'Nu s-a putut salva'))
      .catch(() => evStareSalvare('Nu s-a putut salva. Verifica semnalul.')));
  return evSalvareInCurs;
}

function evStareSalvare(text) {
  const el = document.getElementById('ev-stare');
  if (el) el.textContent = text;
}

async function deschideEvaluare(id) {
  const e = await apel(`/api/evaluari/${id}`);
  if (!e || !e.id) return;
  const fisa = await apel(`/api/pacienti/${e.pacient_id}`);
  evCurenta = { id: e.id, pacientId: e.pacient_id, pacient: fisa.pacient, data: evDataIso(e.data), date: evNormalizeaza(e.date), poze: e.poze || {} };
  pacientCurent = e.pacient_id;
  randeazaEvaluare();
}

// Apelat din deschideFisa: daca se pleaca din evaluare pe alta cale (cautare, alt pacient), salvam ce a ramas
function evParasesteEvaluarea() {
  if (!evCurenta) return;
  evSalveaza();
  evCurenta = null;
}

async function inchideEvaluare() {
  if (!evCurenta) return;
  const pacientId = evCurenta.pacientId;
  await evSalveaza();
  evCurenta = null;
  deschideFisa(pacientId);
}

async function stergeEvaluare() {
  if (!evCurenta || !confirm('Stergi evaluarea? Nu se mai poate recupera.')) return;
  const pacientId = evCurenta.pacientId;
  clearTimeout(evSalvareTimer);
  await apel(`/api/evaluari/${evCurenta.id}`, { method: 'DELETE' });
  evCurenta = null;
  deschideFisa(pacientId);
}

function randeazaEvaluare() {
  const ev = evCurenta;
  const p = ev.pacient;
  const panel = document.getElementById('panel-fisa');
  panel.innerHTML = '';
  const dataInp = evEl('input', { type: 'date', value: ev.data, class: 'ev-input' });
  dataInp.onchange = () => { if (dataInp.value) { ev.data = dataInp.value; evProgramareSalvare(); } };

  const ecran = evEl('div', { id: 'evaluare-ecran' },
    evEl('div', { class: 'ev-sus' },
      evEl('button', { class: 'btn secundar', onclick: inchideEvaluare }, `← ${p.nume} ${p.prenume}`),
      evEl('span', { id: 'ev-stare', class: 'ev-stare' })),
    evEl('div', { class: 'card ev-antet' },
      evEl('div', { style: 'font-size:16px;font-weight:600' }, 'Evaluare functionala'),
      evEl('div', { class: 'ev-antet-rand' }, dataInp,
        evEl('span', { class: 'ev-link ev-sterge', onclick: stergeEvaluare }, 'Sterge evaluarea'))),
    EV_TESTE.map(t => evCardTest(t)),
    evEl('div', { class: 'ev-bara' },
      evEl('span', { id: 'ev-progres', class: 'ev-progres' }),
      evEl('button', { class: 'btn', onclick: async () => { await evSalveaza(); arataRaportEvaluare(ev.id); } }, 'Vezi raportul')));
  panel.append(ecran);
  evActualizeazaProgres();
  window.scrollTo(0, 0);
}

function evActualizeazaProgres() {
  const el = document.getElementById('ev-progres');
  if (!el || !evCurenta) return;
  const gata = EV_TESTE.filter(t => evCuloareTest(t, evCurenta.date.teste)).length;
  el.textContent = `${gata} din ${EV_TESTE.length} teste`;
}

function evCardTest(t) {
  const st = evCurenta.date.teste[t.id];
  const card = evEl('div', { class: 'card ev-test' + (st.durere ? ' durere' : '') });
  const semafoare = []; // [cel, element] - le actualizam pe loc, fara sa redesenam cardul

  const actualizeaza = () => {
    semafoare.forEach(([cel, box]) => box.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.c === cel.c)));
    card.classList.toggle('durere', st.durere);
    evActualizeazaProgres();
    evProgramareSalvare();
  };

  const info = evEl('div', { class: 'ev-info-text' },
    evEl('div', { class: 'ev-info-t' }, 'Cum se face'), evEl('div', {}, t.cum),
    evEl('div', { class: 'ev-info-t' }, 'Criterii'),
    t.crit.map(([c, txt]) => evEl('div', {}, c ? evEl('b', { class: 'ev-c-' + c }, '● ') : null, txt)));

  const btnDurere = evEl('button', { class: 'ev-durere' + (st.durere ? ' on' : '') }, 'Durere');
  btnDurere.onclick = () => { st.durere = !st.durere; btnDurere.classList.toggle('on', st.durere); actualizeaza(); };

  card.append(evEl('div', { class: 'ev-test-cap' },
    evEl('span', { class: 'ev-nr' }, t.id), evEl('span', { class: 'ev-titlu' }, t.nume),
    btnDurere,
    evEl('button', { class: 'ev-i', title: 'Cum se face', onclick: () => info.classList.toggle('deschis') }, 'i')));
  card.append(info);

  const recalcAuto = () => t.randuri.forEach(rd => {
    if (!rd.num) return;
    Object.values(st.r[rd.k]).forEach(cel => { if (cel.n != null) { const a = rd.auto(cel.n, st); if (a) cel.c = a; } });
  });

  if (t.palma) {
    const inp = evEl('input', { class: 'ev-num', type: 'number', inputmode: 'decimal', step: '0.5', value: st.palma ?? '' });
    inp.oninput = () => { st.palma = parseFloat(inp.value) || null; recalcAuto(); actualizeaza(); };
    card.append(evEl('div', { class: 'ev-rand-test' }, evEl('span', { class: 'ev-et' }, 'Lungimea palmei'), inp, evEl('span', { class: 'ev-unit' }, 'cm')));
  }

  t.randuri.forEach(rd => {
    const celule = st.r[rd.k];
    const rand = evEl('div', { class: 'ev-rand-test' });
    if (rd.et) rand.append(evEl('span', { class: 'ev-et' }, rd.et));
    Object.keys(celule).forEach(p => {
      const cel = celule[p];
      const parte = evEl('div', { class: 'ev-parte' });
      if (p !== 'U') parte.append(evEl('span', { class: 'ev-lit' }, p));
      if (rd.num) {
        const inp = evEl('input', { class: 'ev-num', type: 'number', inputmode: 'decimal', step: '0.5', value: cel.n ?? '' });
        inp.oninput = () => {
          cel.n = inp.value === '' ? null : parseFloat(inp.value);
          if (cel.n != null) { const a = rd.auto(cel.n, st); if (a) cel.c = a; }
          actualizeaza();
        };
        parte.append(inp, evEl('span', { class: 'ev-unit' }, rd.num));
      }
      const sem = evEl('div', { class: 'ev-sem' }, [EV_V, EV_G, EV_R].map(c => {
        const b = evEl('button', { class: c + (cel.c === c ? ' on' : ''), 'data-c': c, title: { v: 'Verde', g: 'Galben', r: 'Rosu' }[c] }, evEl('span'));
        b.onclick = () => { cel.c = cel.c === c ? null : c; actualizeaza(); };
        return b;
      }));
      semafoare.push([cel, sem]);
      parte.append(sem);
      rand.append(parte);
    });
    card.append(rand);
  });

  if (t.poza) card.append(evPoze());

  card.append(evEl('div', { class: 'ev-chips' }, t.comp.map(c => {
    const b = evEl('button', { class: 'ev-chip' + (st.comp.includes(c) ? ' on' : '') }, c);
    b.onclick = () => {
      st.comp = st.comp.includes(c) ? st.comp.filter(x => x !== c) : [...st.comp, c];
      b.classList.toggle('on', st.comp.includes(c));
      evProgramareSalvare();
    };
    return b;
  })));

  const nota = evEl('div', { class: 'ev-nota' });
  const arataNota = () => {
    const ta = evEl('textarea', { placeholder: 'Notita', class: 'ev-input' });
    ta.value = st.nota;
    ta.oninput = () => { st.nota = ta.value; evProgramareSalvare(); };
    nota.innerHTML = ''; nota.append(ta);
    return ta;
  };
  if (st.nota) arataNota();
  else nota.append(evEl('span', { class: 'ev-link', onclick: () => arataNota().focus() }, '+ notita'));
  card.append(nota);
  return card;
}

function evPoze() {
  const box = evEl('div', { class: 'ev-poze' });
  [['fata', 'Fata'], ['lateral', 'Lateral']].forEach(([k, n]) => {
    const f = evEl('input', { type: 'file', accept: 'image/*', capture: 'environment', style: 'display:none' });
    f.onchange = async () => {
      const file = f.files[0];
      if (!file) return;
      evStareSalvare('Se salveaza poza...');
      evCurenta.poze[k] = await evMicsoreazaPoza(file);
      await evSalveaza({ poze: evCurenta.poze });
      box.replaceWith(evPoze());
    };
    box.append(f, evCurenta.poze[k]
      ? evEl('img', { src: evCurenta.poze[k], title: n + ' (apasa pentru alta poza)', onclick: () => f.click() })
      : evEl('button', { class: 'btn secundar', onclick: () => f.click() }, 'Poza ' + n.toLowerCase()));
  });
  return box;
}

// Pozele de postura se micsoreaza pe telefon (max 1000 px, JPEG), ca sa nu incarce baza de date
function evMicsoreazaPoza(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1000 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// ---------- raportul pentru client si comparatia (pagina alba, se poate salva ca PDF) ----------

function evDeschideFoaie(continut) {
  evInchideFoaie();
  const foaie = evEl('div', { id: 'ev-foaie' }, evEl('div', { class: 'ev-foaie-in' }, continut));
  document.body.append(foaie);
  document.body.classList.add('ev-foaie-deschisa');
  foaie.scrollTop = 0;
}

function evInchideFoaie() {
  document.getElementById('ev-foaie')?.remove();
  document.body.classList.remove('ev-foaie-deschisa');
}

function evActiuniFoaie() {
  return evEl('div', { class: 'ev-foaie-actiuni' },
    evEl('button', { class: 'btn', onclick: () => window.print() }, 'Salvează PDF / Printează'),
    evEl('button', { class: 'btn secundar', onclick: evInchideFoaie }, 'Închide'));
}

async function arataRaportEvaluare(id) {
  const e = await apel(`/api/evaluari/${id}`);
  if (!e || !e.id) return;
  const fisa = await apel(`/api/pacienti/${e.pacient_id}`);
  const p = fisa.pacient;
  const { culDom, prio, rec } = evCalcul(evNormalizeaza(e.date).teste);
  let aleasa = e.recomandare || rec;

  const recText = evEl('div', { class: 'ev-r-rec' });
  const butoane = evEl('div', { class: 'ev-r-rec-btns' });
  const randeazaRec = () => {
    recText.innerHTML = '';
    recText.append(evEl('b', {}, EV_REC[aleasa][0]), evEl('br'), EV_REC[aleasa][1]);
    butoane.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === aleasa));
  };
  Object.entries(EV_REC).forEach(([k, [n]]) => {
    const b = evEl('button', { 'data-k': k }, n);
    b.onclick = async () => {
      aleasa = k; randeazaRec();
      await apel(`/api/evaluari/${id}`, { method: 'PATCH', body: JSON.stringify({ recomandare: k === rec ? null : k }) });
    };
    butoane.append(b);
  });
  randeazaRec();

  evDeschideFoaie([
    evEl('div', { class: 'ev-r-logo' }, 'RESET'),
    evEl('h2', {}, 'Evaluarea ta funcțională'),
    evEl('div', { class: 'ev-r-sub' }, `${p.prenume} ${p.nume} · ${evDataRo(e.data)}`),
    evEl('h3', {}, 'Cum te miști acum'),
    evEl('div', { class: 'ev-r-domenii' }, EV_DOMENII.map(([k, n]) =>
      evEl('div', { class: 'ev-r-dom ' + (culDom[k] || 'x') }, evEl('div', { class: 'n' }, n),
        evEl('div', { class: 's' }, evEl('i'), culDom[k] ? EV_ETICHETA[culDom[k]] : 'netestat')))),
    evEl('h3', {}, 'Pe ce lucrăm întâi'),
    prio.length
      ? evEl('ol', { class: 'ev-r-prio' }, prio.map(x => evEl('li', {}, x.text, x.det.length ? evEl('div', { class: 'det' }, x.det.join(', ')) : null)))
      : evEl('div', { class: 'ev-r-sub' }, 'Nimic care să iasă în evidență.'),
    evEl('h3', {}, 'Recomandarea noastră'),
    recText,
    evEl('div', { class: 'ev-r-doar-kineto' },
      evEl('div', { class: 't' }, `Doar pentru kinetoterapeut, nu apare în PDF. Aplicația a propus ${EV_REC[rec][0]}. Poți schimba:`),
      butoane),
    evActiuniFoaie(),
  ]);
}

async function comparaEvaluari(pacientId) {
  const lista = await apel(`/api/pacienti/${pacientId}/evaluari`);
  if (!Array.isArray(lista) || lista.length < 2) return;
  const fisa = await apel(`/api/pacienti/${pacientId}`);
  const p = fisa.pacient;
  const acum = lista[0], atunci = lista[lista.length - 1];
  const tA = evNormalizeaza(atunci.date).teste, tB = evNormalizeaza(acum.date).teste;
  const cA = evCalcul(tA).culDom, cB = evCalcul(tB).culDom;

  const verdict = (a, b) => {
    if (a == null || b == null) return evEl('span', { class: 'ev-vegal' }, '-');
    const d = b - a;
    return d > 0 ? evEl('span', { class: 'ev-vsus' }, 'mai bine') : d < 0 ? evEl('span', { class: 'ev-vjos' }, 'mai slab') : evEl('span', { class: 'ev-vegal' }, 'la fel');
  };
  const scorTest = (t, teste) => {
    const st = teste[t.id]; let s = 0, n = 0;
    t.randuri.forEach(rd => Object.values(st.r[rd.k]).forEach(c => { if (c.c) { s += EV_SCOR[c.c]; n++; } }));
    if (st.durere) return 0;
    return n ? s / n : null;
  };
  const celule = (t, teste) => {
    const st = teste[t.id]; const out = [];
    t.randuri.forEach(rd => Object.entries(st.r[rd.k]).forEach(([p2, c]) => {
      out.push(evEl('span', { class: 'ev-cel' }, evEl('i', { class: c.c || 'x' }),
        c.n != null ? [String(c.n), evEl('small', {}, rd.num)] : null));
    }));
    if (st.durere) out.push(evEl('span', { class: 'ev-cel-durere' }, 'durere'));
    return out;
  };
  const dScor = c => c ? EV_SCOR[c] : null;

  evDeschideFoaie([
    evEl('div', { class: 'ev-r-logo' }, 'RESET'),
    evEl('h2', {}, 'Atunci și acum'),
    evEl('div', { class: 'ev-r-sub' }, `${p.prenume} ${p.nume} · ${evDataRo(atunci.data)} → ${evDataRo(acum.data)}`),
    evEl('h3', {}, 'Pe domenii'),
    evEl('div', { class: 'ev-r-domenii' }, EV_DOMENII.map(([k, n]) =>
      evEl('div', { class: 'ev-r-dom' }, evEl('div', { class: 'n' }, n),
        evEl('div', { class: 's' }, evEl('i', { class: cA[k] || 'x' }), '→', evEl('i', { class: cB[k] || 'x' }), verdict(dScor(cA[k]), dScor(cB[k])))))),
    evEl('h3', {}, 'Pe teste'),
    evEl('table', { class: 'ev-cmp' },
      evEl('tr', {}, evEl('th', {}, 'Test'), evEl('th', {}, 'Atunci'), evEl('th', {}, 'Acum'), evEl('th')),
      EV_TESTE.map(t => evEl('tr', {},
        evEl('td', {}, `${t.id}. ${t.nume}`),
        evEl('td', { class: 'c' }, celule(t, tA)),
        evEl('td', { class: 'c' }, celule(t, tB)),
        evEl('td', {}, verdict(scorTest(t, tA), scorTest(t, tB)))))),
    evEl('div', { class: 'ev-r-sub', style: 'margin-top:8px;font-size:12px' }, 'Unde testul se face pe ambele părți: stânga, apoi dreapta.'),
    evActiuniFoaie(),
  ]);
}
