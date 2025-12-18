-- Training-IDs zu manuelle_rechnungen hinzufügen
-- Damit können Trainings-Rechnungen (aus Spieler-Abrechnung) von manuellen Rechnungen unterschieden werden
-- Trainings die zu einer Rechnung gehören werden aus den Training-Einnahmen gefiltert

ALTER TABLE manuelle_rechnungen
  ADD COLUMN IF NOT EXISTS training_ids TEXT[] DEFAULT '{}';

-- spieler_id für die Zuordnung zur Spieler-Abrechnung
ALTER TABLE manuelle_rechnungen
  ADD COLUMN IF NOT EXISTS spieler_id UUID REFERENCES spieler(id) ON DELETE SET NULL;

-- Index für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_manuelle_rechnungen_spieler ON manuelle_rechnungen(spieler_id);
