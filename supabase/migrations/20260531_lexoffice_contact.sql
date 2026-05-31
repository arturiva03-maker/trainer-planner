-- Verknuepfung Spieler -> Lexoffice-Kontakt (Rechnungsempfaenger, i.d.R. Elternteil).
-- Wird beim ersten Anlegen einer Rechnung pro Spieler gesetzt und danach
-- wiederverwendet.
ALTER TABLE spieler
  ADD COLUMN IF NOT EXISTS lexoffice_contact_id TEXT,
  ADD COLUMN IF NOT EXISTS lexoffice_contact_name TEXT;
