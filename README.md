# Reset - aplicatie kinetoterapie

## Ce contine
- `server.js` + `routes/` - API backend (Express + Postgres)
- `public/index.html` + `app.js` - dashboard pentru kineto (login necesar)
- `public/tablet.html` + `tablet.js` - ecran de check-in pentru pacienti (fara login, pentru tableta de la receptie)
- `db/schema.sql` - structura bazei de date
- `services/reminders.js` - job automat care trimite SMS/email cu o zi inainte de programare
- `render.yaml` - configurare pentru deploy automat pe Render

## Pasi de deploy pe Render

1. **Urca folderul intr-un repo Git** (GitHub e cel mai simplu - creezi un repo nou, dai `git init`, `git add .`, `git commit`, `git push`).
2. Intra pe [render.com](https://render.com), New -> Blueprint, conecteaza repo-ul. Render citeste automat `render.yaml` si iti creeaza:
   - un web service (aplicatia)
   - o baza de date Postgres gratuita
3. Dupa ce serviciul e creat, in tab-ul **Environment** al web service-ului completezi manual:
   - `BREVO_API_KEY` - din contul tau Brevo (Settings -> SMTP & API -> API Keys)
   - `BREVO_EMAIL_SENDER` - un email verificat in Brevo (Settings -> Senders)
4. Ruleaza migrarea o singura data, din tab-ul **Shell** al serviciului pe Render:
   ```
   npm run migrate
   ```
5. Creeaza primul cont de admin (tot din Shell, sau cu un request temporar catre API):
   ```
   curl -X POST https://<numele-aplicatiei>.onrender.com/api/auth/inregistreaza \
     -H "Content-Type: application/json" \
     -d '{"nume":"Admin","email":"admin@reset.ro","parola":"schimba-parola-asta","rol":"admin"}'
   ```
   **Important:** dupa ce ai creat conturile necesare, sterge sau protejeaza ruta `/api/auth/inregistreaza` din `routes/auth.js` - momentan e deschisa, ca sa poti crea usor primul cont.

## Adrese dupa deploy
- Dashboard kineto: `https://<numele-aplicatiei>.onrender.com/index.html`
- Tableta pacienti: `https://<numele-aplicatiei>.onrender.com/tablet.html`

## Sender ID pentru SMS
Daca vrei sa apara "RESET" in loc de un numar la SMS, se cere din panoul Brevo (SMS -> Senders) - aprobarea dureaza cateva zile lucratoare. Pana atunci, `BREVO_SMS_SENDER` poate ramane un numar de telefon Brevo default.

## Ce mai ramane de facut / de decis
- Adaugarea de conturi noi pentru fiecare kineto (momentan doar admin le poate crea, prin ruta de inregistrare)
- Un formular de adaugare pacient nou in dashboard (momentan se poate face doar direct prin API)
- Export/rapoarte descarcabile (PDF/Excel) daca vrei sa arhivezi statistici lunare
- Politica exacta de log/audit pentru accesul kineto la fisele pacientilor (mentionata in discutia initiala)
