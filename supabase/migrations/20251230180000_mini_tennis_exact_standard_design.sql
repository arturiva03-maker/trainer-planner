-- Mini-Tennis Vorlage mit EXAKT gleichem Design wie Standard-Rechnung

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
      line-height: 1.6;
      color: #134E4A;
      padding: 0;
    }
    .header-banner {
      background: #14B8A6;
      padding: 40px;
      text-align: center;
      margin-bottom: 30px;
    }
    .header-banner h1 {
      color: white;
      font-size: 32pt;
      font-weight: 600;
      letter-spacing: 3px;
    }
    .content {
      padding: 0 40px 40px;
    }
    .adressen-container {
      display: flex;
      gap: 20px;
      margin-bottom: 25px;
    }
    .adresse-box {
      flex: 1;
      border: 1px solid #D1D5DB;
      border-radius: 8px;
      padding: 20px;
    }
    .adresse-label {
      font-size: 9pt;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
      font-weight: 600;
    }
    .adresse-content {
      font-size: 11pt;
      color: #134E4A;
    }
    .info-container {
      display: flex;
      gap: 15px;
      margin-bottom: 30px;
    }
    .info-box {
      flex: 1;
      border: 1px solid #D1D5DB;
      border-radius: 8px;
      padding: 15px;
      text-align: center;
    }
    .info-label {
      font-size: 8pt;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }
    .info-value {
      font-size: 12pt;
      font-weight: 600;
      color: #134E4A;
    }
    .anrede {
      margin-bottom: 25px;
      font-size: 11pt;
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
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .positionen-tabelle th:nth-child(5),
    .positionen-tabelle th:nth-child(6),
    .positionen-tabelle th:nth-child(7) {
      text-align: right;
    }
    .positionen-tabelle td {
      padding: 12px 15px;
      border-bottom: 1px solid #E5E7EB;
      font-size: 10pt;
    }
    .positionen-tabelle td:nth-child(5),
    .positionen-tabelle td:nth-child(6),
    .positionen-tabelle td:nth-child(7) {
      text-align: right;
    }
    .summen-box {
      background: #F7FAFA;
      border-radius: 8px;
      padding: 20px;
      margin: 25px 0;
    }
    .summen-zeile {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 11pt;
    }
    .summen-zeile.gesamt {
      font-weight: bold;
      font-size: 14pt;
      color: #14B8A6;
      border-top: 2px solid #14B8A6;
      margin-top: 10px;
      padding-top: 15px;
    }
    .hinweis {
      margin: 25px 0;
      padding: 15px;
      background: #F0FDFA;
      border-left: 4px solid #14B8A6;
      border-radius: 0 8px 8px 0;
      font-size: 10pt;
      color: #374151;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
    }
    .bankdaten {
      background: #F7FAFA;
      padding: 20px;
      border-radius: 8px;
      margin: 15px 0;
    }
    .bankdaten-titel {
      font-weight: 600;
      color: #134E4A;
      margin-bottom: 10px;
      font-size: 11pt;
    }
    .gruss {
      margin-top: 30px;
      font-size: 11pt;
    }
  </style>
</head>
<body>
  <div class="header-banner">
    <h1>RECHNUNG</h1>
  </div>

  <div class="content">
    <div class="adressen-container">
      <div class="adresse-box">
        <div class="adresse-label">Rechnungssteller</div>
        <div class="adresse-content">
          {{trainer_name}}<br>
          {{trainer_adresse_html}}<br>
          Steuernummer: {{steuernummer}}
        </div>
      </div>
      <div class="adresse-box">
        <div class="adresse-label">Rechnungsempfänger</div>
        <div class="adresse-content">
          {{empfaenger_name}}<br>
          {{empfaenger_adresse_html}}
        </div>
      </div>
    </div>

    <div class="info-container">
      <div class="info-box">
        <div class="info-label">Rechnungsnummer</div>
        <div class="info-value">{{rechnungsnummer}}</div>
      </div>
      <div class="info-box">
        <div class="info-label">Rechnungsdatum</div>
        <div class="info-value">{{rechnungsdatum}}</div>
      </div>
      <div class="info-box">
        <div class="info-label">Leistungszeitraum</div>
        <div class="info-value">{{monat}}</div>
      </div>
    </div>

    <div class="anrede">
      <p>Sehr geehrte Damen und Herren,</p>
      <p style="margin-top: 10px;">für die im Leistungszeitraum erbrachten Trainerstunden erlaube ich mir, folgende Rechnung zu stellen:</p>
    </div>

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
  </div>
</body>
</html>'
WHERE name ILIKE '%mini%tennis%' OR name ILIKE '%mini-tennis%' OR name = 'Mini-Tennis';
