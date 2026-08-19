-- ============================================
-- RLS fuer email_vorlagen aktivieren
-- (Supabase Security Advisor: rls_disabled_in_public)
--
-- Einzige public-Tabelle ohne RLS. Ohne RLS konnte jeder mit dem
-- oeffentlichen anon-Key die Vorlagen beider Trainer lesen und aendern.
-- Die Tabelle wird vom aktuellen Code nirgends benutzt (Rest aus einem
-- alten E-Mail-Feature), hat aber user_id -- also dieselbe Owner-Policy
-- wie die uebrigen Tabellen.
--
-- (select auth.uid()) statt auth.uid(): wird einmal pro Query statt
-- einmal pro Zeile ausgewertet.
-- ============================================

ALTER TABLE public.email_vorlagen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all" ON public.email_vorlagen;
CREATE POLICY "owner_all" ON public.email_vorlagen
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
