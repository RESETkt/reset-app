const express = require('express');
const jwt = require('jsonwebtoken');
const { SECRET } = require('../services/auth');
const { adaugaClient, eliminaClient } = require('../services/live');

const router = express.Router();

// EventSource nu poate trimite header-ul Authorization, asa ca tokenul vine ca query param.
router.get('/', (req, res) => {
  try {
    jwt.verify(req.query.token || '', SECRET);
  } catch {
    return res.status(401).end();
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.write('retry: 3000\n\n');
  if (res.flushHeaders) res.flushHeaders();

  adaugaClient(res);

  // Bataie de inima, ca sa nu inchida proxy-urile conexiunea inactiva
  const bataieInima = setInterval(() => res.write(':\n\n'), 25000);

  req.on('close', () => {
    clearInterval(bataieInima);
    eliminaClient(res);
  });
});

module.exports = router;
