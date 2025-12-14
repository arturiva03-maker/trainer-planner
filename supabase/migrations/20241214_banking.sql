-- Banking-Integration: Tabellen für GoCardless Bank Account Data
-- Ermöglicht das Abrufen und Abgleichen von Bankumsätzen

-- Bank-Verbindungen (pro User kann es mehrere geben)
CREATE TABLE IF NOT EXISTS bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id TEXT NOT NULL, -- GoCardless Institution ID (z.B. COMMERZBANK_COBADEFFXXX)
  institution_name TEXT NOT NULL, -- Anzeigename (z.B. "Commerzbank")
  requisition_id TEXT NOT NULL, -- GoCardless Requisition ID
  account_id TEXT, -- GoCardless Account ID (nach Verknüpfung)
  iban TEXT, -- IBAN des verknüpften Kontos
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'error')),
  last_sync TIMESTAMPTZ, -- Letzter erfolgreicher Sync
  error_message TEXT, -- Fehlermeldung bei status='error'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bank-Transaktionen (importiert von GoCardless)
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_connection_id UUID NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL, -- GoCardless Transaction ID (für Deduplizierung)
  booking_date DATE NOT NULL,
  value_date DATE,
  amount NUMERIC(12,2) NOT NULL, -- Positiv = Eingang, Negativ = Ausgang
  currency TEXT DEFAULT 'EUR',
  debtor_name TEXT, -- Bei Eingang: Wer hat gezahlt
  creditor_name TEXT, -- Bei Ausgang: An wen
  remittance_info TEXT, -- Verwendungszweck
  -- Matching-Status
  match_status TEXT NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('unmatched', 'auto_matched', 'manual_matched', 'ignored')),
  matched_training_id UUID REFERENCES trainings(id) ON DELETE SET NULL,
  matched_spieler_id UUID REFERENCES spieler(id) ON DELETE SET NULL,
  matched_rechnung_id UUID REFERENCES manuelle_rechnungen(id) ON DELETE SET NULL,
  matched_ausgabe_id UUID REFERENCES ausgaben(id) ON DELETE SET NULL,
  match_confidence INTEGER, -- 0-100 bei auto_match
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Eindeutig pro Verbindung und Transaction-ID
  UNIQUE(bank_connection_id, transaction_id)
);

-- Indizes für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_bank_connections_user ON bank_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_user ON bank_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_connection ON bank_transactions(bank_connection_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(booking_date);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_status ON bank_transactions(match_status);

-- RLS Policies
ALTER TABLE bank_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

-- User kann nur eigene Bank-Verbindungen sehen/bearbeiten
CREATE POLICY "Users can view own bank_connections" ON bank_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bank_connections" ON bank_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bank_connections" ON bank_connections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bank_connections" ON bank_connections
  FOR DELETE USING (auth.uid() = user_id);

-- User kann nur eigene Transaktionen sehen/bearbeiten
CREATE POLICY "Users can view own bank_transactions" ON bank_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bank_transactions" ON bank_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bank_transactions" ON bank_transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bank_transactions" ON bank_transactions
  FOR DELETE USING (auth.uid() = user_id);
