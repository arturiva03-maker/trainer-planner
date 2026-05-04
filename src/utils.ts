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
export function calculateSpielerPreisForTraining(
  training: import('./types').Training,
  spielerId: string,
  tarife: import('./types').Tarif[]
): {
  spielerPreis: number
  abrechnungsart: 'proTraining' | 'proSpieler' | 'monatlich'
  tarifId: string | null
  istIndividuell: boolean
} {
  const duration = calculateDuration(training.uhrzeit_von, training.uhrzeit_bis)

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
      spielerPreis: preis * duration,
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
  const abrechnungsart = training.custom_abrechnung || tarif?.abrechnung || 'proTraining'

  if (abrechnungsart === 'monatlich') {
    return {
      spielerPreis: preis,
      abrechnungsart: 'monatlich',
      tarifId: training.tarif_id || null,
      istIndividuell: false
    }
  }

  let spielerPreis = preis * duration
  if (abrechnungsart === 'proSpieler') {
    const entfernteMitBezahlung = (training.entfernte_spieler || []).filter(es => es.muss_bezahlen)
    const zahlendeSpielerAnzahl = training.spieler_ids.length + entfernteMitBezahlung.length
    if (zahlendeSpielerAnzahl > 0) {
      spielerPreis = spielerPreis / zahlendeSpielerAnzahl
    }
  }
  return {
    spielerPreis,
    abrechnungsart,
    tarifId: training.tarif_id || null,
    istIndividuell: false
  }
}

export const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
