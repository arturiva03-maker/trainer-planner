-- ============================================
-- Tarif ohne Platzgebuehr (Hallen-/Wintertarife)
-- In der Hallensaison ist die Platzmiete im Trainingspreis enthalten, es faellt
-- also keine zusaetzliche Platzgebuehr an. Tarife mit `ohne_platzgebuehr = true`
-- schalten die Platzgebuehr fuer jeden Spieler ab, der in einem Training mit
-- diesem Tarif abgerechnet wird — unabhaengig vom globalen Spieler-Label und
-- unabhaengig vom Monat (die Hallensaison laeuft 21.09.-29.03. und ueberlappt
-- damit die Sommermonate Mai-September).
-- Individuelle Spieler-Tarife im Gruppentraining schlagen den Trainingstarif.
-- ============================================

ALTER TABLE tarife
  ADD COLUMN IF NOT EXISTS ohne_platzgebuehr BOOLEAN NOT NULL DEFAULT false;

-- Alle Wintertarife direkt markieren
UPDATE tarife
   SET ohne_platzgebuehr = true
 WHERE name ILIKE '%winter%'
   AND ohne_platzgebuehr = false;
