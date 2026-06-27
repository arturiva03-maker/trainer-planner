-- ============================================
-- Tarif archivieren (Soft-Delete)
-- Nicht mehr genutzte Tarife (z.B. aus dem Winter) koennen archiviert werden:
-- sie bleiben in der DB erhalten, damit alte Trainings/Abrechnungen weiterhin
-- den korrekten Preis und Namen anzeigen. Archivierte Tarife verschwinden nur
-- aus der Auswahl beim Anlegen neuer Trainings. Reversibel (wieder aktivierbar).
-- ============================================

ALTER TABLE tarife
  ADD COLUMN IF NOT EXISTS archiviert BOOLEAN NOT NULL DEFAULT false;
