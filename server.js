require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const patientsRoutes = require('./routes/patients');
const appointmentsRoutes = require('./routes/appointments');
const subscriptionsRoutes = require('./routes/subscriptions');
const consentRoutes = require('./routes/consent');
const statsRoutes = require('./routes/stats');
const checkinRoutes = require('./routes/checkin');
const usersRoutes = require('./routes/users');
const scheduleRoutes = require('./routes/schedule');
const notificariRoutes = require('./routes/notificari');
const liveRoutes = require('./routes/live');
const pushRoutes = require('./routes/push');
const { porneteReminderele } = require('./services/reminders');
const { trimiteTuturor } = require('./services/live');

// Plasa de siguranta: o eroare care scapa neprinsa dintr-o ruta (ex. o interogare DB esuata)
// nu mai trebuie sa doboare tot serverul si sa deconecteze toata echipa - doar se logheaza.
process.on('unhandledRejection', (motiv) => {
  console.error('Promisiune nerezolvata, neprinsa:', motiv);
});
process.on('uncaughtException', (eroare) => {
  console.error('Eroare neprinsa:', eroare);
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' })); // limita mare, semnaturile sunt imagini base64

// Orice modificare reusita (POST/PATCH/DELETE) anunta instant, prin SSE, toate telefoanele/tabletele
// deschise - ca datele sa se actualizeze singure la ceilalti, fara sa mai fie nevoie de refresh manual.
const CAI_FARA_ANUNT = ['/api/auth', '/api/live', '/api/push'];
app.use((req, res, next) => {
  res.on('finish', () => {
    const eModificare = req.method !== 'GET' && res.statusCode < 400;
    const eCaleExclusa = CAI_FARA_ANUNT.some(cale => req.path.startsWith(cale));
    if (eModificare && req.path.startsWith('/api/') && !eCaleExclusa) {
      trimiteTuturor({ tip: 'schimbare' });
    }
  });
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/pacienti', patientsRoutes);
app.use('/api/programari', appointmentsRoutes);
app.use('/api/abonamente', subscriptionsRoutes);
app.use('/api/gdpr', consentRoutes);
app.use('/api/statistici', statsRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/utilizatori', usersRoutes);
app.use('/api/orar-kineto', scheduleRoutes);
app.use('/api/notificari', notificariRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/push', pushRoutes);

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Reset ruleaza pe portul ${PORT}`);
  porneteReminderele();
});