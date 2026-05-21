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

// Individueller Tarif fuer einen Spieler in einem Gruppentraining
export interface SpielerTarifOverride {
  tarif_id?: string | null
  custom_preis?: number | null
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

export interface Pool {
  id: string
  user_id: string
  name: string
  wochentag: number // 0 = Mo ... 6 = So
  uhrzeit_von: string
  uhrzeit_bis: string
  pauschalpreis_pro_woche: number
  start_datum?: string | null
  end_datum?: string | null
  notiz?: string | null
  created_at: string
  updated_at?: string
}

export interface PoolSpieler {
  id: string
  pool_id: string
  spieler_id: string
  pauschalpreis_override?: number | null
  einheiten_pro_woche: number
  created_at: string
}

export type Tab = 'kalender' | 'verwaltung' | 'abrechnung' | 'abrechnung-trainer' | 'pool'
