export interface TrainerProfile {
  id: string
  user_id: string
  name: string
  nachname?: string
  adresse?: string
  stundensatz: number
  iban?: string
  ust_id_nr?: string
  kleinunternehmer: boolean
  approved: boolean
  notiz?: string
  created_at: string
  updated_at: string
}

export interface Spieler {
  id: string
  user_id: string
  name: string
  kontakt_email?: string
  kontakt_telefon?: string
  rechnungs_adresse?: string
  rechnungs_empfaenger?: string
  rechnungs_spieler_id?: string
  abweichende_rechnung: boolean
  notizen?: string
  created_at: string
}

export interface Tarif {
  id: string
  user_id: string
  name: string
  preis_pro_stunde: number
  abrechnung: 'proTraining' | 'proSpieler' | 'monatlich'
  beschreibung?: string
  inkl_ust: boolean
  ust_satz: number
  created_at: string
}

export interface Training {
  id: string
  user_id: string
  datum: string
  uhrzeit_von: string
  uhrzeit_bis: string
  spieler_ids: string[]
  tarif_id?: string
  trainer_id?: string
  status: 'geplant' | 'durchgefuehrt' | 'abgesagt'
  notiz?: string
  serie_id?: string
  custom_preis_pro_stunde?: number
  custom_abrechnung?: 'proTraining' | 'proSpieler'
  bar_bezahlt: boolean
  bezahlt: boolean
  created_at: string
}

export interface Trainer {
  id: string
  user_id: string
  name: string
  stundensatz: number
  notiz?: string
  created_at: string
}

export interface Payment {
  id: string
  user_id: string
  monat: string
  spieler_id: string
  bezahlt: boolean
}

export interface MonthlyAdjustment {
  id: string
  user_id: string
  monat: string
  spieler_id: string
  betrag: number
}

export interface Notiz {
  id: string
  user_id: string
  titel: string
  inhalt?: string
  erstellt_am: string
  aktualisiert_am: string
}

export interface PlanungSheet {
  id: string
  user_id: string
  name: string
  data: PlanungData
  is_active: boolean
  created_at: string
}

export interface PlanungData {
  zeitslots: string[]
  tage: { [key: string]: { [zeit: string]: string[] } }
}

export type Tab = 'kalender' | 'verwaltung' | 'abrechnung' | 'abrechnung-trainer' | 'planung' | 'buchhaltung' | 'weiteres'

export interface Ausgabe {
  id: string
  user_id: string
  datum: string
  betrag: number
  kategorie: 'platzmiete' | 'material' | 'fahrtkosten' | 'fortbildung' | 'sonstiges'
  beschreibung?: string
  hat_vorsteuer: boolean
  vorsteuer_satz: number
  created_at: string
}

export const AUSGABE_KATEGORIEN: { value: Ausgabe['kategorie']; label: string }[] = [
  { value: 'platzmiete', label: 'Platzmiete' },
  { value: 'material', label: 'Material' },
  { value: 'fahrtkosten', label: 'Fahrtkosten' },
  { value: 'fortbildung', label: 'Fortbildung' },
  { value: 'sonstiges', label: 'Sonstiges' }
]
