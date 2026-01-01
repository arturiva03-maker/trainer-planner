-- Migration: Ausstehend-Status für Zahlungen
-- Fügt neuen Status "ausstehend" hinzu für: Offen → Ausstehend → Bezahlt

-- Neue Spalte für ausstehend-Status
ALTER TABLE spieler_training_payments
ADD COLUMN IF NOT EXISTS ausstehend BOOLEAN DEFAULT FALSE;

-- Kommentar
COMMENT ON COLUMN spieler_training_payments.ausstehend IS 'Rechnung/Erinnerung gesendet, Zahlung wird erwartet';
