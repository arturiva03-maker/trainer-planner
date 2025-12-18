-- Buchungskonten für Buchhaltung/EÜR (angelehnt an SKR03)
-- Ermöglicht Zuordnung von Einnahmen/Ausgaben zu Konten

-- Konten-Tabelle
CREATE TABLE IF NOT EXISTS buchungskonten (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kontonummer TEXT NOT NULL, -- z.B. "4600"
  name TEXT NOT NULL, -- z.B. "Werbekosten"
  typ TEXT NOT NULL CHECK (typ IN ('einnahme', 'ausgabe', 'neutral')), -- einnahme/ausgabe/neutral (Privatentnahmen)
  beschreibung TEXT,
  ist_standard BOOLEAN DEFAULT false, -- Standard-Konten die nicht gelöscht werden können
  sortierung INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, kontonummer)
);

-- Konto-Feld zu bank_transactions hinzufügen
ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS buchungskonto_id UUID REFERENCES buchungskonten(id) ON DELETE SET NULL;

-- Konto-Feld zu ausgaben hinzufügen
ALTER TABLE ausgaben
  ADD COLUMN IF NOT EXISTS buchungskonto_id UUID REFERENCES buchungskonten(id) ON DELETE SET NULL;

-- Index für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_buchungskonten_user ON buchungskonten(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_konto ON bank_transactions(buchungskonto_id);
CREATE INDEX IF NOT EXISTS idx_ausgaben_konto ON ausgaben(buchungskonto_id);

-- RLS Policies
ALTER TABLE buchungskonten ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own buchungskonten" ON buchungskonten
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own buchungskonten" ON buchungskonten
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own buchungskonten" ON buchungskonten
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own buchungskonten" ON buchungskonten
  FOR DELETE USING (auth.uid() = user_id AND ist_standard = false);

-- Standard-Konten für alle User anlegen (via Trigger bei neuen Usern)
-- Oder manuell: Diese werden beim ersten Laden in der App angelegt
