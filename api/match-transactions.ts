import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

interface OffenerPosten {
  id: string
  typ: 'training' | 'rechnung' | 'ausgabe'
  datum: string
  empfaenger_name: string
  spieler_id?: string
  betrag: number
  beschreibung?: string
  rechnungsnummer?: string
}

interface BankTransaction {
  id: string
  booking_date: string
  amount: number
  debtor_name?: string
  creditor_name?: string
  remittance_info?: string
}

interface MatchRequest {
  transactions: BankTransaction[]
  offenePosten: OffenerPosten[]
  spielerNamen: { id: string; name: string }[]
}

interface AISuggestion {
  type: 'training' | 'rechnung' | 'ausgabe' | 'guthaben'
  id: string
  spieler_id?: string
  confidence: number
  reason: string
}

interface MatchResult {
  transaction_id: string
  suggestion: AISuggestion | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' })
  }

  try {
    const { transactions, offenePosten, spielerNamen } = req.body as MatchRequest

    if (!transactions?.length) {
      return res.status(400).json({ error: 'Keine Transaktionen zum Matchen' })
    }

    const client = new Anthropic({ apiKey })

    // Formatiere die Daten für Claude
    const offenePostenText = offenePosten.map(p => {
      const betragStr = p.betrag >= 0 ? `+${p.betrag.toFixed(2)}` : p.betrag.toFixed(2)
      return `- ID: ${p.id} | Typ: ${p.typ} | Datum: ${p.datum} | ${p.empfaenger_name} | ${betragStr} EUR | ${p.beschreibung || ''} ${p.rechnungsnummer ? `| RG: ${p.rechnungsnummer}` : ''}`
    }).join('\n')

    const spielerText = spielerNamen.map(s => `${s.id}: ${s.name}`).join(', ')

    const transaktionenText = transactions.map(t => {
      const betragStr = t.amount >= 0 ? `+${t.amount.toFixed(2)}` : t.amount.toFixed(2)
      const name = t.amount >= 0 ? t.debtor_name : t.creditor_name
      return `- TX-ID: ${t.id} | Datum: ${t.booking_date} | ${betragStr} EUR | Von/An: ${name || 'Unbekannt'} | Verwendungszweck: ${t.remittance_info || '-'}`
    }).join('\n')

    const prompt = `Du bist ein Buchhalter-Assistent für einen Tennistrainer. Deine Aufgabe ist es, Bankumsätze mit offenen Posten abzugleichen.

OFFENE POSTEN (unbezahlte Trainings, Rechnungen, Ausgaben):
${offenePostenText || 'Keine offenen Posten'}

SPIELER-NAMEN (ID: Name):
${spielerText || 'Keine Spieler'}

BANKUMSÄTZE ZUM ABGLEICHEN:
${transaktionenText}

AUFGABE:
Für jeden Bankumsatz, prüfe ob er zu einem offenen Posten passt. Beachte:
1. Eingehende Zahlungen (+) sollten mit Trainings oder Rechnungen gematcht werden
2. Ausgehende Zahlungen (-) sollten mit Ausgaben gematcht werden
3. Der Betrag muss ungefähr passen (kleine Abweichungen von bis zu 5% sind OK)
4. Der Name im Verwendungszweck oder Auftraggeber sollte zum Spieler/Empfänger passen
5. Das Datum der Zahlung sollte nach dem Leistungsdatum liegen

Antworte NUR mit einem JSON-Array im folgenden Format (keine Erklärungen, nur JSON):
[
  {
    "transaction_id": "TX-ID",
    "suggestion": {
      "type": "training" | "rechnung" | "ausgabe" | null,
      "id": "ID des offenen Postens" | null,
      "spieler_id": "Spieler-ID falls zutreffend" | null,
      "confidence": 0-100,
      "reason": "Kurze Begründung auf Deutsch"
    }
  }
]

Wenn kein Match gefunden wird, setze suggestion auf null.
Confidence-Werte:
- 90-100: Sehr sicher (Betrag passt genau, Name passt)
- 70-89: Wahrscheinlich (Betrag passt ungefähr, Name teilweise erkennbar)
- 50-69: Möglich (nur einer der Faktoren passt)
- unter 50: Unsicher (lieber null zurückgeben)`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    })

    // Extrahiere die Antwort
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Parse JSON aus der Antwort
    let results: MatchResult[] = []
    try {
      // Versuche das JSON zu extrahieren (auch wenn es in Markdown-Codeblocks ist)
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        results = JSON.parse(jsonMatch[0])
      }
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError, 'Response:', responseText)
      return res.status(500).json({ error: 'Konnte AI-Antwort nicht parsen', raw: responseText })
    }

    return res.status(200).json({
      success: true,
      results,
      message: `${results.filter(r => r.suggestion).length} von ${transactions.length} Transaktionen gematcht`
    })

  } catch (error: unknown) {
    console.error('Match Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return res.status(500).json({ error: errorMessage })
  }
}
