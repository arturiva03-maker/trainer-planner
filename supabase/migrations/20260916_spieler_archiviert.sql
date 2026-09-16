-- ============================================
-- Spieler archivieren (Soft-Delete)
-- Spieler, die nicht mehr trainieren (Saisonende, Wechsel, Abmeldung), koennen
-- archiviert werden: sie bleiben in der DB erhalten, damit alte Trainings,
-- Abrechnungen und Platzgebuehren weiterhin korrekt angezeigt und berechnet
-- werden. Archivierte Spieler verschwinden nur aus der Auswahl beim Anlegen
-- neuer Trainings und aus der Spielerliste in der Verwaltung.
-- Reversibel (wieder aktivierbar). Gleiches Muster wie tarife.archiviert.
-- ============================================

ALTER TABLE spieler
  ADD COLUMN IF NOT EXISTS archiviert BOOLEAN NOT NULL DEFAULT false;
