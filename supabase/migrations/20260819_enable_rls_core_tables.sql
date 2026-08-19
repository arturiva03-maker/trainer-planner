-- ============================================
-- RLS fuer die Kern-Tabellen aktivieren
-- (Supabase Security Advisor: rls_disabled_in_public)
--
-- Diese 7 Tabellen wurden urspruenglich direkt im Studio angelegt
-- und hatten nie RLS. Ohne RLS kann jeder mit dem oeffentlichen
-- anon-Key alle Daten beider Trainer lesen und aendern.
--
-- Alle 7 Tabellen haben user_id, die App filtert ueberall danach
-- (.eq('user_id', user.id)) und setzt user_id bei jedem Insert/Upsert.
-- Die Policy bildet also genau das bestehende Verhalten ab.
--
-- (select auth.uid()) statt auth.uid(): wird einmal pro Query statt
-- einmal pro Zeile ausgewertet -- wichtig bei >1000 Zahlungszeilen.
-- ============================================

-- spieler
ALTER TABLE public.spieler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_all" ON public.spieler;
CREATE POLICY "owner_all" ON public.spieler
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- tarife
ALTER TABLE public.tarife ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_all" ON public.tarife;
CREATE POLICY "owner_all" ON public.tarife
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- trainer
ALTER TABLE public.trainer ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_all" ON public.trainer;
CREATE POLICY "owner_all" ON public.trainer
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- trainings
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_all" ON public.trainings;
CREATE POLICY "owner_all" ON public.trainings
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- spieler_training_payments (Upsert braucht INSERT+UPDATE -> FOR ALL deckt beides)
ALTER TABLE public.spieler_training_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_all" ON public.spieler_training_payments;
CREATE POLICY "owner_all" ON public.spieler_training_payments
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- monthly_adjustments
ALTER TABLE public.monthly_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_all" ON public.monthly_adjustments;
CREATE POLICY "owner_all" ON public.monthly_adjustments
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- trainer_profiles
ALTER TABLE public.trainer_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_all" ON public.trainer_profiles;
CREATE POLICY "owner_all" ON public.trainer_profiles
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
