-- Bestehende Konten löschen und mit SKR 03 Konten ersetzen

-- Erst alle Konto-Zuordnungen bei Transaktionen entfernen
UPDATE bank_transactions SET buchungskonto_id = NULL;
UPDATE ausgaben SET buchungskonto_id = NULL;

-- Alle bestehenden Konten löschen
DELETE FROM buchungskonten;

-- Neue SKR 03 Konten für alle User einfügen
INSERT INTO buchungskonten (user_id, kontonummer, name, typ, beschreibung, ist_standard, sortierung)
SELECT
  u.id as user_id,
  k.kontonummer,
  k.name,
  k.typ,
  k.beschreibung,
  true as ist_standard,
  k.sortierung
FROM auth.users u
CROSS JOIN (
  VALUES
    ('8400', 'Erlöse 19% USt', 'einnahme', 'Einnahmen aus Trainertätigkeit', 1),
    ('8300', 'Erlöse 7% USt', 'einnahme', 'Einnahmen mit ermäßigtem Steuersatz', 2),
    ('8195', 'Erlöse Kleinunternehmer', 'einnahme', 'Einnahmen ohne USt (§19 UStG)', 3),
    ('4210', 'Platzmiete/Raumkosten', 'ausgabe', 'Miete für Tennisplätze, Hallen', 10),
    ('4600', 'Werbekosten', 'ausgabe', 'Werbung, Marketing, Flyer', 11),
    ('4930', 'Bürobedarf', 'ausgabe', 'Büromaterial, Druckerkosten', 12),
    ('4946', 'Fortbildungskosten', 'ausgabe', 'Trainerlehrgänge, Lizenzen', 13),
    ('4980', 'GWG/Sonstige Ausgaben', 'ausgabe', 'Geringwertige Wirtschaftsgüter, sonstige Aufwendungen', 14),
    ('1800', 'Privatentnahmen', 'neutral', 'Private Entnahmen aus dem Betriebsvermögen', 20),
    ('1890', 'Privateinlagen', 'neutral', 'Private Einlagen ins Betriebsvermögen', 21)
) AS k(kontonummer, name, typ, beschreibung, sortierung);
