export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function formatDateGerman(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatTime(time: string): string {
  return time.substring(0, 5)
}

export function getWeekDates(date: Date): Date[] {
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(date)
  monday.setDate(diff)

  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates.push(d)
  }
  return dates
}

export function getMonthString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function calculateDuration(von: string, bis: string): number {
  const [vonH, vonM] = von.split(':').map(Number)
  const [bisH, bisM] = bis.split(':').map(Number)
  return (bisH * 60 + bisM - vonH * 60 - vonM) / 60
}

// Berechnet den Preis eines einzelnen Spielers fuer ein Training.
// Beruecksichtigt individuelle Tarife pro Spieler (spieler_tarife) falls vorhanden.
// Pool-Trainings (ist_pool): Pauschalpreis pro Einheit x einheiten (aus
// spieler_tarife[sid].einheiten, Default 1). Tarif/Dauer/Status spielen
// keine Rolle.
export function calculateSpielerPreisForTraining(
  training: import('./types').Training,
  spielerId: string,
  tarife: import('./types').Tarif[]
): {
  spielerPreis: number
  abrechnungsart: 'proTraining' | 'monatlich'
  tarifId: string | null
  istIndividuell: boolean
} {
  // Pool-Training: feste Pauschale pro Einheit x Einheiten des Spielers
  if (training.ist_pool) {
    const pauschale = training.pool_pauschalpreis_pro_einheit ?? 0
    const einheiten = training.spieler_tarife?.[spielerId]?.einheiten ?? 1
    const halb = training.status === 'durchgefuehrt_halb' ? 0.5 : 1
    return {
      spielerPreis: pauschale * einheiten * halb,
      abrechnungsart: 'proTraining',
      tarifId: null,
      istIndividuell: true
    }
  }

  const duration = calculateDuration(training.uhrzeit_von, training.uhrzeit_bis)
  // 50%-Trainings (z.B. wg. Regen abgebrochen): nur Hälfte berechnen.
  // Gilt nur fuer proTraining-Abrechnung; monatliche Tarife bleiben unveraendert.
  const halbFaktor = training.status === 'durchgefuehrt_halb' ? 0.5 : 1

  // Individueller Tarif fuer diesen Spieler?
  const individuell = training.spieler_tarife?.[spielerId]
  if (individuell && (individuell.tarif_id || individuell.custom_preis != null)) {
    const tarif = individuell.tarif_id ? tarife.find(ta => ta.id === individuell.tarif_id) : undefined
    const preis = individuell.custom_preis != null ? individuell.custom_preis : (tarif?.preis_pro_stunde || 0)
    const abrechnungsart = tarif?.abrechnung || 'proTraining'

    if (abrechnungsart === 'monatlich') {
      return {
        spielerPreis: preis,
        abrechnungsart: 'monatlich',
        tarifId: individuell.tarif_id || null,
        istIndividuell: true
      }
    }
    return {
      spielerPreis: preis * duration * halbFaktor,
      abrechnungsart: 'proTraining',
      tarifId: individuell.tarif_id || null,
      istIndividuell: true
    }
  }

  // Fallback: Training-Tarif
  const tarif = tarife.find(ta => ta.id === training.tarif_id)
  const preis = training.custom_preis_pro_stunde != null
    ? training.custom_preis_pro_stunde
    : (tarif?.preis_pro_stunde || 0)
  const abrechnungsart = tarif?.abrechnung || 'proTraining'

  if (abrechnungsart === 'monatlich') {
    return {
      spielerPreis: preis,
      abrechnungsart: 'monatlich',
      tarifId: training.tarif_id || null,
      istIndividuell: false
    }
  }

  return {
    spielerPreis: preis * duration * halbFaktor,
    abrechnungsart,
    tarifId: training.tarif_id || null,
    istIndividuell: false
  }
}

export const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

// Wandelt einen Betrags-String in eine Zahl um – egal ob deutsches Format
// ("1.234,56", "24,75") oder Punkt-Dezimalformat ("1,234.56", "24.75").
// Regeln:
//  - Kommt . UND , vor: das LETZTE Trennzeichen ist das Dezimaltrennzeichen,
//    der Rest sind Tausendertrenner.
//  - Kommt nur eines vor: 3 Nachkommastellen => Tausendertrenner (z.B. 1.234),
//    sonst (1-2 Stellen) => Dezimaltrenner (z.B. 24.75 / 24,75).
function parseAmount(raw: string): number | null {
  let s = raw.replace(/EUR/gi, '').replace(/[€\s]/g, '')
  const neg = s.startsWith('-')
  s = s.replace(/^[+-]/, '')

  const hasDot = s.includes('.')
  const hasComma = s.includes(',')

  if (hasDot && hasComma) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (hasDot || hasComma) {
    const sep = hasComma ? ',' : '.'
    const idx = s.lastIndexOf(sep)
    const after = s.length - idx - 1
    if (after === 3) {
      s = s.split(sep).join('') // Tausendertrenner -> entfernen
    } else {
      s = s.slice(0, idx).split(sep).join('') + '.' + s.slice(idx + 1)
    }
  }

  const v = Number(s)
  if (!Number.isFinite(v)) return null
  return neg ? -v : v
}

// Formatiert eine Zahl als deutschen Betrag ("1.234,56") mit genau 2 Nachkommastellen.
function formatGermanAmount(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Extrahiert aus Rechnungs-/Transaktionstext zeilenweise Datum + Betrag und
// bildet die exakte Summe. Reines Copy-Paste-Format ohne Meta-Text:
//   Datum
//   Betrag
//   <Leerzeile>
//   ...
//   Gesamtbetrag: <Summe>
// Pro Zeile wird das erste Datum und der erste Geldbetrag gepaart. Zeilen ohne
// beides werden ignoriert. Die Summe wird in Cent gerechnet (kein Float-Drift).
export function extractDatumBetrag(input: string): string {
  // Datum: DD.MM.YYYY / DD.MM.YY / ISO YYYY-MM-DD / DD.MM. (ohne Jahr)
  const dateRe = /\d{1,2}\.\d{1,2}\.\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\./
  // Betrag bevorzugt direkt vor € / EUR (egal welches Zahlenformat).
  const amountCurrencyRe = /(-?\d[\d.,]*)\s*(?:€|EUR)/i
  // Fallback ohne Waehrung: Zahl mit Dezimaltrenner (so werden Uhrzeiten mit
  // Doppelpunkt nicht faelschlich als Betrag erkannt).
  const amountFallbackRe = /-?\d[\d.,]*[.,]\d{1,2}(?!\d)/

  const entries: { datum: string; betrag: string; value: number }[] = []

  for (const raw of input.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const dateMatch = line.match(dateRe)
    if (!dateMatch) continue
    // Datum aus der Zeile entfernen, damit seine Punkte nicht als Betrag zaehlen.
    const rest = line.replace(dateMatch[0], ' ')
    const curMatch = rest.match(amountCurrencyRe)
    const amountStr = curMatch ? curMatch[1] : rest.match(amountFallbackRe)?.[0]
    if (!amountStr) continue
    const value = parseAmount(amountStr)
    if (value == null) continue
    // Betrag einheitlich im deutschen Format ausgeben.
    entries.push({ datum: dateMatch[0], betrag: formatGermanAmount(value), value })
  }

  if (entries.length === 0) return ''

  const sumCents = entries.reduce((acc, e) => acc + Math.round(e.value * 100), 0)
  const blocks = entries.map((e) => `${e.datum}\n${e.betrag} €`)
  return `${blocks.join('\n\n')}\n\nGesamtbetrag: ${formatGermanAmount(sumCents / 100)} €`
}
