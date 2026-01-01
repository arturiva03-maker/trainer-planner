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
  email_vorlage?: string
  notiz?: string
  finanzamt?: string
  steuernummer?: string
  // SMTP-Einstellungen für E-Mail-Versand
  smtp_host?: string
  smtp_port?: number
  smtp_user?: string
  smtp_pass?: string
  smtp_from_email?: string
  smtp_from_name?: string
  smtp_secure?: boolean
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
  iban?: string
  mandatsreferenz?: string
  unterschriftsdatum?: string
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

// Entfernter Spieler mit Info ob trotzdem bezahlt werden muss
export interface EntfernterSpieler {
  spieler_id: string
  muss_bezahlen: boolean
  entfernt_am: string
}

export interface Training {
  id: string
  user_id: string
  datum: string
  uhrzeit_von: string
  uhrzeit_bis: string
  spieler_ids: string[]
  entfernte_spieler?: EntfernterSpieler[] // Entfernte Spieler mit Bezahlpflicht
  tarif_id?: string
  trainer_id?: string
  status: 'geplant' | 'durchgefuehrt' | 'abgesagt'
  notiz?: string
  name?: string // Optionaler Name wie "Mannschaftstraining"
  serie_id?: string
  custom_preis_pro_stunde?: number
  custom_abrechnung?: 'proTraining' | 'proSpieler'
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

export interface Payment {
  id: string
  user_id: string
  monat: string
  spieler_id: string
  bezahlt: boolean
}

// Bezahlstatus pro Spieler pro Training (für Gruppentrainings)
export interface SpielerTrainingPayment {
  id: string
  user_id: string
  training_id: string
  spieler_id: string
  bezahlt: boolean
  bar_bezahlt: boolean
  ausstehend: boolean // Rechnung/Erinnerung gesendet, Zahlung erwartet
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

export type Tab = 'kalender' | 'verwaltung' | 'abrechnung' | 'abrechnung-trainer' | 'planung' | 'buchhaltung' | 'weiteres' | 'formulare'

// Event-Anmeldeformular System
export interface FormularFeld {
  id: string
  typ: 'text' | 'email' | 'telefon' | 'dropdown' | 'textarea' | 'checkbox' | 'datum' | 'number'
  label: string
  pflichtfeld: boolean
  optionen?: string[]  // Für Dropdown
  placeholder?: string
}

export interface Formular {
  id: string
  user_id: string
  titel: string
  beschreibung?: string
  ist_aktiv: boolean
  felder: FormularFeld[]
  event_datum?: string
  event_uhrzeit_von?: string
  event_uhrzeit_bis?: string
  event_ort?: string
  max_anmeldungen?: number
  anmeldeschluss?: string
  preis?: string
  absagefrist?: string
  created_at: string
  updated_at?: string
}

export interface FormularAnmeldung {
  id: string
  formular_id: string
  daten: Record<string, string | boolean | number>
  gelesen: boolean
  email_versendet: boolean
  created_at: string
}

export interface ManuelleRechnung {
  id: string
  user_id: string
  rechnungsnummer: string
  rechnungsdatum: string
  monat: string // Format: YYYY-MM für die Zuordnung zur Abrechnung
  empfaenger_name: string
  empfaenger_adresse?: string
  leistungszeitraum?: string
  beschreibung?: string
  positionen: { beschreibung: string; menge: number; einzelpreis: number }[]
  ust_satz: number
  netto_gesamt: number
  ust_betrag: number
  brutto_gesamt: number
  zahlungsziel: number
  freitext?: string
  bezahlt: boolean
  bar_bezahlt: boolean
  training_ids?: string[] // Training-IDs die zu dieser Rechnung gehören (für Trainings-Rechnungen)
  spieler_id?: string // Spieler-ID für Trainings-Rechnungen
  created_at: string
}

// Guthaben pro Spieler - wird nach und nach abgerechnet
export interface Guthaben {
  id: string
  user_id: string
  spieler_id: string
  aktuell: number // Aktueller Guthabenstand
  eingezahlt_gesamt: number // Gesamtbetrag aller Einzahlungen
  verbraucht_gesamt: number // Gesamtbetrag aller Abbuchungen
  letzte_einzahlung?: string // Datum der letzten Einzahlung
  notiz?: string
  created_at: string
  updated_at: string
}

// Guthaben-Transaktionen (Einzahlungen und Abbuchungen)
export interface GuthabenTransaktion {
  id: string
  user_id: string
  spieler_id: string
  betrag: number // positiv = Einzahlung, negativ = Abbuchung
  typ: 'einzahlung' | 'abbuchung'
  training_id?: string // Bei Abbuchung: welches Training
  beschreibung?: string
  bar: boolean
  datum: string
  created_at: string
}

export interface EmailVorlage {
  id: string
  user_id: string
  name: string
  betreff: string
  inhalt: string
  ist_standard: boolean
  created_at: string
}

export interface PdfVorlage {
  id: string
  user_id: string
  name: string
  inhalt: string // HTML-Vorlage
  ist_standard: boolean
  created_at: string
}

// Verfügbare Platzhalter für E-Mail-Vorlagen (nur Text)
export const EMAIL_PLATZHALTER = [
  { key: '{{spieler_name}}', beschreibung: 'Name des Spielers' },
  { key: '{{rechnungsnummer}}', beschreibung: 'Rechnungsnummer' },
  { key: '{{rechnungsdatum}}', beschreibung: 'Rechnungsdatum' },
  { key: '{{monat}}', beschreibung: 'Abrechnungsmonat (z.B. Dezember 2024)' },
  { key: '{{positionen}}', beschreibung: 'Auflistung aller Trainings/Positionen' },
  { key: '{{netto}}', beschreibung: 'Nettobetrag' },
  { key: '{{ust}}', beschreibung: 'Umsatzsteuer-Betrag' },
  { key: '{{brutto}}', beschreibung: 'Gesamtbetrag (Brutto)' },
  { key: '{{iban}}', beschreibung: 'IBAN des Trainers' },
  { key: '{{trainer_name}}', beschreibung: 'Name des Trainers' },
  { key: '{{trainer_adresse}}', beschreibung: 'Adresse des Trainers' },
  { key: '{{steuernummer}}', beschreibung: 'Steuernummer des Trainers' },
  { key: '{{empfaenger_name}}', beschreibung: 'Name des Rechnungsempfängers' },
  { key: '{{empfaenger_adresse}}', beschreibung: 'Adresse des Rechnungsempfängers' },
  { key: '{{kleinunternehmer_hinweis}}', beschreibung: 'Kleinunternehmer-Hinweis (falls zutreffend)' },
  { key: '{{ust_zeile}}', beschreibung: 'USt-Zeile (leer bei Kleinunternehmer)' },
  { key: '{{spieler_iban}}', beschreibung: 'IBAN des Spielers (maskiert: DE12****5678)' },
  { key: '{{spieler_mandatsreferenz}}', beschreibung: 'Mandatsreferenz des Spielers' },
  { key: '{{spieler_unterschriftsdatum}}', beschreibung: 'Unterschriftsdatum SEPA-Mandat' },
]

// Verfügbare Platzhalter für PDF-Vorlagen (mit HTML)
export const PDF_PLATZHALTER = [
  { key: '{{spieler_name}}', beschreibung: 'Name des Spielers' },
  { key: '{{rechnungsnummer}}', beschreibung: 'Rechnungsnummer' },
  { key: '{{rechnungsdatum}}', beschreibung: 'Rechnungsdatum' },
  { key: '{{monat}}', beschreibung: 'Abrechnungsmonat (z.B. Dezember 2024)' },
  { key: '{{positionen_tabelle}}', beschreibung: 'Trainings als HTML-Tabelle' },
  { key: '{{netto}}', beschreibung: 'Nettobetrag' },
  { key: '{{ust}}', beschreibung: 'Umsatzsteuer-Betrag' },
  { key: '{{brutto}}', beschreibung: 'Gesamtbetrag (Brutto)' },
  { key: '{{iban}}', beschreibung: 'IBAN des Trainers' },
  { key: '{{trainer_name}}', beschreibung: 'Name des Trainers' },
  { key: '{{trainer_adresse_html}}', beschreibung: 'Adresse des Trainers (HTML)' },
  { key: '{{steuernummer}}', beschreibung: 'Steuernummer des Trainers' },
  { key: '{{empfaenger_name}}', beschreibung: 'Name des Rechnungsempfängers' },
  { key: '{{empfaenger_adresse_html}}', beschreibung: 'Adresse des Empfängers (HTML)' },
  { key: '{{kleinunternehmer_hinweis}}', beschreibung: 'Kleinunternehmer-Hinweis' },
  { key: '{{ust_zeile}}', beschreibung: 'USt-Zeile (leer bei Kleinunternehmer)' },
  { key: '{{summen_block}}', beschreibung: 'Summen-Block als HTML' },
  { key: '{{spieler_iban}}', beschreibung: 'IBAN des Spielers (maskiert: DE12****5678)' },
  { key: '{{spieler_mandatsreferenz}}', beschreibung: 'Mandatsreferenz des Spielers' },
  { key: '{{spieler_unterschriftsdatum}}', beschreibung: 'Unterschriftsdatum SEPA-Mandat' },
]

// Banking / Bankumsätze
export interface BankConnection {
  id: string
  user_id: string
  institution_id: string // GoCardless Institution ID (z.B. COMMERZBANK_COBADEFFXXX)
  institution_name: string
  requisition_id: string // GoCardless Requisition ID
  account_id: string // GoCardless Account ID
  iban?: string
  status: 'pending' | 'active' | 'expired' | 'error'
  last_sync?: string
  created_at: string
}

export interface BankTransaction {
  id: string
  user_id: string
  bank_connection_id?: string // Optional bei CSV-Import
  transaction_id: string // Eindeutige ID (bei CSV: generiert aus Datum+Betrag+Verwendungszweck)
  booking_date: string
  value_date?: string
  amount: number // Positiv = Eingang, Negativ = Ausgang
  currency: string
  debtor_name?: string // Wer hat gezahlt
  creditor_name?: string // An wen wurde gezahlt
  remittance_info?: string // Verwendungszweck
  // Matching
  match_status: 'unmatched' | 'auto_matched' | 'manual_matched' | 'ignored'
  matched_training_id?: string
  matched_spieler_id?: string
  matched_rechnung_id?: string
  matched_ausgabe_id?: string
  match_confidence?: number // 0-100 bei auto_match
  // CSV-Import und AI-Matching
  import_source?: 'csv' | 'api' | 'manual'
  ai_suggestion?: AISuggestion
  ai_suggestion_status?: 'pending' | 'accepted' | 'rejected' | 'none'
  // Buchungskonto-Zuordnung
  buchungskonto_id?: string
  created_at: string
}

// AI-Vorschlag für Transaktion-Matching
export interface AISuggestion {
  type: 'training' | 'rechnung' | 'ausgabe' | 'guthaben'
  id: string
  spieler_id?: string
  confidence: number // 0-100
  reason: string // Begründung für den Vorschlag
}

export type BankTransactionMatchType = 'training' | 'rechnung' | 'ausgabe' | 'guthaben'

// Offene Posten (View aus DB oder berechnet)
export interface OffenerPosten {
  id: string
  typ: 'training' | 'rechnung' | 'ausgabe'
  datum: string
  empfaenger_name: string
  spieler_id?: string
  betrag: number // Positiv = Einnahme, Negativ = Ausgabe
  beschreibung?: string
  rechnungsnummer?: string
}

// Zwischentabelle für N:M Beziehung zwischen Bankumsätzen und Rechnungen (Sammelbuchungen)
export interface BankTransactionRechnung {
  id: string
  bank_transaction_id: string
  rechnung_id: string
  created_at: string
}

// CSV-Import Format (häufige deutsche Banken)
export interface CSVImportMapping {
  datum: string // Spaltenname für Datum
  betrag: string // Spaltenname für Betrag
  verwendungszweck: string // Spaltenname für Verwendungszweck
  auftraggeber?: string // Spaltenname für Auftraggeber/Empfänger
  datumFormat: string // z.B. "DD.MM.YYYY" oder "YYYY-MM-DD"
  dezimalTrennzeichen: ',' | '.' // Deutsches Format: Komma
  tausenderTrennzeichen?: '.' | ',' | '' // Deutsches Format: Punkt
}

// Buchungskonten (angelehnt an SKR03)
export interface Buchungskonto {
  id: string
  user_id: string
  kontonummer: string // z.B. "4600"
  name: string // z.B. "Werbekosten"
  typ: 'einnahme' | 'ausgabe' | 'neutral' // neutral = Privatentnahmen etc.
  beschreibung?: string
  ist_standard: boolean
  sortierung: number
  created_at: string
}

// Standard-Konten nach SKR03 (Standardkontenrahmen für Selbständige/Freiberufler)
export const STANDARD_KONTEN: Omit<Buchungskonto, 'id' | 'user_id' | 'created_at'>[] = [
  // ============ ERLÖSKONTEN (Klasse 8) ============
  { kontonummer: '8400', name: 'Erlöse 19% USt', typ: 'einnahme', beschreibung: 'Umsatzerlöse zum allgemeinen Steuersatz', ist_standard: true, sortierung: 1 },
  { kontonummer: '8300', name: 'Erlöse 7% USt', typ: 'einnahme', beschreibung: 'Umsatzerlöse zum ermäßigten Steuersatz', ist_standard: true, sortierung: 2 },
  { kontonummer: '8195', name: 'Erlöse Kleinunternehmer §19', typ: 'einnahme', beschreibung: 'Steuerfreie Umsätze nach §19 UStG', ist_standard: true, sortierung: 3 },
  { kontonummer: '8120', name: 'Steuerfreie Umsätze', typ: 'einnahme', beschreibung: 'Sonstige steuerfreie Umsätze', ist_standard: true, sortierung: 4 },
  { kontonummer: '8900', name: 'Sonstige Erträge', typ: 'einnahme', beschreibung: 'Sonstige betriebliche Erträge', ist_standard: true, sortierung: 5 },

  // ============ AUFWANDSKONTEN (Klasse 4) ============
  // Raumkosten
  { kontonummer: '4210', name: 'Miete/Raumkosten', typ: 'ausgabe', beschreibung: 'Miete für Geschäftsräume, Tennisplätze, Hallen', ist_standard: true, sortierung: 10 },
  { kontonummer: '4220', name: 'Nebenkosten', typ: 'ausgabe', beschreibung: 'Nebenkosten des Geldverkehrs, Abgaben', ist_standard: true, sortierung: 11 },

  // Kfz-Kosten
  { kontonummer: '4500', name: 'Kfz-Kosten', typ: 'ausgabe', beschreibung: 'Pauschale Kfz-Kosten (Sammelkonto)', ist_standard: true, sortierung: 20 },
  { kontonummer: '4510', name: 'Kfz-Steuer', typ: 'ausgabe', beschreibung: 'Kraftfahrzeugsteuer', ist_standard: true, sortierung: 21 },
  { kontonummer: '4520', name: 'Kfz laufende Kosten', typ: 'ausgabe', beschreibung: 'Benzin, Reparaturen, Wartung, TÜV', ist_standard: true, sortierung: 22 },
  { kontonummer: '4530', name: 'Kfz-Leasing', typ: 'ausgabe', beschreibung: 'Leasingraten für betriebliche Fahrzeuge', ist_standard: true, sortierung: 23 },
  { kontonummer: '4540', name: 'Kfz-Versicherung', typ: 'ausgabe', beschreibung: 'Haftpflicht, Kasko für Kfz', ist_standard: true, sortierung: 24 },

  // Werbung und Repräsentation
  { kontonummer: '4600', name: 'Werbekosten', typ: 'ausgabe', beschreibung: 'Werbung, Marketing, Flyer, Website', ist_standard: true, sortierung: 30 },
  { kontonummer: '4610', name: 'Geschenke abzugsfähig', typ: 'ausgabe', beschreibung: 'Geschenke an Kunden (bis 35€)', ist_standard: true, sortierung: 31 },
  { kontonummer: '4630', name: 'Repräsentationskosten', typ: 'ausgabe', beschreibung: 'Bewirtung, Kundenpflege (70% abzugsfähig)', ist_standard: true, sortierung: 32 },

  // Reisekosten
  { kontonummer: '4653', name: 'Reisekosten Übernachtung', typ: 'ausgabe', beschreibung: 'Hotelkosten bei Dienstreisen', ist_standard: true, sortierung: 40 },
  { kontonummer: '4654', name: 'Reisekosten Verpflegung', typ: 'ausgabe', beschreibung: 'Verpflegungsmehraufwand', ist_standard: true, sortierung: 41 },
  { kontonummer: '4673', name: 'Fahrtkosten', typ: 'ausgabe', beschreibung: 'Fahrtkosten (nicht Kfz), Kilometergeld', ist_standard: true, sortierung: 42 },

  // Fremdleistungen
  { kontonummer: '4780', name: 'Fremdleistungen', typ: 'ausgabe', beschreibung: 'Externe Dienstleistungen, Subunternehmer', ist_standard: true, sortierung: 50 },
  { kontonummer: '4790', name: 'Auftragskosten', typ: 'ausgabe', beschreibung: 'Sonstige Auftragskosten', ist_standard: true, sortierung: 51 },

  // Wartung und Reparatur
  { kontonummer: '4805', name: 'Reparatur/Instandhaltung', typ: 'ausgabe', beschreibung: 'Reparaturen, Wartung von Anlagen/Geräten', ist_standard: true, sortierung: 55 },

  // Porto und Telefon
  { kontonummer: '4830', name: 'Porto/Versand', typ: 'ausgabe', beschreibung: 'Portokosten, Paketversand', ist_standard: true, sortierung: 60 },
  { kontonummer: '4855', name: 'Bankgebühren', typ: 'ausgabe', beschreibung: 'Kontoführung, Überweisungsgebühren', ist_standard: true, sortierung: 61 },
  { kontonummer: '4920', name: 'Telefon/Internet', typ: 'ausgabe', beschreibung: 'Telefon, Mobilfunk, Internet', ist_standard: true, sortierung: 62 },

  // Büro und Material
  { kontonummer: '4930', name: 'Bürobedarf', typ: 'ausgabe', beschreibung: 'Büromaterial, Druckerkosten, Papier', ist_standard: true, sortierung: 70 },
  { kontonummer: '4940', name: 'Zeitschriften/Bücher', typ: 'ausgabe', beschreibung: 'Fachliteratur, Fachzeitschriften', ist_standard: true, sortierung: 71 },
  { kontonummer: '4946', name: 'Fortbildungskosten', typ: 'ausgabe', beschreibung: 'Seminare, Lehrgänge, Lizenzen, Zertifikate', ist_standard: true, sortierung: 72 },
  { kontonummer: '4950', name: 'Rechts-/Beratungskosten', typ: 'ausgabe', beschreibung: 'Steuerberater, Rechtsanwalt, Beratung', ist_standard: true, sortierung: 73 },

  // Versicherungen und Beiträge
  { kontonummer: '4360', name: 'Versicherungen', typ: 'ausgabe', beschreibung: 'Betriebliche Versicherungen, Haftpflicht', ist_standard: true, sortierung: 80 },
  { kontonummer: '4380', name: 'Beiträge/Gebühren', typ: 'ausgabe', beschreibung: 'Verbandsbeiträge, Mitgliedschaften, Gebühren', ist_standard: true, sortierung: 81 },

  // Abschreibungen
  { kontonummer: '4822', name: 'Abschreibungen Sachanlagen', typ: 'ausgabe', beschreibung: 'AfA auf Sachanlagen', ist_standard: true, sortierung: 85 },
  { kontonummer: '4824', name: 'Sofortabschreibung GWG', typ: 'ausgabe', beschreibung: 'Geringwertige Wirtschaftsgüter (bis 800€ netto)', ist_standard: true, sortierung: 86 },

  // Sonstige Aufwendungen
  { kontonummer: '4900', name: 'Sonstige Aufwendungen', typ: 'ausgabe', beschreibung: 'Sonstige betriebliche Aufwendungen', ist_standard: true, sortierung: 90 },
  { kontonummer: '4560', name: 'Betriebsbedarf/Material', typ: 'ausgabe', beschreibung: 'Verbrauchsmaterial, Tennisbälle, Trainingsgeräte', ist_standard: true, sortierung: 91 },

  // ============ PRIVATKONTEN (Klasse 1) ============
  { kontonummer: '1800', name: 'Privatentnahmen', typ: 'neutral', beschreibung: 'Private Entnahmen aus dem Betriebsvermögen', ist_standard: true, sortierung: 100 },
  { kontonummer: '1890', name: 'Privateinlagen', typ: 'neutral', beschreibung: 'Private Einlagen ins Betriebsvermögen', ist_standard: true, sortierung: 101 },
  { kontonummer: '1370', name: 'Durchlaufende Posten', typ: 'neutral', beschreibung: 'Durchlaufende Posten (keine Auswirkung auf Gewinn)', ist_standard: true, sortierung: 102 },
]
