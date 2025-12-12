import "https://deno.land/x/xhr@0.3.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PLATZHALTER_INFO = `
Verfügbare Platzhalter für die PDF-Vorlage:
- {{spieler_name}} - Name des Spielers/Kunden
- {{rechnungsnummer}} - Eindeutige Rechnungsnummer
- {{rechnungsdatum}} - Datum der Rechnung
- {{monat}} - Abrechnungsmonat (z.B. "Dezember 2024")
- {{positionen_tabelle}} - WICHTIG: Automatisch generierte HTML-Tabelle mit allen Trainingspositionen
- {{netto}} - Nettobetrag
- {{ust}} - Umsatzsteuer-Betrag
- {{brutto}} - Gesamtbetrag (Brutto)
- {{iban}} - IBAN des Trainers
- {{trainer_name}} - Name des Trainers
- {{trainer_adresse_html}} - Adresse des Trainers als HTML (mit <br> für Zeilenumbrüche)
- {{steuernummer}} - Steuernummer des Trainers
- {{empfaenger_name}} - Name des Rechnungsempfängers
- {{empfaenger_adresse_html}} - Adresse des Empfängers als HTML
- {{kleinunternehmer_hinweis}} - Automatischer Hinweis bei Kleinunternehmer-Status
- {{ust_zeile}} - USt-Zeile (leer bei Kleinunternehmer)
- {{summen_block}} - WICHTIG: Automatisch generierter HTML-Block mit Netto/USt/Brutto

WICHTIG: Die Platzhalter {{positionen_tabelle}} und {{summen_block}} müssen verwendet werden - sie werden automatisch mit den echten Rechnungsdaten befüllt.
`

const DEFAULT_VORLAGE = `<h1>RECHNUNG</h1>

<div class="flex">
  <div class="section">
    <strong>Rechnungssteller:</strong><br>
    {{trainer_name}}<br>
    {{trainer_adresse_html}}<br>
    Steuernummer: {{steuernummer}}
  </div>
  <div class="section" style="text-align: right;">
    <strong>Rechnungsempfänger:</strong><br>
    {{empfaenger_name}}<br>
    {{empfaenger_adresse_html}}
  </div>
</div>

<div class="section">
  <strong>Rechnungsnummer:</strong> {{rechnungsnummer}}<br>
  <strong>Rechnungsdatum:</strong> {{rechnungsdatum}}<br>
  <strong>Leistungszeitraum:</strong> {{monat}}
</div>

<p>Sehr geehrte Damen und Herren,</p>
<p>für die im Leistungszeitraum erbrachten Trainerstunden erlaube ich mir, folgende Rechnung zu stellen:</p>

{{positionen_tabelle}}

{{summen_block}}

{{kleinunternehmer_hinweis}}

<div class="footer">
  <p>Bitte überweisen Sie den Betrag innerhalb von 14 Tagen auf folgendes Konto:</p>
  <p><strong>IBAN:</strong> {{iban}}<br>
  <strong>Kontoinhaber:</strong> {{trainer_name}}</p>
  <p>Vielen Dank für die Zusammenarbeit.</p>
  <p>Mit freundlichen Grüßen<br>{{trainer_name}}</p>
</div>`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured')
    }

    const { prompt, currentVorlage } = await req.json()

    if (!prompt) {
      throw new Error('prompt is required')
    }

    const systemPrompt = `Du bist ein Experte für die Erstellung von HTML-Rechnungsvorlagen für einen Tennistrainer.

${PLATZHALTER_INFO}

CSS-Klassen die du verwenden kannst:
- .flex - Flexbox Container für zwei Spalten
- .section - Abschnitt mit Margin
- .footer - Fußbereich
- Inline-Styles sind auch erlaubt

Regeln:
1. Gib NUR den HTML-Code zurück, ohne Erklärungen oder Markdown-Codeblöcke
2. Verwende IMMER {{positionen_tabelle}} für die Trainings-Tabelle
3. Verwende IMMER {{summen_block}} für die Summen
4. Halte das Design professionell und übersichtlich
5. Die Vorlage wird in ein PDF konvertiert, also keine JavaScript oder komplexe CSS

Hier ist die Standard-Vorlage als Referenz:
${DEFAULT_VORLAGE}
`

    const userPrompt = currentVorlage
      ? `Aktuelle Vorlage:\n${currentVorlage}\n\nAnfrage des Benutzers: ${prompt}`
      : `Anfrage des Benutzers: ${prompt}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Claude API error:', errorText)
      throw new Error(`Claude API error: ${response.status}`)
    }

    const result = await response.json()
    let htmlContent = result.content.find((c: any) => c.type === 'text')?.text

    if (!htmlContent) {
      throw new Error('No response from Claude')
    }

    // Entferne eventuelle Markdown-Codeblöcke
    htmlContent = htmlContent.trim()
    if (htmlContent.startsWith('```html')) {
      htmlContent = htmlContent.slice(7)
    }
    if (htmlContent.startsWith('```')) {
      htmlContent = htmlContent.slice(3)
    }
    if (htmlContent.endsWith('```')) {
      htmlContent = htmlContent.slice(0, -3)
    }
    htmlContent = htmlContent.trim()

    return new Response(
      JSON.stringify({ success: true, html: htmlContent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
