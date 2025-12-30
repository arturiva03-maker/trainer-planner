-- Update alle PDF-Vorlagen: Ersetze alte Farben durch Petrol

-- Terrakotta Hauptfarbe -> Petrol
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#C75B38', '#1A7F7F');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#A84C2E', '#135C5C');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#8B7D76', '#1A7F7F');

-- Alte Hintergrundfarben -> Neue Petrol-getönte
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#FAF8F5', '#F7FAFA');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#F5E6E0', '#E6F2F2');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#E8E4DF', '#D4DEDE');

-- Alte Grautöne -> Neue Petrol-getönte Grautöne
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#6B635E', '#5F7272');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#4A4543', '#3D4F4F');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#2D2926', '#1A2F2F');
