-- Neuer Training-Status 'durchgefuehrt_halb' (z.B. Regen-Abbruch, 50%-Berechnung).
-- Falls eine alte CHECK-Constraint auf trainings.status existiert, wird sie
-- gegen eine erweiterte Variante ausgetauscht. Wenn keine existiert, ist
-- der ALTER ADD problemlos moeglich.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'trainings'
      AND c.conname = 'trainings_status_check'
  ) THEN
    ALTER TABLE trainings DROP CONSTRAINT trainings_status_check;
  END IF;
END $$;

ALTER TABLE trainings
  ADD CONSTRAINT trainings_status_check
  CHECK (status IN ('geplant', 'durchgefuehrt', 'durchgefuehrt_halb', 'abgesagt'));
