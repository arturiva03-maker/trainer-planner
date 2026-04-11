-- Migration: Mehrfach-Rechnungszuordnung für Bankimport (Sammelbuchungen)
-- Ermöglicht die Zuordnung mehrerer Rechnungen zu einem Bankumsatz

-- 1. Zwischentabelle für N:M Beziehung zwischen bank_transactions und manuelle_rechnungen
CREATE TABLE IF NOT EXISTS bank_transaction_rechnungen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_transaction_id UUID NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
  rechnung_id UUID NOT NULL REFERENCES manuelle_rechnungen(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Eindeutigkeit: Eine Rechnung kann nur einmal pro Transaktion zugeordnet werden
  UNIQUE(bank_transaction_id, rechnung_id)
);

-- 2. Indizes für Performance
CREATE INDEX IF NOT EXISTS idx_btr_transaction ON bank_transaction_rechnungen(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_btr_rechnung ON bank_transaction_rechnungen(rechnung_id);

-- 3. RLS Policies (basierend auf bank_transactions.user_id)
ALTER TABLE bank_transaction_rechnungen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transaction_rechnungen" ON bank_transaction_rechnungen;
CREATE POLICY "Users can view own transaction_rechnungen" ON bank_transaction_rechnungen
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bank_transactions bt
      WHERE bt.id = bank_transaction_id
      AND bt.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own transaction_rechnungen" ON bank_transaction_rechnungen;
CREATE POLICY "Users can insert own transaction_rechnungen" ON bank_transaction_rechnungen
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bank_transactions bt
      WHERE bt.id = bank_transaction_id
      AND bt.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own transaction_rechnungen" ON bank_transaction_rechnungen;
CREATE POLICY "Users can delete own transaction_rechnungen" ON bank_transaction_rechnungen
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM bank_transactions bt
      WHERE bt.id = bank_transaction_id
      AND bt.user_id = auth.uid()
    )
  );

-- 4. Migration existierender 1:1 Zuordnungen in neue Tabelle
-- Kopiert alle bestehenden matched_rechnung_id Verknüpfungen
INSERT INTO bank_transaction_rechnungen (bank_transaction_id, rechnung_id)
SELECT id, matched_rechnung_id
FROM bank_transactions
WHERE matched_rechnung_id IS NOT NULL
ON CONFLICT (bank_transaction_id, rechnung_id) DO NOTHING;

-- Kommentar für Dokumentation
COMMENT ON TABLE bank_transaction_rechnungen IS 'Zwischentabelle für N:M Beziehung zwischen Bankumsätzen und Rechnungen (Sammelbuchungen)';
COMMENT ON COLUMN bank_transactions.matched_rechnung_id IS 'DEPRECATED: Für Abwärtskompatibilität. Neue Zuordnungen über bank_transaction_rechnungen.';
