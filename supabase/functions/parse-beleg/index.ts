import "https://deno.land/x/xhr@0.3.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BelegData {
  datum: string | null
  betrag: number | null
  beschreibung: string | null
  kategorie: 'platzmiete' | 'material' | 'fahrtkosten' | 'fortbildung' | 'tennistraining' | 'sonstiges' | null
  hatVorsteuer: boolean
  vorsteuerSatz: number | null
  haendler: string | null
  rechnungsnummer: string | null
  rechnungsdatum: string | null
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured')
    }

    const { imageBase64, mimeType } = await req.json()

    if (!imageBase64 || !mimeType) {
      throw new Error('imageBase64 and mimeType are required')
    }

    // Bestimme ob es ein PDF oder Bild ist
    const isPdf = mimeType === 'application/pdf'

    // Content-Block erstellen (unterschiedlich für PDF vs Bild)
    const mediaContent = isPdf
      ? {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: imageBase64
          }
        }
      : {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType,
            data: imageBase64
          }
        }

    // Claude API aufrufen mit Vision/Document
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              mediaContent,
              {
                type: 'text',
                text: `Analysiere diesen Beleg/Quittung/Rechnung und extrahiere die folgenden Informationen.
Antworte NUR mit einem validen JSON-Objekt (ohne Markdown-Codeblöcke), ohne zusätzlichen Text.

Das JSON soll folgende Felder haben:
- datum: Das Datum im Format YYYY-MM-DD (oder null wenn nicht lesbar)
- betrag: Der Gesamtbetrag als Zahl (Brutto-Betrag inkl. MwSt, oder null wenn nicht lesbar)
- beschreibung: Eine kurze Beschreibung was gekauft wurde (max 100 Zeichen)
- kategorie: Eine der folgenden Kategorien die am besten passt: "platzmiete", "material", "fahrtkosten", "fortbildung", "tennistraining", "sonstiges"
  - "platzmiete" = Tennisplatz-Miete, Hallenmiete, Courtbuchung
  - "material" = Tennisbälle, Schläger, Netze, Trainingsgeräte, Sportartikel
  - "fahrtkosten" = Tankquittungen, Parktickets, Bahntickets, Maut
  - "fortbildung" = Kurse, Seminare, Trainerlizenzen, Fachliteratur
  - "tennistraining" = Tennisunterricht, Trainerstunden, Coaching-Gebühren
  - "sonstiges" = Alles andere
- hatVorsteuer: true wenn MwSt/USt ausgewiesen ist, sonst false
- vorsteuerSatz: Der MwSt-Satz als Zahl (7 oder 19), oder null wenn keine MwSt
- haendler: Name des Händlers/Geschäfts (oder null wenn nicht lesbar)
- rechnungsnummer: Die Rechnungsnummer/Belegnummer (oder null wenn nicht vorhanden)
- rechnungsdatum: Das Rechnungsdatum im Format YYYY-MM-DD (oder null wenn nicht vorhanden, oft identisch mit datum)

Beispiel-Antwort:
{"datum":"2024-12-10","betrag":49.99,"beschreibung":"Tennisbälle Wilson","kategorie":"material","hatVorsteuer":true,"vorsteuerSatz":19,"haendler":"Decathlon","rechnungsnummer":"RE-2024-12345","rechnungsdatum":"2024-12-10"}`
              }
            ]
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
    const textContent = result.content.find((c: any) => c.type === 'text')?.text

    if (!textContent) {
      throw new Error('No text response from Claude')
    }

    // JSON parsen (Claude könnte Markdown-Codeblöcke zurückgeben)
    let jsonStr = textContent.trim()
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7)
    }
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3)
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3)
    }
    jsonStr = jsonStr.trim()

    const belegData: BelegData = JSON.parse(jsonStr)

    return new Response(
      JSON.stringify({ success: true, data: belegData }),
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
