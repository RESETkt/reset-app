// Legatura live cu toate telefoanele/tabletele deschise (Server-Sent Events), ca modificarile
// facute de cineva sa apara instant la ceilalti, fara sa mai fie nevoie de refresh manual.
let clienti = [];

// Un id unic generat la pornirea procesului - se schimba la fiecare deploy (procesul repor-
// neste). Trimis fiecarui client conectat, ca sa poata detecta instant o versiune noua a
// aplicatiei si sa se reincarce singur, fara sa astepte un refresh manual sau verificarea
// interna (rara) a browserului pentru service worker.
const VERSIUNE_SERVER = String(Date.now());

function adaugaClient(res) {
  clienti.push(res);
}

function eliminaClient(res) {
  clienti = clienti.filter(c => c !== res);
}

function trimiteTuturor(eveniment) {
  const linie = `data: ${JSON.stringify(eveniment)}\n\n`;
  clienti.forEach(res => {
    try {
      res.write(linie);
    } catch {
      eliminaClient(res);
    }
  });
}

module.exports = { adaugaClient, eliminaClient, trimiteTuturor, VERSIUNE_SERVER };
