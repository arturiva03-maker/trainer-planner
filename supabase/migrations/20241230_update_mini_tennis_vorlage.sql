-- Mini-Tennis Vorlage auf Standard-Design aktualisieren
UPDATE pdf_vorlagen
SET inhalt = '<!-- Header mit farbigem Balken -->
<div style="background: #8B7D76; margin: -24px -24px 24px -24px; padding: 24px;">
  <h1 style="text-align: center; margin: 0; font-size: 28px; color: white; font-weight: 700; letter-spacing: 2px;">RECHNUNG</h1>
</div>

<!-- Adressbereich -->
<div style="display: flex; justify-content: space-between; margin-bottom: 24px; gap: 20px;">
  <div style="flex: 1; background: #FAF8F5; padding: 16px; border-left: 3px solid #4A4543;">
    <div style="font-size: 10px; text-transform: uppercase; color: #6B635E; font-weight: 600; margin-bottom: 8px;">Rechnungssteller</div>
    <div style="font-weight: 600; color: #2D2926;">{{trainer_name}}</div>
    <div style="color: #4A4543; font-size: 11px; margin-top: 4px;">{{trainer_adresse_html}}</div>
    {{#if trainer_steuernummer}}<div style="color: #6B635E; font-size: 10px; margin-top: 8px;">Steuernummer: {{trainer_steuernummer}}</div>{{/if}}
  </div>
  <div style="flex: 1; background: #FAF8F5; padding: 16px; border-left: 3px solid #6B635E;">
    <div style="font-size: 10px; text-transform: uppercase; color: #6B635E; font-weight: 600; margin-bottom: 8px;">Rechnungsempfänger</div>
    <div style="font-weight: 600; color: #2D2926;">{{empfaenger_name}}</div>
    <div style="color: #4A4543; font-size: 11px; margin-top: 4px;">{{empfaenger_adresse_html}}</div>
  </div>
</div>

<!-- Rechnungsdetails - 3 separate Boxen -->
<div style="display: flex; gap: 12px; margin-bottom: 24px;">
  <div style="flex: 1; background: #FAF8F5; padding: 12px 16px; text-align: center; border: 1px solid #E8E4DF;">
    <div style="font-size: 10px; text-transform: uppercase; color: #6B635E; font-weight: 600;">Rechnungsnummer</div>
    <div style="font-size: 14px; font-weight: 700; color: #2D2926; margin-top: 4px;">{{rechnungsnummer}}</div>
  </div>
  <div style="flex: 1; background: #FAF8F5; padding: 12px 16px; text-align: center; border: 1px solid #E8E4DF;">
    <div style="font-size: 10px; text-transform: uppercase; color: #6B635E; font-weight: 600;">Rechnungsdatum</div>
    <div style="font-size: 14px; font-weight: 700; color: #2D2926; margin-top: 4px;">{{rechnungsdatum}}</div>
  </div>
  <div style="flex: 1; background: #FAF8F5; padding: 12px 16px; text-align: center; border: 1px solid #E8E4DF;">
    <div style="font-size: 10px; text-transform: uppercase; color: #6B635E; font-weight: 600;">Leistungszeitraum</div>
    <div style="font-size: 14px; font-weight: 700; color: #2D2926; margin-top: 4px;">{{monat}}</div>
  </div>
</div>

<!-- Anrede -->
<p style="color: #4A4543; margin-bottom: 8px;">Sehr geehrte Damen und Herren,</p>
<p style="color: #4A4543; margin-bottom: 20px;">anbei erhalten Sie die Abrechnung für das Mini-Tennis:</p>

<!-- Positionen -->
{{positionen_tabelle_klassisch}}

<!-- Summen -->
{{summen_block_klassisch}}

{{kleinunternehmer_hinweis}}

<!-- SEPA Zahlungsinfo -->
<div style="margin-top: 32px; background: #FAF8F5; padding: 20px; border: 1px solid #E8E4DF; border-left: 3px solid #4A4543;">
  <div style="font-weight: 600; color: #2D2926; margin-bottom: 12px;">Zahlungsinformationen</div>
  <p style="margin: 0 0 12px 0; color: #4A4543; font-size: 12px;">Der Betrag wird mittels SEPA-Lastschrift von Ihrem Konto abgebucht.</p>
  <div style="display: flex; gap: 24px; color: #4A4543; font-size: 12px;">
    <div>
      <span style="font-weight: 600; color: #2D2926;">IBAN:</span> <span style="font-family: monospace;">{{spieler_iban}}</span><br>
      <span style="font-weight: 600; color: #2D2926;">Mandatsreferenz:</span> {{spieler_mandatsreferenz}}<br>
      <span style="font-weight: 600; color: #2D2926;">Mandatsdatum:</span> {{spieler_unterschriftsdatum}}
    </div>
  </div>
</div>

<!-- Abschluss -->
<div style="margin-top: 32px; color: #4A4543;">
  <p>Vielen Dank für Ihr Vertrauen!</p>
  <p style="margin-top: 24px;">Mit freundlichen Grüßen<br><strong style="color: #2D2926;">{{trainer_name}}</strong></p>
</div>'
WHERE name ILIKE '%mini%tennis%' OR name ILIKE '%mini-tennis%';
