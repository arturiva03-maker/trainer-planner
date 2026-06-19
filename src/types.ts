export interface TrainerProfile {
  id: string
  user_id: string
  name: string
  nachname?: string
  adresse?: string
  approved: boolean
  notiz?: string
  created_at: string
  updated_at: string
}

export interface Spieler {
  id: string
  user_id: string
  name: string
  // Verknuepfung zum Lexoffice-Kontakt (Rechnungsempfaenger, i.d.R. das Elternteil)
  lexoffice_contact_id?: string | null
  lexoffice_contact_name?: string | null
  // Label: in der Sommersaison faellt fuer diesen (erwachsenen) Spieler
  // pro Trainingsstunde eine Platzgebuehr an.
  platzgebuehr?: boolean
  created_at: string
}

export interface Tarif {
  id: string
  user_id: string
  name: string
  preis_pro_stunde: number
  abrechnung: 'proTraining' | 'monatlich'
  beschreibung?: string
  created_at: string
}

// Entfernter Spieler mit Info ob trotzdem bezahlt werden muss
export interface EntfernterSpieler {
  spieler_id: string
  muss_bezahlen: boolean
  entfernt_am: string
}

// Individueller Tarif fuer einen Spieler in einem Gruppentraining.
// einheiten zaehlt fuer Pool-Trainings, wie oft der Spieler teilnimmt
// (Default 1; > 1 wenn er mehrfach pro Einheit dabei ist).
export interface SpielerTarifOverride {
  tarif_id?: string | null
  custom_preis?: number | null
  einheiten?: number | null
}

export interface Training {
  id: string
  user_id: string
  datum: string
  uhrzeit_von: string
  uhrzeit_bis: string
  spieler_ids: string[]
  entfernte_spieler?: EntfernterSpieler[]
  tarif_id?: string
  trainer_id?: string
  status: 'geplant' | 'durchgefuehrt' | 'durchgefuehrt_halb' | 'abgesagt'
  notiz?: string
  name?: string
  serie_id?: string
  custom_preis_pro_stunde?: number
  spieler_tarife?: Record<string, SpielerTarifOverride> | null
  bar_bezahlt: boolean
  bezahlt: boolean
  korrektur_betrag?: number
  korrektur_grund?: string
  ist_pool?: boolean
  pool_pauschalpreis_pro_einheit?: number | null
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

// Bezahlstatus pro Spieler pro Training (für Gruppentrainings)
export interface SpielerTrainingPayment {
  id: string
  user_id: string
  training_id: string
  spieler_id: string
  bezahlt: boolean
  bar_bezahlt: boolean
  ausstehend: boolean
  created_at: string
}

export interface MonthlyAdjustment {
  id: string
  user_id: string
  monat: string
  spieler_id: string
  betrag: number
  grund?: string
  created_at?: string
}

export type Tab = 'kalender' | 'verwaltung' | 'abrechnung' | 'platzgebuehr' | 'abrechnung-trainer'
