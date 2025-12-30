import "https://deno.land/x/xhr@0.3.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// SKR03-konforme Kategorien
type AusgabeKategorie =
  | 'platzmiete'    // 4210 Miete/Raumkosten
  | 'kfz'           // 4500 Kfz-Kosten
  | 'fahrtkosten'   // 4673 Fahrtkosten/Km-Geld
  | 'reisekosten'   // 4653 Reisekosten
  | 'werbung'       // 4600 Werbekosten
  | 'anschaffungen' // 4780 Fremdleistungen
  | 'telefon'       // 4920 Telefon/Internet
  | 'porto'         // 4830 Porto/Versand
  | 'buero'         // 4930 Bürobedarf
  | 'fortbildung'   // 4946 Fortbildung
  | 'beratung'      // 4950 Beratung/Steuerberater
  | 'versicherung'  // 4360 Versicherungen
  | 'beitraege'     // 4380 Beiträge/Gebühren
  | 'reparatur'     // 4805 Reparatur/Instandhaltung
  | 'bank'          // 4855 Bankgebühren
  | 'abschreibung'  // 4822 Abschreibungen
  | 'material'      // 4560 Betriebsbedarf/Material
  | 'sonstiges'     // 4900 Sonstige Aufwendungen

interface BelegData {
  datum: string | null
  betrag: number | null
  beschreibung: string | null
  kategorie: AusgabeKategorie | null
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

    // Google Gemini API aufrufen mit SKR03-Kategorien
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
- kategorie: Eine der folgenden SKR03-Kategorien die am besten passt:

  RAUMKOSTEN:
  - "platzmiete" (SKR03: 4210) = Tennisplatz-Miete, Hallenmiete, Raummiete, Courtbuchung, Mietkosten

  KFZ & FAHRTKOSTEN:
  - "kfz" (SKR03: 4500) = Benzin, Diesel, Tanken, Autowäsche, TÜV, Kfz-Reparatur, Parkgebühren, Maut
  - "fahrtkosten" (SKR03: 4673) = Bahntickets, ÖPNV, Taxi, Kilometergeld, Fahrtkosten-Erstattung

  REISEKOSTEN:
  - "reisekosten" (SKR03: 4653) = Hotel, Übernachtung, Verpflegung auf Dienstreisen

  WERBUNG:
  - "werbung" (SKR03: 4600) = Werbung, Marketing, Flyer, Visitenkarten, Website, Social Media, Google Ads, ChatGPT, OpenAI, KI-Tools, Software-Abos für Marketing, Canva

  FREMDLEISTUNGEN:
  - "anschaffungen" (SKR03: 4780) = Externe Dienstleistungen, Honorare, Subunternehmer, Freelancer

  KOMMUNIKATION:
  - "telefon" (SKR03: 4920) = Telefon, Mobilfunk, Internet, DSL, Handyvertrag
  - "porto" (SKR03: 4830) = Porto, Briefmarken, Paketversand, DHL, Hermes

  BÜRO & FORTBILDUNG:
  - "buero" (SKR03: 4930) = Büromaterial, Papier, Druckerpatronen, Stifte, Ordner
  - "fortbildung" (SKR03: 4946) = Seminare, Kurse, Trainerlizenz, Fachliteratur, Bücher, Fachzeitschriften
  - "beratung" (SKR03: 4950) = Steuerberater, Rechtsanwalt, Unternehmensberatung

  VERSICHERUNG & BEITRÄGE:
  - "versicherung" (SKR03: 4360) = Haftpflicht, Berufshaftpflicht, Unfallversicherung
  - "beitraege" (SKR03: 4380) = Verbandsbeiträge, Vereinsmitgliedschaft, IHK, Berufsverband

  WARTUNG & REPARATUR:
  - "reparatur" (SKR03: 4805) = Reparaturen, Wartung, Instandhaltung von Geräten/Anlagen

  BANK:
  - "bank" (SKR03: 4855) = Kontoführungsgebühren, Bankgebühren, Überweisungsgebühren

  ABSCHREIBUNG:
  - "abschreibung" (SKR03: 4822) = Abschreibungen auf Anlagegüter (selten auf Belegen)

  MATERIAL:
  - "material" (SKR03: 4560) = Tennisbälle, Schläger, Trainingsgeräte, Sportmaterial, Verbrauchsmaterial

  SONSTIGES:
  - "sonstiges" (SKR03: 4900) = Alles was nicht in obige Kategorien passt

- hatVorsteuer: true wenn MwSt/USt ausgewiesen ist, sonst false
- vorsteuerSatz: Der MwSt-Satz als Zahl (7 oder 19), oder null wenn keine MwSt
- haendler: Name des Händlers/Geschäfts (oder null wenn nicht lesbar)
- rechnungsnummer: Die Rechnungsnummer/Belegnummer (oder null wenn nicht vorhanden)
- rechnungsdatum: Das Rechnungsdatum im Format YYYY-MM-DD (oder null wenn nicht vorhanden)

Beispiel-Antworten:
{"datum":"2024-12-10","betrag":65.50,"beschreibung":"Tankfüllung Super E10","kategorie":"kfz","hatVorsteuer":true,"vorsteuerSatz":19,"haendler":"Shell Tankstelle","rechnungsnummer":null,"rechnungsdatum":"2024-12-10"}
{"datum":"2024-12-15","betrag":29.99,"beschreibung":"Mobilfunkrechnung Dezember","kategorie":"telefon","hatVorsteuer":true,"vorsteuerSatz":19,"haendler":"Telekom","rechnungsnummer":"RE-2024-987654","rechnungsdatum":"2024-12-15"}
{"datum":"2024-12-20","betrag":150.00,"beschreibung":"Tennisbälle 12er Pack","kategorie":"material","hatVorsteuer":true,"vorsteuerSatz":19,"haendler":"Tennis-Point","rechnungsnummer":"TP-2024-456","rechnungsdatum":"2024-12-20"}`
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
