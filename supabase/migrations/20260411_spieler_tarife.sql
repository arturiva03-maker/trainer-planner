-- Individuelle Tarife pro Spieler in einem (Gruppen-)Training
-- Struktur: { "<spieler_id>": { "tarif_id": "<uuid|null>", "custom_preis": <number|null> } }
ALTER TABLE trainings
ADD COLUMN IF NOT EXISTS spieler_tarife JSONB;
