-- Update alle PDF-Vorlagen: Ersetze alte Petrol-Farben durch neue Teal-Farben

-- Petrol Hauptfarbe -> Teal
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#1A7F7F', '#14B8A6');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#135C5C', '#0D9488');

-- Petrol Dunkel -> Teal Dunkel
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#1A2F2F', '#134E4A');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#3D4F4F', '#374151');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#5F7272', '#6B7280');

-- Petrol Hintergrund/Borders -> Neutral
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#D4DEDE', '#D1D5DB');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#E6F2F2', '#CCFBF1');

-- Alte Terrakotta-Farben (falls noch vorhanden) -> Teal
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#C75B38', '#14B8A6');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#A84C2E', '#0D9488');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#8B7D76', '#14B8A6');
