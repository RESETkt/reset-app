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
const { porneteReminderele } = require('./services/reminders');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' })); // limita mare, semnaturile sunt imagini base64

app.use('/api/auth', authRoutes);
app.use('/api/pacienti', patientsRoutes);
app.use('/api/programari', appointmentsRoutes);
app.use('/api/abonamente', subscriptionsRoutes);
app.use('/api/gdpr', consentRoutes);
app.use('/api/statistici', statsRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/utilizatori', usersRoutes);
app.use('/api/orar-kineto', scheduleRoutes);

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Reset ruleaza pe portul ${PORT}`);
  porneteReminderele();
});