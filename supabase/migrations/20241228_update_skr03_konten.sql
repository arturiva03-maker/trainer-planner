-- Migration: Update Buchungskonten auf offizielle SKR03-Kontierung
-- Datum: 2024-12-28

-- Diese Migration:
-- 1. Aktualisiert bestehende Konten (gleiche Kontonummer -> Name/Beschreibung update)
-- 2. Fügt neue SKR03-Konten hinzu die noch nicht existieren
-- 3. Behält alle bestehenden Verknüpfungen (buchungskonto_id) bei

-- ============================================================
-- SCHRITT 1: Bestehende Konten aktualisieren
-- ============================================================

-- Erlöskonten aktualisieren
UPDATE buchungskonten SET
  name = 'Erlöse 19% USt',
  beschreibung = 'Umsatzerlöse zum allgemeinen Steuersatz',
  sortierung = 1
WHERE kontonummer = '8400' AND ist_standard = true;

UPDATE buchungskonten SET
  name = 'Erlöse 7% USt',
  beschreibung = 'Umsatzerlöse zum ermäßigten Steuersatz',
  sortierung = 2
WHERE kontonummer = '8300' AND ist_standard = true;

UPDATE buchungskonten SET
  name = 'Erlöse Kleinunternehmer §19',
  beschreibung = 'Steuerfreie Umsätze nach §19 UStG',
  sortierung = 3
WHERE kontonummer = '8195' AND ist_standard = true;

-- Aufwandskonten aktualisieren
UPDATE buchungskonten SET
  name = 'Miete/Raumkosten',
  beschreibung = 'Miete für Geschäftsräume, Tennisplätze, Hallen',
  sortierung = 10
WHERE kontonummer = '4210' AND ist_standard = true;

UPDATE buchungskonten SET
  name = 'Werbekosten',
  beschreibung = 'Werbung, Marketing, Flyer, Website',
  sortierung = 30
WHERE kontonummer = '4600' AND ist_standard = true;

UPDATE buchungskonten SET
  name = 'Bürobedarf',
  beschreibung = 'Büromaterial, Druckerkosten, Papier',
  sortierung = 70
WHERE kontonummer = '4930' AND ist_standard = true;

UPDATE buchungskonten SET
  name = 'Fortbildungskosten',
  beschreibung = 'Seminare, Lehrgänge, Lizenzen, Zertifikate',
  sortierung = 72
WHERE kontonummer = '4946' AND ist_standard = true;

UPDATE buchungskonten SET
  name = 'Fremdleistungen',
  beschreibung = 'Externe Dienstleistungen, Subunternehmer',
  sortierung = 50
WHERE kontonummer = '4780' AND ist_standard = true;

-- Altes GWG-Konto umbenennen (4980 -> Sonstige Aufwendungen)
UPDATE buchungskonten SET
  kontonummer = '4900',
  name = 'Sonstige Aufwendungen',
  beschreibung = 'Sonstige betriebliche Aufwendungen',
  sortierung = 90
WHERE kontonummer = '4980' AND ist_standard = true;

-- Privatkonten aktualisieren
UPDATE buchungskonten SET
  name = 'Privatentnahmen',
  beschreibung = 'Private Entnahmen aus dem Betriebsvermögen',
  sortierung = 100
WHERE kontonummer = '1800' AND ist_standard = true;

UPDATE buchungskonten SET
  name = 'Privateinlagen',
  beschreibung = 'Private Einlagen ins Betriebsvermögen',
  sortierung = 101
WHERE kontonummer = '1890' AND ist_standard = true;

-- ============================================================
-- SCHRITT 2: Neue SKR03-Konten für alle Benutzer hinzufügen
-- ============================================================

-- Funktion um neue Konten für alle Benutzer anzulegen
DO $$
DECLARE
  user_record RECORD;
