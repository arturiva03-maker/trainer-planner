-- CSV-Import für Bankumsätze und AI-Matching
-- Erweitert das bestehende bank_transactions Schema für CSV-Import (ohne GoCardless)

-- bank_connection_id optional machen für CSV-Importe
ALTER TABLE bank_transactions
  ALTER COLUMN bank_connection_id DROP NOT NULL;

-- Neue Spalten für CSV-Import und AI-Matching
ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS import_source TEXT DEFAULT 'csv' CHECK (import_source IN ('csv', 'api', 'manual')),
  ADD COLUMN IF NOT EXISTS ai_suggestion JSONB, -- AI-Vorschlag: {type: 'rechnung'|'training'|'ausgabe', id: UUID, confidence: number, reason: string}
  ADD COLUMN IF NOT EXISTS ai_suggestion_status TEXT DEFAULT 'pending' CHECK (ai_suggestion_status IN ('pending', 'accepted', 'rejected', 'none'));

-- Index für nicht-gematchte Transaktionen
CREATE INDEX IF NOT EXISTS idx_bank_transactions_unmatched
  ON bank_transactions(user_id, match_status)
  WHERE match_status = 'unmatched';

-- Index für AI-Vorschläge die noch offen sind
CREATE INDEX IF NOT EXISTS idx_bank_transactions_ai_pending
  ON bank_transactions(user_id, ai_suggestion_status)
  WHERE ai_suggestion_status = 'pending';

-- Tabelle für offene Rechnungen/Forderungen (generiert aus Trainings + manuellen Rechnungen)
-- Diese View fasst alle offenen Posten zusammen
CREATE OR REPLACE VIEW offene_posten AS
-- Offene Trainings-Einnahmen (nicht bezahlt und nicht bar bezahlt)
SELECT
  t.id,
  t.user_id,
  'training' as typ,
  t.datum,
  s.name as empfaenger_name,
  s.id as spieler_id,
  COALESCE(t.custom_preis_pro_stunde, tar.preis_pro_stunde, 0) *
    EXTRACT(EPOCH FROM (t.uhrzeit_bis::time - t.uhrzeit_von::time)) / 3600 as betrag,
  tar.name as beschreibung,
  NULL::TEXT as rechnungsnummer
FROM trainings t
JOIN spieler s ON s.id = ANY(t.spieler_ids)
LEFT JOIN tarife tar ON tar.id = t.tarif_id
WHERE t.status = 'durchgefuehrt'
  AND NOT t.bezahlt
  AND NOT t.bar_bezahlt
  -- Prüfe ob es keinen spieler_training_payments Eintrag gibt der bezahlt ist
  AND NOT EXISTS (
    SELECT 1 FROM spieler_training_payments stp
    WHERE stp.training_id = t.id
    AND stp.spieler_id = s.id
    AND (stp.bezahlt OR stp.bar_bezahlt)
  )

UNION ALL

-- Offene manuelle Rechnungen
SELECT
  id,
  user_id,
  'rechnung' as typ,
  rechnungsdatum as datum,
  empfaenger_name,
  NULL::UUID as spieler_id,
  brutto_gesamt as betrag,
  beschreibung,
  rechnungsnummer
FROM manuelle_rechnungen
WHERE NOT bezahlt AND NOT bar_bezahlt

UNION ALL

-- Offene Ausgaben (noch nicht bezahlt)
SELECT
  id,
  user_id,
  'ausgabe' as typ,
  datum,
  beschreibung as empfaenger_name,
  NULL::UUID as spieler_id,
  -betrag as betrag, -- Negativ weil Ausgabe
  kategorie::TEXT as beschreibung,
  rechnungsnummer
FROM ausgaben
WHERE NOT bezahlt;

-- Kommentar für die View
COMMENT ON VIEW offene_posten IS 'Zusammenfassung aller offenen Einnahmen und Ausgaben für den Bankabgleich';
