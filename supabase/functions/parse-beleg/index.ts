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
  kategorie: 'platzmiete' | 'fortbildung' | 'buero' | 'werbung' | 'anschaffungen' | 'sonstiges' | null
  hatVorsteuer: boolean
  vorsteuerSatz: number | null
  haendler: string | null
  rechnungsnummer: string | null
  rechnungsdatum: string | null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')
    if (!GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY not configured')
    }

    const { imageBase64, mimeType } = await req.json()

    if (!imageBase64 || !mimeType) {
      throw new Error('imageBase64 and mimeType are required')
    }

    const isPdf = mimeType === 'application/pdf'

    // Google Gemini API aufrufen
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: isPdf ? 'application/pdf' : mimeType,
                data: imageBase64
              }
            },
            {
              text: `Analysiere diesen Beleg/Quittung/Rechnung und extrahiere die folgenden Informationen.
Antworte NUR mit einem validen JSON-Objekt (ohne Markdown-Codeblöcke), ohne zusätzlichen Text.

Das JSON soll folgende Felder haben:
- datum: Das Datum im Format YYYY-MM-DD (oder null wenn nicht lesbar)
- betrag: Der Gesamtbetrag als Zahl (Brutto-Betrag inkl. MwSt, oder null wenn nicht lesbar)
- beschreibung: Eine kurze Beschreibung was gekauft wurde (max 100 Zeichen)
- kategorie: Eine der folgenden Kategorien die am besten passt: "platzmiete", "fortbildung", "buero", "werbung", "anschaffungen", "sonstiges"
  - "platzmiete" = Tennisplatz-Miete, Hallenmiete, Raummiete, Courtbuchung
  - "fortbildung" = Kurse, Seminare, Trainerlizenzen, Fachliteratur, Lehrgänge
  - "buero" = Büromaterial, Druckerkosten, Papier, Stifte, Porto
  - "werbung" = Werbung, Marketing, Flyer, Visitenkarten, Online-Werbung, ChatGPT, OpenAI, KI-Tools, Software-Abos für Marketing, Website-Kosten, Social Media, Google Ads, Facebook Ads, Canva, Content-Erstellung
  - "anschaffungen" = Fremdleistungen, externe Dienstleistungen, Honorare, Subunternehmer
  - "sonstiges" = GWG, geringwertige Wirtschaftsgüter, alles andere
- hatVorsteuer: true wenn MwSt/USt ausgewiesen ist, sonst false
- vorsteuerSatz: Der MwSt-Satz als Zahl (7 oder 19), oder null wenn keine MwSt
- haendler: Name des Händlers/Geschäfts (oder null wenn nicht lesbar)
- rechnungsnummer: Die Rechnungsnummer/Belegnummer (oder null wenn nicht vorhanden)
- rechnungsdatum: Das Rechnungsdatum im Format YYYY-MM-DD (oder null wenn nicht vorhanden, oft identisch mit datum)

Beispiel-Antwort:
{"datum":"2024-12-10","betrag":49.99,"beschreibung":"Büromaterial","kategorie":"buero","hatVorsteuer":true,"vorsteuerSatz":19,"haendler":"Staples","rechnungsnummer":"RE-2024-12345","rechnungsdatum":"2024-12-10"}`
            }
          ]
        }],
        generationConfig: {
          response_mime_type: "application/json"
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error:', errorText)
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const result = await response.json()
    const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text

    if (!textContent) {
      throw new Error('No text response from Gemini')
    }

    // JSON parsen
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