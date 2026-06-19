-- ============================================
-- Platzgebuehr-Label pro Spieler
-- Sommersaison (Mai-September): erwachsene Spieler mit diesem Label
-- zahlen pro gegebener Trainingsstunde eine Platzgebuehr (5 EUR/Std).
-- ============================================

ALTER TABLE spieler
  ADD COLUMN IF NOT EXISTS platzgebuehr BOOLEAN NOT NULL DEFAULT false;
