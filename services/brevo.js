const axios = require('axios');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SMS_SENDER = process.env.BREVO_SMS_SENDER || 'RESET';
const EMAIL_SENDER = process.env.BREVO_EMAIL_SENDER || 'no-reply@example.com';
const EMAIL_SENDER_NAME = process.env.BREVO_EMAIL_SENDER_NAME || 'Reset Kineto';

async function trimiteSMS(telefon, mesaj) {
  if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY lipseste din variabilele de mediu');
  return axios.post('https://api.brevo.com/v3/transactionalSMS/sms', {
    sender: SMS_SENDER,
    recipient: telefon,
    content: mesaj
  }, {
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' }
  });
}

async function trimiteEmail(destinatar, subiect, continutHtml) {
  if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY lipseste din variabilele de mediu');
  return axios.post('https://api.brevo.com/v3/smtp/email', {
    sender: { email: EMAIL_SENDER, name: EMAIL_SENDER_NAME },
    to: [{ email: destinatar }],
    subject: subiect,
    htmlContent: continutHtml
  }, {
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' }
  });
}

module.exports = { trimiteSMS, trimiteEmail };
