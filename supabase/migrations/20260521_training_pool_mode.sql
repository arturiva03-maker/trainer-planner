-- ============================================
-- Pool-Modus direkt am Training/Serie
-- Pauschalpreis pro Spieler pro Einheit, einheiten pro Spieler
-- liegt im bestehenden spieler_tarife-JSON unter "einheiten".
-- ============================================

ALTER TABLE trainings
  ADD COLUMN IF NOT EXISTS ist_pool BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE trainings
  ADD COLUMN IF NOT EXISTS pool_pauschalpreis_pro_einheit NUMERIC(10,2);