BEGIN
  -- Für jeden Benutzer der bereits Buchungskonten hat
  FOR user_record IN
    SELECT DISTINCT user_id FROM buchungskonten
  LOOP
    -- Neue Erlöskonten
    INSERT INTO buchungskonten (user_id, kontonummer, name, typ, beschreibung, ist_standard, sortierung)
    VALUES
      (user_record.user_id, '8120', 'Steuerfreie Umsätze', 'einnahme', 'Sonstige steuerfreie Umsätze', true, 4),
      (user_record.user_id, '8900', 'Sonstige Erträge', 'einnahme', 'Sonstige betriebliche Erträge', true, 5)
    ON CONFLICT DO NOTHING;

    -- Nebenkosten
    INSERT INTO buchungskonten (user_id, kontonummer, name, typ, beschreibung, ist_standard, sortierung)
    VALUES
      (user_record.user_id, '4220', 'Nebenkosten', 'ausgabe', 'Nebenkosten des Geldverkehrs, Abgaben', true, 11)
    ON CONFLICT DO NOTHING;

    -- Kfz-Kosten
    INSERT INTO buchungskonten (user_id, kontonummer, name, typ, beschreibung, ist_standard, sortierung)
    VALUES
      (user_record.user_id, '4500', 'Kfz-Kosten', 'ausgabe', 'Pauschale Kfz-Kosten (Sammelkonto)', true, 20),
      (user_record.user_id, '4510', 'Kfz-Steuer', 'ausgabe', 'Kraftfahrzeugsteuer', true, 21),
      (user_record.user_id, '4520', 'Kfz laufende Kosten', 'ausgabe', 'Benzin, Reparaturen, Wartung, TÜV', true, 22),
      (user_record.user_id, '4530', 'Kfz-Leasing', 'ausgabe', 'Leasingraten für betriebliche Fahrzeuge', true, 23),
      (user_record.user_id, '4540', 'Kfz-Versicherung', 'ausgabe', 'Haftpflicht, Kasko für Kfz', true, 24)
    ON CONFLICT DO NOTHING;

    -- Werbung/Repräsentation
    INSERT INTO buchungskonten (user_id, kontonummer, name, typ, beschreibung, ist_standard, sortierung)
    VALUES
      (user_record.user_id, '4610', 'Geschenke abzugsfähig', 'ausgabe', 'Geschenke an Kunden (bis 35€)', true, 31),
      (user_record.user_id, '4630', 'Repräsentationskosten', 'ausgabe', 'Bewirtung, Kundenpflege (70% abzugsfähig)', true, 32)
    ON CONFLICT DO NOTHING;

    -- Reisekosten
    INSERT INTO buchungskonten (user_id, kontonummer, name, typ, beschreibung, ist_standard, sortierung)
    VALUES
      (user_record.user_id, '4653', 'Reisekosten Übernachtung', 'ausgabe', 'Hotelkosten bei Dienstreisen', true, 40),
      (user_record.user_id, '4654', 'Reisekosten Verpflegung', 'ausgabe', 'Verpflegungsmehraufwand', true, 41),
      (user_record.user_id, '4673', 'Fahrtkosten', 'ausgabe', 'Fahrtkosten (nicht Kfz), Kilometergeld', true, 42)
    ON CONFLICT DO NOTHING;

    -- Fremdleistungen/Aufträge
    INSERT INTO buchungskonten (user_id, kontonummer, name, typ, beschreibung, ist_standard, sortierung)
    VALUES
      (user_record.user_id, '4790', 'Auftragskosten', 'ausgabe', 'Sonstige Auftragskosten', true, 51)
    ON CONFLICT DO NOTHING;

    -- Wartung/Reparatur
    INSERT INTO buchungskonten (user_id, kontonummer, name, typ, beschreibung, ist_standard, sortierung)
    VALUES
      (user_record.user_id, '4805', 'Reparatur/Instandhaltung', 'ausgabe', 'Reparaturen, Wartung von Anlagen/Geräten', true, 55)
    ON CONFLICT DO NOTHING;

    -- Porto/Telefon/Bank
    INSERT INTO buchungskonten (user_id, kontonummer, name, typ, beschreibung, ist_standard, sortierung)
    VALUES
      (user_record.user_id, '4830', 'Porto/Versand', 'ausgabe', 'Portokosten, Paketversand', true, 60),
      (user_record.user_id, '4855', 'Bankgebühren', 'ausgabe', 'Kontoführung, Überweisungsgebühren', true, 61),
      (user_record.user_id, '4920', 'Telefon/Internet', 'ausgabe', 'Telefon, Mobilfunk, Internet', true, 62)
    ON CONFLICT DO NOTHING;

    -- Büro/Fortbildung/Beratung
    INSERT INTO buchungskonten (user_id, kontonummer, name, typ, beschreibung, ist_standard, sortierung)
    VALUES
      (user_record.user_id, '4940', 'Zeitschriften/Bücher', 'ausgabe', 'Fachliteratur, Fachzeitschriften', true, 71),
      (user_record.user_id, '4950', 'Rechts-/Beratungskosten', 'ausgabe', 'Steuerberater, Rechtsanwalt, Beratung', true, 73)
    ON CONFLICT DO NOTHING;

    -- Versicherungen/Beiträge
    INSERT INTO buchungskonten (user_id, kontonummer, name, typ, beschreibung, ist_standard, sortierung)
    VALUES
      (user_record.user_id, '4360', 'Versicherungen', 'ausgabe', 'Betriebliche Versicherungen, Haftpflicht', true, 80),
      (user_record.user_id, '4380', 'Beiträge/Gebühren', 'ausgabe', 'Verbandsbeiträge, Mitgliedschaften, Gebühren', true, 81)
    ON CONFLICT DO NOTHING;

    -- Abschreibungen
    INSERT INTO buchungskonten (user_id, kontonummer, name, typ, beschreibung, ist_standard, sortierung)
    VALUES
      (user_record.user_id, '4822', 'Abschreibungen Sachanlagen', 'ausgabe', 'AfA auf Sachanlagen', true, 85),
      (user_record.user_id, '4824', 'Sofortabschreibung GWG', 'ausgabe', 'Geringwertige Wirtschaftsgüter (bis 800€ netto)', true, 86)
    ON CONFLICT DO NOTHING;

    -- Material/Betriebsbedarf
    INSERT INTO buchungskonten (user_id, kontonummer, name, typ, beschreibung, ist_standard, sortierung)
    VALUES
      (user_record.user_id, '4560', 'Betriebsbedarf/Material', 'ausgabe', 'Verbrauchsmaterial, Tennisbälle, Trainingsgeräte', true, 91)
    ON CONFLICT DO NOTHING;

    -- Durchlaufende Posten
    INSERT INTO buchungskonten (user_id, kontonummer, name, typ, beschreibung, ist_standard, sortierung)
    VALUES
      (user_record.user_id, '1370', 'Durchlaufende Posten', 'neutral', 'Durchlaufende Posten (keine Auswirkung auf Gewinn)', true, 102)
    ON CONFLICT DO NOTHING;

  END LOOP;
END $$;

-- ============================================================
-- SCHRITT 3: Unique Constraint hinzufügen falls nicht vorhanden
-- ============================================================

-- Unique Constraint auf user_id + kontonummer (falls noch nicht vorhanden)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'buchungskonten_user_kontonummer_unique'
  ) THEN
    ALTER TABLE buchungskonten
    ADD CONSTRAINT buchungskonten_user_kontonummer_unique
    UNIQUE (user_id, kontonummer);
  END IF;
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- Fertig! Die SKR03-Kontierung wurde aktualisiert.
-- ============================================================
