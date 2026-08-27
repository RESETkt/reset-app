let token = localStorage.getItem('reset_token');
let pacientCurent = null;

if (token) aratatApp();

async function login() {
  const email = document.getElementById('login-email').value;
  const parola = document.getElementById('login-parola').value;
  const r = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, parola })
  });
  const data = await r.json();
  if (!r.ok) {
    document.getElementById('login-eroare').textContent = data.eroare;
    return;
  }
  token = data.token;
  localStorage.setItem('reset_token', token);
  aratatApp();
}

function aratatApp() {
  document.getElementById('login').style.display = 'none';
  document.getElementById('app').style.display = 'grid';
  cautaPacienti('');
  aratapanel('fisa');
}

async function apel(cale, optiuni = {}) {
  const r = await fetch(cale, {
    ...optiuni,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(optiuni.headers || {})
    }
  });
  if (r.status === 401) {
    localStorage.removeItem('reset_token');
    location.reload();
  }
  return r.json();
}

async function cautaPacienti(q) {