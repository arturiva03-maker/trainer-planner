-- Korrektur: Reset custom_preis_pro_stunde für Trainings die fälschlicherweise 0 haben
-- aber einen Tarif verwenden sollten

-- Zeige zuerst betroffene Trainings an (optional - zum Prüfen)
-- SELECT id, datum, tarif_id, custom_preis_pro_stunde
-- FROM trainings
-- WHERE custom_preis_pro_stunde = 0 AND tarif_id IS NOT NULL;

-- Setze custom_preis_pro_stunde auf NULL für alle Trainings wo:
-- 1. custom_preis_pro_stunde = 0 (fehlerhaft gesetzt)
-- 2. UND tarif_id gesetzt ist (soll Tarif-Preis verwenden)
UPDATE trainings
SET custom_preis_pro_stunde = NULL
WHERE custom_preis_pro_stunde = 0
AND tarif_id IS NOT NULL;

-- Ergebnis anzeigen
-- SELECT COUNT(*) as korrigierte_trainings FROM trainings WHERE custom_preis_pro_stunde IS NULL AND tarif_id IS NOT NULL;
