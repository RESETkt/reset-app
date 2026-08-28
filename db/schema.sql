CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS utilizatori (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nume text NOT NULL,
  email text UNIQUE NOT NULL,
  parola_hash text NOT NULL,
  rol text NOT NULL CHECK (rol IN ('admin','kineto')),
  creat_la timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pacienti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nume text NOT NULL,
  prenume text NOT NULL,
  cnp text UNIQUE,
  telefon text,
  email text,
  diagnostic text,
  creat_la timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consimtaminte_gdpr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pacient_id uuid REFERENCES pacienti(id) ON DELETE CASCADE,
  semnatura_svg text NOT NULL,
  text_document text NOT NULL,
  data_semnare timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS abonamente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pacient_id uuid REFERENCES pacienti(id) ON DELETE CASCADE,
  tip text NOT NULL CHECK (tip IN ('8','12','individual')),
  total_sedinte int NOT NULL,
  sedinte_efectuate int NOT NULL DEFAULT 0,
  activ boolean DEFAULT true,
  creat_la timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plati (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pacient_id uuid REFERENCES pacienti(id) ON DELETE CASCADE,
  abonament_id uuid REFERENCES abonamente(id) ON DELETE SET NULL,
  suma numeric(10,2) NOT NULL,
  metoda text NOT NULL CHECK (metoda IN ('cash','card')),
  tip_plata text NOT NULL CHECK (tip_plata IN ('integral','rate')),
  motiv text,
  data_plata timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS programari (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pacient_id uuid REFERENCES pacienti(id) ON DELETE CASCADE,
  kineto_id uuid REFERENCES utilizatori(id),
  abonament_id uuid REFERENCES abonamente(id),
  data_ora timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'programat' CHECK (status IN ('programat','prezent','absent','reprogramat')),
  exercitii text,
  observatii text,
  semnatura_confirmare text,
  confirmat_la timestamptz
);

CREATE TABLE IF NOT EXISTS log_remindere (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pacient_id uuid REFERENCES pacienti(id) ON DELETE CASCADE,
  programare_id uuid REFERENCES programari(id) ON DELETE CASCADE,
  canal text NOT NULL CHECK (canal IN ('sms','email')),
  status text NOT NULL,
  trimis_la timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_programari_data ON programari(data_ora);
CREATE INDEX IF NOT EXISTS idx_programari_pacient ON programari(pacient_id);
CREATE INDEX IF NOT EXISTS idx_abonamente_pacient ON abonamente(pacient_id);