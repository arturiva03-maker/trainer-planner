-- ============================================
-- email_vorlagen entfernen
--
-- Rest aus einem alten E-Mail-Feature: eine Zeile, kein Zugriff aus dem
-- aktuellen Code. Wurde in 20260819_enable_rls_email_vorlagen.sql zuerst
-- abgesichert (Security Advisor) und dann als tote Tabelle entfernt.
-- ============================================

DROP TABLE IF EXISTS public.email_vorlagen;
