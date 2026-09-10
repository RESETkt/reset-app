// Legatura live cu toate telefoanele/tabletele deschise (Server-Sent Events), ca modificarile
// facute de cineva sa apara instant la ceilalti, fara sa mai fie nevoie de refresh manual.
let clienti = [];

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

module.exports = { adaugaClient, eliminaClient, trimiteTuturor };
