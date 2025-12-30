-- Entferne ALLE braunen/terrakotta Farben aus PDF-Vorlagen

-- Terrakotta/Braun Hauptfarben -> Teal
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#C75B38', '#14B8A6');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#c75b38', '#14B8A6');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#A84C2E', '#0D9488');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#a84c2e', '#0D9488');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#D67A5B', '#14B8A6');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#d67a5b', '#14B8A6');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#B54A2A', '#0D9488');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#b54a2a', '#0D9488');

-- Braune Grautöne -> Neutrale Grautöne
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#8B7D76', '#6B7280');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#8b7d76', '#6B7280');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#6B635E', '#6B7280');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#6b635e', '#6B7280');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#4A4543', '#374151');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#4a4543', '#374151');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#2D2926', '#134E4A');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#2d2926', '#134E4A');

-- Braune Hintergrundfarben -> Neutrale
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#FAF8F5', '#F7FAFA');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#faf8f5', '#F7FAFA');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#F5E6E0', '#CCFBF1');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#f5e6e0', '#CCFBF1');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#E8E4DF', '#E5E7EB');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#e8e4df', '#E5E7EB');

-- Weitere mögliche braune Töne
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#9B8579', '#6B7280');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#7D6E65', '#6B7280');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#5C524A', '#374151');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#3D3632', '#134E4A');

-- RGB Varianten von Terrakotta
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, 'rgb(199, 91, 56)', '#14B8A6');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, 'rgb(168, 76, 46)', '#0D9488');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, 'rgb(139, 125, 118)', '#6B7280');

-- Stellt sicher dass alte Petrol auch ersetzt wird
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#1A7F7F', '#14B8A6');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#135C5C', '#0D9488');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#1A2F2F', '#134E4A');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#3D4F4F', '#374151');
UPDATE pdf_vorlagen SET inhalt = REPLACE(inhalt, '#5F7272', '#6B7280');
