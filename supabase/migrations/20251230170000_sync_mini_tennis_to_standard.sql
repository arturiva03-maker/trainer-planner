-- Mini-Tennis Vorlage mit Standard-Design aktualisieren
-- Setzt das gleiche professionelle Design wie die Standard-Rechnung

UPDATE pdf_vorlagen
SET inhalt = '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #374151;
      padding: 40px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #14B8A6;
    }
    .header-left h1 {
      font-size: 24pt;
      color: #134E4A;
      margin-bottom: 5px;
    }
    .header-left p {
      color: #6B7280;
      font-size: 10pt;
    }
    .header-right {
      text-align: right;
    }
    .rechnungs-info {
      background: #F7FAFA;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 25px;
    }
    .rechnungs-info table {
      width: 100%;
    }
    .rechnungs-info td {
      padding: 3px 0;
    }
    .rechnungs-info td:first-child {
      color: #6B7280;
      width: 150px;
    }
    .adressen {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    .adresse {
      width: 48%;
    }
    .adresse-label {
      font-size: 9pt;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .adresse-content {
      font-size: 10pt;
    }
    .positionen-tabelle {
      width: 100%;
      border-collapse: collapse;
      margin: 25px 0;
    }
    .positionen-tabelle th {
      background: #14B8A6;
      color: white;
      padding: 12px 15px;
      text-align: left;
      font-weight: 600;
      font-size: 10pt;
    }
    .positionen-tabelle th:first-child {
      border-radius: 8px 0 0 0;
    }
    .positionen-tabelle th:last-child {
      border-radius: 0 8px 0 0;
      text-align: right;
    }
    .positionen-tabelle td {
      padding: 12px 15px;
      border-bottom: 1px solid #E5E7EB;
      font-size: 10pt;
    }
    .positionen-tabelle td:last-child {
      text-align: right;
    }
    .positionen-tabelle tr:last-child td {
      border-bottom: none;
    }
    .positionen-tabelle tr:nth-child(even) {
      background: #F9FAFB;
    }
    .summen {
      margin-left: auto;
      width: 300px;
      margin-top: 20px;
    }
    .summen-zeile {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #E5E7EB;
    }
    .summen-zeile.gesamt {
      font-weight: bold;
      font-size: 12pt;
      color: #134E4A;
      border-bottom: 2px solid #14B8A6;
      border-top: 2px solid #14B8A6;
      margin-top: 10px;
      padding: 12px 0;
    }
    .hinweis {
      margin-top: 25px;
      padding: 15px;
      background: #F0FDFA;
      border-left: 4px solid #14B8A6;
      border-radius: 0 8px 8px 0;
      font-size: 9pt;
      color: #374151;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
    }
    .bankdaten {
      background: #F7FAFA;
      padding: 15px;
      border-radius: 8px;
      margin: 15px 0;
    }
    .bankdaten-titel {
      font-weight: 600;
      color: #134E4A;
      margin-bottom: 8px;
    }
    .gruss {
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>RECHNUNG</h1>
      <p>Mini-Tennis Abrechnung</p>
    </div>
    <div class="header-right">
      {{trainer_name}}<br>
      {{trainer_adresse_html}}
    </div>
  </div>

  <div class="rechnungs-info">
    <table>
      <tr>
        <td>Rechnungsnummer:</td>
        <td><strong>{{rechnungsnummer}}</strong></td>
      </tr>
      <tr>
        <td>Rechnungsdatum:</td>
        <td>{{rechnungsdatum}}</td>
      </tr>
      <tr>
        <td>Leistungszeitraum:</td>
        <td>{{monat}}</td>
      </tr>
    </table>
  </div>

  <div class="adressen">
    <div class="adresse">
      <div class="adresse-label">Rechnungssteller</div>
      <div class="adresse-content">
        {{trainer_name}}<br>
        {{trainer_adresse_html}}<br>
        {{trainer_steuernummer_block}}
      </div>
    </div>
    <div class="adresse">
      <div class="adresse-label">Rechnungsempfänger</div>
      <div class="adresse-content">
        {{empfaenger_name}}<br>
        {{empfaenger_adresse_html}}
      </div>
    </div>
  </div>

  <p style="margin-bottom: 20px;">Sehr geehrte Damen und Herren,</p>
  <p style="margin-bottom: 20px;">für die im Leistungszeitraum erbrachten Trainerstunden erlaube ich mir, folgende Rechnung zu stellen:</p>

  {{positionen_tabelle}}

  {{summen_block}}

  {{kleinunternehmer_hinweis}}

  <div class="footer">
    <div class="bankdaten">
      <div class="bankdaten-titel">Zahlungsinformationen</div>
      Bitte überweisen Sie den Betrag innerhalb von 14 Tagen auf folgendes Konto:<br>
      <strong>IBAN:</strong> {{iban}}<br>
      <strong>Kontoinhaber:</strong> {{trainer_name}}
    </div>

    <div class="gruss">
      <p>Vielen Dank für Ihr Vertrauen.</p>
      <p style="margin-top: 20px;">Mit freundlichen Grüßen<br><strong>{{trainer_name}}</strong></p>
    </div>
  </div>
</body>
</html>'
WHERE name ILIKE '%mini%tennis%' OR name ILIKE '%mini-tennis%' OR name = 'Mini-Tennis';
