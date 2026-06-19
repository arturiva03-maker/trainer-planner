-- ============================================
-- Platzgebuehr-Label pro Spieler
-- Sommersaison (Mai-September): erwachsene Spieler mit diesem Label
-- zahlen pro gegebener Trainingsstunde eine Platzgebuehr (5 EUR/Std).
-- ============================================

ALTER TABLE spieler
  ADD COLUMN IF NOT EXISTS platzgebuehr BOOLEAN NOT NULL DEFAULT false;

-- Einmalige Platzgebuehr pro Training: Liste der Spieler-IDs, die nur fuer
-- dieses eine Training Platzgebuehr zahlen (auch ohne globales Label).
ALTER TABLE trainings
  ADD COLUMN IF NOT EXISTS platzgebuehr_spieler_ids JSONB;
