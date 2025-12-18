-- SMTP-Einstellungen für E-Mail-Versand
ALTER TABLE trainer_profiles
ADD COLUMN IF NOT EXISTS smtp_host TEXT,
ADD COLUMN IF NOT EXISTS smtp_port INTEGER DEFAULT 587,
ADD COLUMN IF NOT EXISTS smtp_user TEXT,
ADD COLUMN IF NOT EXISTS smtp_pass TEXT,
ADD COLUMN IF NOT EXISTS smtp_from_email TEXT,
ADD COLUMN IF NOT EXISTS smtp_from_name TEXT,
ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN DEFAULT true;

-- Kommentar für die Spalten
COMMENT ON COLUMN trainer_profiles.smtp_host IS 'SMTP Server Hostname';
COMMENT ON COLUMN trainer_profiles.smtp_port IS 'SMTP Port (Standard: 587 für TLS, 465 für SSL)';
COMMENT ON COLUMN trainer_profiles.smtp_user IS 'SMTP Benutzername';
COMMENT ON COLUMN trainer_profiles.smtp_pass IS 'SMTP Passwort (verschlüsselt speichern empfohlen)';
COMMENT ON COLUMN trainer_profiles.smtp_from_email IS 'Absender E-Mail-Adresse';
COMMENT ON COLUMN trainer_profiles.smtp_from_name IS 'Absender Name';
COMMENT ON COLUMN trainer_profiles.smtp_secure IS 'TLS/SSL verwenden';
