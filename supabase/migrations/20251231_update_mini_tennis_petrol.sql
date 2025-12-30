-- Update Mini-Tennis Vorlage auf Petrol-Farbschema
UPDATE pdf_vorlagen
SET inhalt = '<!-- Header mit farbigem Balken -->
<div style="background: #1A7F7F; margin: -24px -24px 24px -24px; padding: 24px;">
  <h1 style="text-align: center; margin: 0; font-size: 28px; color: white; font-weight: 700; letter-spacing: 2px;">RECHNUNG</h1>
</div>

<!-- Adressbereich -->
<div style="display: flex; justify-content: space-between; margin-bottom: 24px; gap: 20px;">
  <div style="flex: 1; background: #F7FAFA; padding: 16px; border-left: 3px solid #3D4F4F;">
    <div style="font-size: 10px; text-transform: uppercase; color: #5F7272; font-weight: 600; margin-bottom: 8px;">Rechnungssteller</div>
    <div style="font-weight: 600; color: #1A2F2F;">{{trainer_name}}</div>
    <div style="color: #3D4F4F; font-size: 11px; margin-top: 4px;">{{trainer_adresse_html}}</div>
  </div>
  <div style="flex: 1; background: #F7FAFA; padding: 16px; border-left: 3px solid #5F7272;">
    <div style="font-size: 10px; text-transform: uppercase; color: #5F7272; font-weight: 600; margin-bottom: 8px;">Rechnungsempfänger</div>
    <div style="font-weight: 600; color: #1A2F2F;">{{empfaenger_name}}</div>
    <div style="color: #3D4F4F; font-size: 11px; margin-top: 4px;">{{empfaenger_adresse_html}}</div>
  </div>
</div>

<!-- Rechnungsdetails - 3 separate Boxen -->
<div style="display: flex; gap: 12px; margin-bottom: 24px;">
  <div style="flex: 1; background: #F7FAFA; padding: 12px 16px; text-align: center; border: 1px solid #D4DEDE;">
    <div style="font-size: 10px; text-transform: uppercase; color: #5F7272; font-weight: 600;">Rechnungsnummer</div>
    <div style="font-size: 14px; font-weight: 700; color: #1A2F2F; margin-top: 4px;">{{rechnungsnummer}}</div>
  </div>
  <div style="flex: 1; background: #F7FAFA; padding: 12px 16px; text-align: center; border: 1px solid #D4DEDE;">
    <div style="font-size: 10px; text-transform: uppercase; color: #5F7272; font-weight: 600;">Rechnungsdatum</div>
    <div style="font-size: 14px; font-weight: 700; color: #1A2F2F; margin-top: 4px;">{{rechnungsdatum}}</div>
  </div>
  <div style="flex: 1; background: #F7FAFA; padding: 12px 16px; text-align: center; border: 1px solid #D4DEDE;">
    <div style="font-size: 10px; text-transform: uppercase; color: #5F7272; font-weight: 600;">Leistungszeitraum</div>
    <div style="font-size: 14px; font-weight: 700; color: #1A2F2F; margin-top: 4px;">{{monat}}</div>
  </div>
</div>

<!-- Anrede -->
<p style="color: #3D4F4F; margin-bottom: 8px;">Sehr geehrte Damen und Herren,</p>
<p style="color: #3D4F4F; margin-bottom: 20px;">anbei erhalten Sie die Abrechnung für das Mini-Tennis:</p>

<!-- Positionen -->
{{positionen_tabelle_klassisch}}

<!-- Summen -->
{{summen_block_klassisch}}

{{kleinunternehmer_hinweis}}

<!-- SEPA Zahlungsinfo -->
<div style="margin-top: 32px; background: #F7FAFA; padding: 20px; border: 1px solid #D4DEDE; border-left: 3px solid #3D4F4F;">
  <div style="font-weight: 600; color: #1A2F2F; margin-bottom: 12px;">Zahlungsinformationen</div>
  <p style="margin: 0 0 12px 0; color: #3D4F4F; font-size: 12px;">Der Betrag wird mittels SEPA-Lastschrift von Ihrem Konto abgebucht.</p>
  <div style="display: flex; gap: 24px; color: #3D4F4F; font-size: 12px;">
    <div>
      <span style="font-weight: 600; color: #1A2F2F;">IBAN:</span> <span style="font-family: monospace;">{{spieler_iban}}</span><br>
      <span style="font-weight: 600; color: #1A2F2F;">Mandatsreferenz:</span> {{spieler_mandatsreferenz}}<br>
      <span style="font-weight: 600; color: #1A2F2F;">Mandatsdatum:</span> {{spieler_unterschriftsdatum}}
    </div>
  </div>
</div>

<!-- Abschluss -->
<div style="margin-top: 32px; color: #3D4F4F;">
  <p>Vielen Dank für Ihr Vertrauen!</p>
  <p style="margin-top: 24px;">Mit freundlichen Grüßen<br><strong style="color: #1A2F2F;">{{trainer_name}}</strong></p>
</div>'
WHERE name = 'Mini-Tennis Vorlage';
