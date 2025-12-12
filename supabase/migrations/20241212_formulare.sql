-- ============================================
-- Event-Anmeldeformular System
-- Führe dieses Script im Supabase SQL Editor aus
-- ============================================

-- 1. Tabelle: formulare (Formular-Definitionen)
CREATE TABLE IF NOT EXISTS formulare (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titel TEXT NOT NULL,
  beschreibung TEXT,
  ist_aktiv BOOLEAN DEFAULT true,
  felder JSONB NOT NULL DEFAULT '[]',
  event_datum DATE,
  event_ort TEXT,
  max_anmeldungen INTEGER,
  anmeldeschluss TIMESTAMP WITH TIME ZONE,
  preis TEXT,
  absagefrist TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabelle: formular_anmeldungen (Eingereichte Anmeldungen)
CREATE TABLE IF NOT EXISTS formular_anmeldungen (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  formular_id UUID NOT NULL REFERENCES formulare(id) ON DELETE CASCADE,
  daten JSONB NOT NULL,
  gelesen BOOLEAN DEFAULT false,
  email_versendet BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Indizes für Performance
CREATE INDEX IF NOT EXISTS idx_formulare_user_id ON formulare(user_id);
CREATE INDEX IF NOT EXISTS idx_formulare_ist_aktiv ON formulare(ist_aktiv);
CREATE INDEX IF NOT EXISTS idx_anmeldungen_formular_id ON formular_anmeldungen(formular_id);
CREATE INDEX IF NOT EXISTS idx_anmeldungen_gelesen ON formular_anmeldungen(gelesen);
CREATE INDEX IF NOT EXISTS idx_anmeldungen_created_at ON formular_anmeldungen(created_at DESC);

-- 4. Row Level Security aktivieren
ALTER TABLE formulare ENABLE ROW LEVEL SECURITY;
ALTER TABLE formular_anmeldungen ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies für formulare

-- Owner kann eigene Formulare lesen
CREATE POLICY "Owner kann eigene Formulare lesen" ON formulare
  FOR SELECT USING (auth.uid() = user_id);

-- Owner kann eigene Formulare erstellen
CREATE POLICY "Owner kann Formulare erstellen" ON formulare
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Owner kann eigene Formulare aktualisieren
CREATE POLICY "Owner kann Formulare aktualisieren" ON formulare
  FOR UPDATE USING (auth.uid() = user_id);

-- Owner kann eigene Formulare löschen
CREATE POLICY "Owner kann Formulare löschen" ON formulare
  FOR DELETE USING (auth.uid() = user_id);

-- Öffentlicher Lesezugriff auf aktive Formulare (für anonyme Besucher)
CREATE POLICY "Öffentlicher Zugriff auf aktive Formulare" ON formulare
  FOR SELECT USING (ist_aktiv = true);

-- 6. RLS Policies für formular_anmeldungen

-- Jeder kann Anmeldungen für aktive Formulare erstellen (anonym)
CREATE POLICY "Anmeldungen können erstellt werden" ON formular_anmeldungen
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM formulare WHERE id = formular_id AND ist_aktiv = true)
  );

-- Owner kann Anmeldungen seiner Formulare lesen
CREATE POLICY "Owner kann Anmeldungen lesen" ON formular_anmeldungen
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM formulare WHERE id = formular_id AND user_id = auth.uid())
  );

-- Owner kann Anmeldungen aktualisieren (z.B. als gelesen markieren)
CREATE POLICY "Owner kann Anmeldungen aktualisieren" ON formular_anmeldungen
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM formulare WHERE id = formular_id AND user_id = auth.uid())
  );

-- Owner kann Anmeldungen löschen
CREATE POLICY "Owner kann Anmeldungen löschen" ON formular_anmeldungen
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM formulare WHERE id = formular_id AND user_id = auth.uid())
  );

-- 7. Updated_at Trigger für formulare
CREATE OR REPLACE FUNCTION update_formulare_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER formulare_updated_at
  BEFORE UPDATE ON formulare
  FOR EACH ROW
  EXECUTE FUNCTION update_formulare_updated_at();

-- ============================================
-- FERTIG! Die Tabellen sind jetzt eingerichtet.
-- ============================================
