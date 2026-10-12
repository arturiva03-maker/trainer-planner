-- Keep holiday attendance snapshots without blocking deletion of regular trainings.
DO $$
BEGIN
  IF to_regclass('public.ferien_stunden') IS NOT NULL THEN
    ALTER TABLE public.ferien_stunden
      ALTER COLUMN training_id DROP NOT NULL;
    ALTER TABLE public.ferien_stunden
      DROP CONSTRAINT IF EXISTS ferien_stunden_training_id_fkey;
    ALTER TABLE public.ferien_stunden
      ADD CONSTRAINT ferien_stunden_training_id_fkey
      FOREIGN KEY (training_id) REFERENCES public.trainings(id) ON DELETE SET NULL;
  END IF;
END
$$;
