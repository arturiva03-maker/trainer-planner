-- Fix: Unique constraint für CSV-Import (ohne bank_connection_id)
-- Der ursprüngliche Constraint war UNIQUE(bank_connection_id, transaction_id)
-- aber bei CSV-Import ist bank_connection_id NULL

-- Neuer unique index nur auf user_id + transaction_id für Duplikaterkennung
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_transactions_user_tx_id
  ON bank_transactions(user_id, transaction_id);
