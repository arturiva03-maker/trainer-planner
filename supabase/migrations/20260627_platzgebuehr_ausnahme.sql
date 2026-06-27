-- ============================================
-- Platzgebuehr-Ausnahme pro Training
-- Gelabelte Spieler (spieler.platzgebuehr = true) zahlen in der Sommersaison
-- automatisch Platzgebuehr. Mit dieser Spalte kann ein einzelner Spieler
-- ausnahmsweise NUR fuer dieses eine Training von der Platzgebuehr befreit
-- werden (Liste der ausgenommenen Spieler-IDs).
-- ============================================

ALTER TABLE trainings
  ADD COLUMN IF NOT EXISTS platzgebuehr_ausnahme_ids JSONB;
