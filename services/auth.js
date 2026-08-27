const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'schimba-acest-secret-in-productie';

function creeazaToken(user) {
  return jwt.sign({ id: user.id, rol: user.rol, nume: user.nume }, SECRET, { expiresIn: '12h' });
}

function ceareAutentificare(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ eroare: 'Autentificare necesara' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ eroare: 'Token invalid sau expirat' });
  }
}

function ceareAdmin(req, res, next) {
  if (req.user?.rol !== 'admin') return res.status(403).json({ eroare: 'Doar admin poate face asta' });
  next();
}

module.exports = { creeazaToken, ceareAutentificare, ceareAdmin, SECRET };
