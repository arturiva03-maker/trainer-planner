import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from './supabaseClient'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import type { User, Session } from '@supabase/supabase-js'
import type {
  TrainerProfile,
  Spieler,
  Tarif,
  Training,
  Trainer,
  MonthlyAdjustment,
  Notiz,
  PlanungSheet,
  PlanungData,
  Tab,
  SpielerTrainingPayment,
  PdfVorlage,
  Formular,
  FormularFeld,
  FormularAnmeldung
} from './types'
import { PDF_PLATZHALTER } from './types'
import {
  formatDate,
  formatDateGerman,
  formatTime,
  getWeekDates,
  getMonthString,
  calculateDuration,
  generateRechnungsnummer,
  WOCHENTAGE
} from './utils'

// ============ SCROLL PRESERVATION ============
// Einfacher globaler Mechanismus um Scroll-Position bei State-Updates zu erhalten
let savedScrollPosition: number | null = null

// Speichert die aktuelle Scroll-Position und stellt sie nach dem nächsten Render wieder her
const preserveScroll = () => {
  savedScrollPosition = window.scrollY
  // Stelle Position nach kurzem Delay wieder her (nach React-Render)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (savedScrollPosition !== null) {
        window.scrollTo(0, savedScrollPosition)
        savedScrollPosition = null
      }
    })
  })
}

// Tennis Logo Icon Component - Blau racket with ball
const TennisLogo = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Racket head */}
    <ellipse cx="26" cy="22" rx="18" ry="20" stroke="#3B82F6" strokeWidth="3" fill="none"/>
    {/* Racket strings horizontal */}
    <line x1="10" y1="16" x2="42" y2="16" stroke="#3B82F6" strokeWidth="1.5" opacity="0.6"/>
    <line x1="9" y1="22" x2="43" y2="22" stroke="#3B82F6" strokeWidth="1.5" opacity="0.6"/>
    <line x1="10" y1="28" x2="42" y2="28" stroke="#3B82F6" strokeWidth="1.5" opacity="0.6"/>
    {/* Racket strings vertical */}
    <line x1="18" y1="4" x2="18" y2="40" stroke="#3B82F6" strokeWidth="1.5" opacity="0.6"/>
    <line x1="26" y1="2" x2="26" y2="42" stroke="#3B82F6" strokeWidth="1.5" opacity="0.6"/>
    <line x1="34" y1="4" x2="34" y2="40" stroke="#3B82F6" strokeWidth="1.5" opacity="0.6"/>
    {/* Racket handle */}
    <rect x="22" y="40" width="8" height="20" rx="2" fill="#3B82F6"/>
    <rect x="22" y="44" width="8" height="3" fill="#2563EB"/>
    <rect x="22" y="50" width="8" height="3" fill="#2563EB"/>
    {/* Tennis ball */}
    <circle cx="50" cy="14" r="10" fill="#a3e635"/>
    <path d="M43 8 Q50 14 43 20" stroke="white" strokeWidth="2" fill="none"/>
    <path d="M57 8 Q50 14 57 20" stroke="white" strokeWidth="2" fill="none"/>
  </svg>
)

// ============ FEATURE DETAILS DATA ============
const featureDetails = {
  terminplanung: {
    icon: '📅',
    title: 'Terminplanung',
    subtitle: 'Behalte den Überblick über alle Trainingseinheiten',
    features: [
      { icon: '📆', title: 'Wochenkalender', desc: 'Übersichtliche Wochenansicht mit allen Terminen auf einen Blick' },
      { icon: '📋', title: 'Tagesansicht', desc: 'Detaillierte Tagesplanung mit Zeitslots und Spielerinformationen' },
      { icon: '🔄', title: 'Serientermine', desc: 'Erstelle wiederkehrende Trainings für regelmäßige Gruppen' },
      { icon: '✅', title: 'Status-Tracking', desc: 'Markiere Trainings als geplant, durchgeführt oder abgesagt' },
      { icon: '📝', title: 'Notizen', desc: 'Füge Notizen zu einzelnen Trainingseinheiten hinzu' },
      { icon: '👥', title: 'Gruppentraining', desc: 'Plane Einzel- oder Gruppentrainings mit mehreren Spielern' }
    ]
  },
  spieler: {
    icon: '👥',
    title: 'Spieler & Tarife',
    subtitle: 'Zentrale Verwaltung aller Spieler und Preismodelle',
    features: [
      { icon: '📇', title: 'Spielerdatenbank', desc: 'Speichere alle Spieler mit Kontaktdaten und Notizen' },
      { icon: '📧', title: 'Kontaktdaten', desc: 'E-Mail und Telefonnummer für schnelle Kommunikation' },
      { icon: '🏠', title: 'Rechnungsadressen', desc: 'Individuelle Rechnungsadressen und -empfänger pro Spieler' },
      { icon: '💵', title: 'Flexible Tarife', desc: 'Erstelle verschiedene Tarife für unterschiedliche Trainingsarten' },
      { icon: '📊', title: 'Abrechnungsmodelle', desc: 'Pro Training, pro Spieler oder monatliche Pauschalen' },
      { icon: '🔗', title: 'Verknüpfungen', desc: 'Verknüpfe Spieler für gemeinsame Rechnungen (z.B. Geschwister)' }
    ]
  },
  abrechnung: {
    icon: '💰',
    title: 'Abrechnung',
    subtitle: 'Professionelle Rechnungen mit wenigen Klicks',
    features: [
      { icon: '🧾', title: 'PDF-Rechnungen', desc: 'Professionelle Rechnungen automatisch als PDF erstellen' },
      { icon: '📬', title: 'E-Mail-Versand', desc: 'Rechnungen direkt per E-Mail an Spieler versenden' },
      { icon: '⏳', title: 'Offene Posten', desc: 'Überblick über ausstehende Zahlungen pro Monat' },
      { icon: '✔️', title: 'Zahlungsverfolgung', desc: 'Markiere Rechnungen als bezahlt (Bar oder Überweisung)' },
      { icon: '📑', title: 'Manuelle Rechnungen', desc: 'Erstelle individuelle Rechnungen für Platzmiete etc.' },
      { icon: '📈', title: 'Statistiken', desc: 'Monatliche Übersicht über Umsätze und offene Beträge' }
    ]
  }
}

type FeatureKey = keyof typeof featureDetails

// ============ AUTH COMPONENT ============
function AuthScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedFeature, setSelectedFeature] = useState<FeatureKey | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (data.user) onLogin(data.user)
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.user) {
          // Create trainer profile
          await supabase.from('trainer_profiles').insert({
            user_id: data.user.id,
            name: name,
            stundensatz: 25,
            kleinunternehmer: false,
            approved: false
          })
          onLogin(data.user)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      {/* Info-Bereich links */}
      <div className="auth-info">
        <div className="auth-info-content">
          <div className="auth-logo">
            <span className="auth-logo-icon"><TennisLogo size={48} /></span>
            <h1>Tennis Trainer Planner</h1>
          </div>
          <p className="auth-tagline">Die All-in-One Verwaltung für Tennistrainer</p>

          <div className="auth-features">
            <div className="auth-feature" onClick={() => setSelectedFeature('terminplanung')}>
              <span className="auth-feature-icon">📅</span>
              <div>
                <strong>Terminplanung</strong>
                <p>Kalender mit Wochen- und Tagesansicht, Serientermine und Status-Tracking</p>
              </div>
              <span className="auth-feature-arrow">→</span>
            </div>
            <div className="auth-feature" onClick={() => setSelectedFeature('spieler')}>
              <span className="auth-feature-icon">👥</span>
              <div>
                <strong>Spieler & Tarife</strong>
                <p>Verwalte Spieler, Kontaktdaten und flexible Tarifmodelle</p>
              </div>
              <span className="auth-feature-arrow">→</span>
            </div>
            <div className="auth-feature" onClick={() => setSelectedFeature('abrechnung')}>
              <span className="auth-feature-icon">💰</span>
              <div>
                <strong>Abrechnung</strong>
                <p>Automatische Rechnungserstellung, offene Posten und Zahlungsverfolgung</p>
              </div>
              <span className="auth-feature-arrow">→</span>
            </div>
          </div>
        </div>
      </div>

      {/* Login-Box rechts */}
      <div className="auth-form-container">
        <div className="auth-box">
          <h2>{isLogin ? 'Willkommen zurück!' : 'Konto erstellen'}</h2>
          <p className="auth-subtitle">{isLogin ? 'Melde dich an, um fortzufahren' : 'Starte jetzt mit deiner Trainerverwaltung'}</p>

          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                  placeholder="Dein Name"
                />
              </div>
            )}
            <div className="form-group">
              <label>E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="email@beispiel.de"
              />
            </div>
            <div className="form-group">
              <label>Passwort</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                minLength={6}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Laden...' : isLogin ? 'Anmelden' : 'Registrieren'}
            </button>
          </form>
          <div className="auth-toggle">
            {isLogin ? 'Noch kein Konto?' : 'Bereits registriert?'}
            <button onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? ' Registrieren' : ' Anmelden'}
            </button>
          </div>
        </div>
      </div>

      {/* Feature Detail Modal */}
      {selectedFeature && (
        <div className="feature-modal-overlay" onClick={() => setSelectedFeature(null)}>
          <div className="feature-modal" onClick={e => e.stopPropagation()}>
            <button className="feature-modal-close" onClick={() => setSelectedFeature(null)}>×</button>
            <div className="feature-modal-header">
              <span className="feature-modal-icon">{featureDetails[selectedFeature].icon}</span>
              <div>
                <h2>{featureDetails[selectedFeature].title}</h2>
                <p>{featureDetails[selectedFeature].subtitle}</p>
              </div>
            </div>
            <div className="feature-modal-grid">
              {featureDetails[selectedFeature].features.map((feature, index) => (
                <div key={index} className="feature-modal-item">
                  <span className="feature-modal-item-icon">{feature.icon}</span>
                  <div>
                    <strong>{feature.title}</strong>
                    <p>{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ CONFIRM DIALOG ============
function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Löschen',
  cancelText = 'Abbrechen',
  onConfirm,
  onCancel,
  variant = 'danger'
}: {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'danger' | 'warning' | 'primary'
}) {
  if (!isOpen) return null

  const buttonClass = variant === 'danger' ? 'btn-danger' : variant === 'warning' ? 'btn-warning' : 'btn-primary'

  return (
    <div className="modal-overlay" onClick={onCancel} style={{ zIndex: 10000 }}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontSize: 28,
              width: 44,
              height: 44,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: variant === 'danger' ? 'var(--danger-light)' : variant === 'warning' ? 'var(--warning-light)' : 'var(--primary-light)'
            }}>
              {variant === 'danger' ? '🗑️' : variant === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            {title}
          </h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        <div className="modal-body" style={{ paddingTop: 8 }}>
          <p style={{ color: 'var(--gray-600)', margin: 0, fontSize: 15 }}>{message}</p>
        </div>
        <div className="modal-footer" style={{ borderTop: 'none', paddingTop: 8, gap: 12 }}>
          <button className="btn btn-secondary" onClick={onCancel} style={{ flex: 1 }}>
            {cancelText}
          </button>
          <button className={`btn ${buttonClass}`} onClick={onConfirm} style={{ flex: 1 }}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

// Globaler Confirm-State
let confirmResolve: ((value: boolean) => void) | null = null
let setConfirmState: React.Dispatch<React.SetStateAction<{
  isOpen: boolean
  title: string
  message: string
  confirmText: string
  variant: 'danger' | 'warning' | 'primary'
}>> | null = null

const showConfirm = (title: string, message: string, confirmText = 'Löschen', variant: 'danger' | 'warning' | 'primary' = 'danger'): Promise<boolean> => {
  return new Promise((resolve) => {
    confirmResolve = resolve
    if (setConfirmState) {
      setConfirmState({ isOpen: true, title, message, confirmText, variant })
    }
  })
}

// ============ MAIN APP COMPONENT ============
function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [publicFormId, setPublicFormId] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    confirmText: string
    variant: 'danger' | 'warning' | 'primary'
  }>({ isOpen: false, title: '', message: '', confirmText: 'Löschen', variant: 'danger' })

  // URL-Detection für öffentliche Formulare
  useEffect(() => {
    const path = window.location.pathname
    const match = path.match(/^\/anmeldung\/([a-f0-9-]+)$/i)
    if (match) {
      setPublicFormId(match[1])
    }
  }, [])

  // Registriere setConfirmState global
  useEffect(() => {
    setConfirmState = setConfirmDialog
    return () => { setConfirmState = null }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Öffentliches Formular anzeigen (ohne Login)
  if (publicFormId) {
    return <PublicFormularView formularId={publicFormId} />
  }

  if (loading) {
    return <div className="loading">Laden...</div>
  }

  if (!session) {
    return <AuthScreen onLogin={() => {}} />
  }

  const handleConfirm = () => {
    if (confirmResolve) {
      confirmResolve(true)
      confirmResolve = null
    }
    setConfirmDialog(prev => ({ ...prev, isOpen: false }))
  }

  const handleCancel = () => {
    if (confirmResolve) {
      confirmResolve(false)
      confirmResolve = null
    }
    setConfirmDialog(prev => ({ ...prev, isOpen: false }))
  }

  return (
    <>
      <MainApp user={session.user} />
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  )
}

// ============ MAIN APP WITH TABS ============
function MainApp({ user }: { user: User }) {
  const [activeTab, setActiveTab] = useState<Tab>('kalender')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Navigation zum Kalender mit Training-Bearbeitung
  const [navigateToTraining, setNavigateToTraining] = useState<Training | null>(null)

  // Data states
  const [profile, setProfile] = useState<TrainerProfile | null>(null)
  const [spieler, setSpieler] = useState<Spieler[]>([])
  const [tarife, setTarife] = useState<Tarif[]>([])
  const [trainings, setTrainings] = useState<Training[]>([])
  const [trainer, setTrainer] = useState<Trainer[]>([])
  const [adjustments, setAdjustments] = useState<MonthlyAdjustment[]>([])
  const [spielerPayments, setSpielerPayments] = useState<SpielerTrainingPayment[]>([])
  const [notizen, setNotizen] = useState<Notiz[]>([])
  const [planungSheets, setPlanungSheets] = useState<PlanungSheet[]>([])
  const [pdfVorlagen, setPdfVorlagen] = useState<PdfVorlage[]>([])
  const [formulare, setFormulare] = useState<Formular[]>([])
  const [formularAnmeldungen, setFormularAnmeldungen] = useState<FormularAnmeldung[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  // Persistenter Navigation-State (wird nicht bei Daten-Refresh zurückgesetzt)
  const [kalenderDate, setKalenderDate] = useState(new Date())

  // Load all data
  useEffect(() => {
    loadAllData()
  }, [user.id])

  const loadAllData = async () => {
    setDataLoading(true)
    try {
      const [
        profileRes,
        spielerRes,
        tarifeRes,
        trainingsRes,
        trainerRes,
        adjustmentsRes,
        notizenRes,
        planungRes,
        spielerPaymentsRes,
        pdfVorlagenRes,
        formulareRes,
        formularAnmeldungenRes
      ] = await Promise.all([
        supabase.from('trainer_profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('spieler').select('*').eq('user_id', user.id).order('name'),
        supabase.from('tarife').select('*').eq('user_id', user.id).order('name'),
        supabase.from('trainings').select('*').eq('user_id', user.id).order('datum', { ascending: false }),
        supabase.from('trainer').select('*').eq('user_id', user.id).order('name'),
        supabase.from('monthly_adjustments').select('*').eq('user_id', user.id),
        supabase.from('notizen').select('*').eq('user_id', user.id).order('erstellt_am', { ascending: false }),
        supabase.from('planung_sheets').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('spieler_training_payments').select('*').eq('user_id', user.id),
        supabase.from('pdf_vorlagen').select('*').eq('user_id', user.id).order('name'),
        supabase.from('formulare').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('formular_anmeldungen').select('*')
      ])

      if (profileRes.data) setProfile(profileRes.data)
      if (spielerRes.data) setSpieler(spielerRes.data)
      if (tarifeRes.data) setTarife(tarifeRes.data)
      if (trainingsRes.data) setTrainings(trainingsRes.data)
      if (trainerRes.data) setTrainer(trainerRes.data)
      if (adjustmentsRes.data) setAdjustments(adjustmentsRes.data)
      if (spielerPaymentsRes.data) setSpielerPayments(spielerPaymentsRes.data)
      if (notizenRes.data) setNotizen(notizenRes.data)
      if (planungRes.data) setPlanungSheets(planungRes.data)
      if (pdfVorlagenRes.data) setPdfVorlagen(pdfVorlagenRes.data)
      if (formulareRes.data) setFormulare(formulareRes.data)
      if (formularAnmeldungenRes.data) setFormularAnmeldungen(formularAnmeldungenRes.data)
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setDataLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  // Navigation zum Kalender mit Bearbeitungsmodus für ein Training
  const handleNavigateToTraining = (training: Training) => {
    setNavigateToTraining(training)
    setActiveTab('kalender')
  }

  // Anzahl ungelesener Anmeldungen für Badge
  const ungeleseneAnmeldungen = useMemo(() => {
    const formularIds = formulare.map(f => f.id)
    return formularAnmeldungen.filter(a => formularIds.includes(a.formular_id) && !a.gelesen).length
  }, [formulare, formularAnmeldungen])

  const baseTabs = [
    { id: 'kalender' as Tab, label: 'Kalender', icon: '📅' },
    { id: 'verwaltung' as Tab, label: 'Verwaltung', icon: '👥' },
    { id: 'abrechnung' as Tab, label: 'Abrechnung', icon: '💰' },
    { id: 'formulare' as Tab, label: 'Formulare', icon: '📝', badge: ungeleseneAnmeldungen > 0 ? ungeleseneAnmeldungen : undefined },
  ]

  // Dynamisch Abrechnung Trainer Tab hinzufügen wenn Trainer vorhanden
  const tabs = trainer.length > 0
    ? [...baseTabs,
        { id: 'abrechnung-trainer' as Tab, label: 'Abr. Trainer', icon: '👨‍🏫' },
        { id: 'planung' as Tab, label: 'Planung', icon: '📋' },
        { id: 'weiteres' as Tab, label: 'Weiteres', icon: '⚙️' }
      ]
    : [...baseTabs,
        { id: 'planung' as Tab, label: 'Planung', icon: '📋' },
        { id: 'weiteres' as Tab, label: 'Weiteres', icon: '⚙️' }
      ]

  // Haupt-Tabs für die mobile Bottom-Navigation (max 5 für bessere UX)
  const mobileNavTabs = [
    { id: 'kalender' as Tab, label: 'Kalender', icon: '📅' },
    { id: 'verwaltung' as Tab, label: 'Verwalten', icon: '👥' },
    { id: 'abrechnung' as Tab, label: 'Rechnung', icon: '💰' },
    { id: 'formulare' as Tab, label: 'Formulare', icon: '📝' },
    { id: 'weiteres' as Tab, label: 'Mehr', icon: '⚙️' }
  ]

  // Warte-Bildschirm für nicht freigeschaltete User
  if (!dataLoading && profile && profile.approved !== true) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2>Warten auf Freischaltung</h2>
          <p style={{ marginBottom: 16, color: 'var(--gray-600)' }}>
            Dein Account wurde erfolgreich erstellt, aber noch nicht freigeschaltet.
          </p>
          <p style={{ marginBottom: 24, color: 'var(--gray-600)' }}>
            Bitte warte, bis der Administrator deinen Zugang aktiviert hat.
          </p>
          <div style={{ padding: 16, background: 'var(--gray-100)', borderRadius: 8, marginBottom: 24 }}>
            <div><strong>Name:</strong> {profile.name}</div>
            <div><strong>E-Mail:</strong> {user.email}</div>
          </div>
          <button className="btn btn-secondary btn-block" onClick={handleLogout}>
            Abmelden
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      {/* Mobile Header */}
      <div className="mobile-header">
        <TennisLogo size={36} />
        <div className="header-content">
          <h1 className="header-title">CourtPro</h1>
          <p className="header-subtitle">{profile?.name || 'Trainer'}</p>
        </div>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <TennisLogo size={32} />
          <h2>CourtPro</h2>
        </div>
        <nav className="sidebar-nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id)
                setSidebarOpen(false)
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="btn btn-secondary btn-block" onClick={handleLogout}>
            Abmelden
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav">
        <div className="mobile-bottom-nav-inner">
          {mobileNavTabs.map((tab) => (
            <button
              key={tab.id}
              className={`mobile-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="nav-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        {dataLoading ? (
          <div className="loading">Daten werden geladen...</div>
        ) : (
          <>
            {activeTab === 'kalender' && (
              <KalenderView
                trainings={trainings}
                spieler={spieler}
                tarife={tarife}
                onUpdate={loadAllData}
                userId={user.id}
                navigateToTraining={navigateToTraining}
                onNavigateComplete={() => setNavigateToTraining(null)}
                currentDate={kalenderDate}
                onDateChange={setKalenderDate}
              />
            )}
            {activeTab === 'verwaltung' && (
              <VerwaltungView
                spieler={spieler}
                tarife={tarife}
                trainer={trainer}
                onUpdate={loadAllData}
                userId={user.id}
              />
            )}
            {activeTab === 'abrechnung' && (
              <AbrechnungView
                trainings={trainings}
                spieler={spieler}
                tarife={tarife}
                adjustments={adjustments}
                spielerPayments={spielerPayments}
                setSpielerPayments={setSpielerPayments}
                profile={profile}
                pdfVorlagen={pdfVorlagen}
                onUpdate={loadAllData}
                onNavigateToTraining={handleNavigateToTraining}
                userId={user.id}
              />
            )}
            {activeTab === 'abrechnung-trainer' && trainer.length > 0 && (
              <AbrechnungTrainerView
                trainings={trainings}
                trainer={trainer}
                onUpdate={loadAllData}
                userId={user.id}
              />
            )}
            {activeTab === 'planung' && (
              <PlanungView
                planungSheets={planungSheets}
                trainings={trainings}
                spieler={spieler}
                onUpdate={loadAllData}
                userId={user.id}
              />
            )}
            {activeTab === 'formulare' && (
              <FormulareView
                formulare={formulare}
                anmeldungen={formularAnmeldungen}
                onUpdate={loadAllData}
                userId={user.id}
              />
            )}
            {activeTab === 'weiteres' && (
              <WeiteresView
                profile={profile}
                notizen={notizen}
                pdfVorlagen={pdfVorlagen}
                onUpdate={loadAllData}
                userId={user.id}
                onNavigate={setActiveTab}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}

// ============ KALENDER VIEW ============
function KalenderView({
  trainings,
  spieler,
  tarife,
  onUpdate,
  userId,
  navigateToTraining,
  onNavigateComplete,
  currentDate,
  onDateChange
}: {
  trainings: Training[]
  spieler: Spieler[]
  tarife: Tarif[]
  onUpdate: () => void
  userId: string
  navigateToTraining?: Training | null
  onNavigateComplete?: () => void
  currentDate: Date
  onDateChange: (date: Date) => void
}) {
  const [viewMode, setViewMode] = useState<'week' | 'day'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'week'
  )
  const [editingTraining, setEditingTraining] = useState<Training | null>(null)
  const [selectedTrainingIds, setSelectedTrainingIds] = useState<Set<string>>(new Set())

  // Navigation von Abrechnung: Zum Training-Datum springen und Bearbeitung öffnen
  useEffect(() => {
    if (navigateToTraining) {
      const trainingDate = new Date(navigateToTraining.datum + 'T12:00:00')
      onDateChange(trainingDate)
      setEditingTraining(navigateToTraining)
      onNavigateComplete?.()
    }
  }, [navigateToTraining, onNavigateComplete, onDateChange])

  // Automatisch zwischen Tag- und Wochenansicht wechseln bei Resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setViewMode('day')
      } else {
        setViewMode('week')
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate])
  const timeSlots = useMemo(() => {
    const slots = []
    for (let h = 7; h <= 21; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`)
    }
    return slots
  }, [])

  const trainingsForWeek = useMemo(() => {
    const start = formatDate(weekDates[0])
    const end = formatDate(weekDates[6])
    return trainings.filter((t) => t.datum >= start && t.datum <= end)
  }, [trainings, weekDates])

  const getTrainingsForDay = (date: Date) => {
    const dateStr = formatDate(date)
    return trainingsForWeek.filter((t) => t.datum === dateStr)
  }

  // Gibt Spielernamen mit durchgestrichenen entfernten Spielern zurück
  const getTrainingDisplayTitle = (training: Training, vornameOnly = false) => {
    const aktiveSpieler = training.spieler_ids.map(id => {
      const name = spieler.find(s => s.id === id)?.name || 'Unbekannt'
      return { name: vornameOnly ? name.split(' ')[0] : name, entfernt: false }
    })

    const entfernteSpieler = (training.entfernte_spieler || []).map(es => {
      const name = spieler.find(s => s.id === es.spieler_id)?.name || 'Unbekannt'
      return { name: vornameOnly ? name.split(' ')[0] : name, entfernt: true }
    })

    const alleSpieler = [...aktiveSpieler, ...entfernteSpieler]

    if (alleSpieler.length === 0) return null

    return (
      <>
        {alleSpieler.map((s, i) => (
          <span key={i}>
            {i > 0 && ', '}
            <span style={s.entfernt ? { textDecoration: 'line-through', opacity: 0.7 } : undefined}>
              {s.name}
            </span>
          </span>
        ))}
      </>
    )
  }

  const getTarifName = (tarifId?: string) => {
    if (!tarifId) return null
    return tarife.find((t) => t.id === tarifId)?.name
  }

  const getTrainingPosition = (training: Training, isDayView: boolean) => {
    const [startH, startM] = training.uhrzeit_von.split(':').map(Number)
    const [endH, endM] = training.uhrzeit_bis.split(':').map(Number)
    const cellHeight = isDayView ? 50 : 60
    const startMinutes = startH * 60 + startM - 7 * 60
    const endMinutes = endH * 60 + endM - 7 * 60
    const top = (startMinutes / 60) * cellHeight
    const height = ((endMinutes - startMinutes) / 60) * cellHeight
    return { top, height: Math.max(height, isDayView ? 40 : 30) }
  }

  // Berechnet Layout für überlappende Trainings (nebeneinander)
  const getOverlapLayout = (dayTrainings: Training[]) => {
    const layout: { [trainingId: string]: { column: number, totalColumns: number } } = {}

    // Sortiere nach Startzeit
    const sorted = [...dayTrainings].sort((a, b) => {
      const aStart = a.uhrzeit_von.split(':').map(Number)
      const bStart = b.uhrzeit_von.split(':').map(Number)
      return (aStart[0] * 60 + aStart[1]) - (bStart[0] * 60 + bStart[1])
    })

    // Finde überlappende Gruppen
    const groups: Training[][] = []

    sorted.forEach(training => {
      const [startH, startM] = training.uhrzeit_von.split(':').map(Number)
      const [endH, endM] = training.uhrzeit_bis.split(':').map(Number)
      const start = startH * 60 + startM
      const end = endH * 60 + endM

      // Finde Gruppe die mit diesem Training überlappt
      let foundGroup = false
      for (const group of groups) {
        const overlaps = group.some(t => {
          const [tStartH, tStartM] = t.uhrzeit_von.split(':').map(Number)
          const [tEndH, tEndM] = t.uhrzeit_bis.split(':').map(Number)
          const tStart = tStartH * 60 + tStartM
          const tEnd = tEndH * 60 + tEndM
          return start < tEnd && end > tStart
        })
        if (overlaps) {
          group.push(training)
          foundGroup = true
          break
        }
      }
      if (!foundGroup) {
        groups.push([training])
      }
    })

    // Weise Spalten zu
    groups.forEach(group => {
      const columns: Training[][] = []

      group.forEach(training => {
        const [startH, startM] = training.uhrzeit_von.split(':').map(Number)
        const start = startH * 60 + startM

        // Finde erste freie Spalte
        let placed = false
        for (let col = 0; col < columns.length; col++) {
          const lastInCol = columns[col][columns[col].length - 1]
          const [lastEndH, lastEndM] = lastInCol.uhrzeit_bis.split(':').map(Number)
          const lastEnd = lastEndH * 60 + lastEndM

          if (start >= lastEnd) {
            columns[col].push(training)
            placed = true
            break
          }
        }
        if (!placed) {
          columns.push([training])
        }
      })

      // Setze Layout für jedes Training in der Gruppe
      columns.forEach((col, colIndex) => {
        col.forEach(training => {
          layout[training.id] = { column: colIndex, totalColumns: columns.length }
        })
      })
    })

    return layout
  }

  const navigateDay = (direction: number) => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + direction)
    onDateChange(newDate)
  }

  const handleDoubleClick = async (training: Training) => {
    preserveScroll()
    const newStatus = training.status === 'geplant' ? 'durchgefuehrt' : 'geplant'
    await supabase.from('trainings').update({ status: newStatus }).eq('id', training.id)
    onUpdate()
  }

  // Klick-Handler für Trainings (Strg+Klick = Mehrfachauswahl)
  const handleTrainingClick = (e: React.MouseEvent, training: Training) => {
    if (e.ctrlKey || e.metaKey) {
      // Strg/Cmd gedrückt: Training zur Auswahl hinzufügen/entfernen
      e.preventDefault()
      setSelectedTrainingIds(prev => {
        const newSet = new Set(prev)
        if (newSet.has(training.id)) {
          newSet.delete(training.id)
        } else {
          newSet.add(training.id)
        }
        return newSet
      })
    } else {
      // Normaler Klick: Auswahl aufheben und Training bearbeiten
      setSelectedTrainingIds(new Set())
      setEditingTraining(training)
    }
  }

  // Alle ausgewählten Trainings als durchgeführt markieren
  const handleMarkSelectedAsDurchgefuehrt = async () => {
    preserveScroll()
    const selectedTrainings = trainings.filter(t => selectedTrainingIds.has(t.id))

    for (const training of selectedTrainings) {
      if (training.status === 'durchgefuehrt') continue // Schon durchgeführt
      await supabase.from('trainings').update({ status: 'durchgefuehrt' }).eq('id', training.id)
    }

    setSelectedTrainingIds(new Set())
    onUpdate()
  }

  // Auswahl aufheben mit Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedTrainingIds.size > 0) {
        setSelectedTrainingIds(new Set())
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedTrainingIds.size])

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + direction * 7)
    onDateChange(newDate)
  }

  const goToToday = () => {
    onDateChange(new Date())
  }

  const isDayView = viewMode === 'day'
  const cellHeight = isDayView ? 50 : 60
  const [showAddTraining, setShowAddTraining] = useState(false)

  // Swipe-Handling für Mobile
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd || !isDayView) return // Nur in Tagesansicht aktiv
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) {
      // Swipe nach links = nächster Tag
      navigateDay(1)
    } else if (isRightSwipe) {
      // Swipe nach rechts = vorheriger Tag
      navigateDay(-1)
    }
  }

  return (
    <div>
      <div className="calendar-container">
        <div className="calendar-header">
          <div className="calendar-nav">
            <button onClick={() => isDayView ? navigateDay(-1) : navigateWeek(-1)}>←</button>
            <div className="calendar-nav-center">
              <h3>
                {isDayView
                  ? currentDate.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' })
                  : `${weekDates[0].toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} - ${weekDates[6].toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}`
                }
              </h3>
              <button
                className={`btn btn-sm ${formatDate(currentDate) === formatDate(new Date()) ? 'btn-primary' : 'btn-secondary'}`}
                onClick={goToToday}
                style={{ marginTop: 4 }}
              >
                Heute
              </button>
            </div>
            <button onClick={() => isDayView ? navigateDay(1) : navigateWeek(1)}>→</button>
          </div>
          <div className="view-toggle">
            <button
              className={`btn ${viewMode === 'week' ? 'btn-primary' : ''}`}
              onClick={() => setViewMode('week')}
            >
              Woche
            </button>
            <button
              className={`btn ${viewMode === 'day' ? 'btn-primary' : ''}`}
              onClick={() => setViewMode('day')}
            >
              Tag
            </button>
            <button className="btn btn-success" onClick={() => setShowAddTraining(true)}>
              + Neu
            </button>
          </div>
        </div>

        {/* Aktionsleiste bei Mehrfachauswahl */}
        {selectedTrainingIds.size > 0 && (
          <div className="selection-action-bar">
            <span>{selectedTrainingIds.size} Training{selectedTrainingIds.size > 1 ? 's' : ''} ausgewählt</span>
            <div className="selection-actions">
              <button
                className="btn btn-success"
                onClick={handleMarkSelectedAsDurchgefuehrt}
              >
                Als durchgeführt markieren
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedTrainingIds(new Set())}
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        <div
          className="calendar-scroll-container"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {isDayView && <div className="swipe-hint mobile-only"></div>}
          <div className={`calendar-grid ${isDayView ? 'day-view' : ''}`}>
            {/* Header Row - only for week view */}
            {!isDayView && (
              <>
                <div className="calendar-header-cell"></div>
                {weekDates.map((date, i) => (
                  <div key={i} className="calendar-header-cell">
                    <div>{WOCHENTAGE[i]}</div>
                    <div>{date.getDate()}.{date.getMonth() + 1}</div>
                  </div>
                ))}
              </>
            )}

            {/* Time Rows */}
            {timeSlots.map((time) => (
              <div key={`row-${time}`} style={{ display: 'contents' }}>
                <div className="calendar-time-cell">{time}</div>
                {(isDayView ? [currentDate] : weekDates).map((date, dayIndex) => {
                  const dayTrainings = getTrainingsForDay(date)
                  const overlapLayout = getOverlapLayout(dayTrainings)
                  const slotTrainings = dayTrainings.filter((t) => {
                    const [h] = t.uhrzeit_von.split(':').map(Number)
                    return h === parseInt(time)
                  })

                  return (
                    <div key={`cell-${dayIndex}-${time}`} className="calendar-day-cell">
                      {slotTrainings.map((training) => {
                        const pos = getTrainingPosition(training, isDayView)
                        const tarifName = getTarifName(training.tarif_id)
                        const layout = overlapLayout[training.id] || { column: 0, totalColumns: 1 }
                        const width = 100 / layout.totalColumns
                        const left = layout.column * width
                        const isSelected = selectedTrainingIds.has(training.id)
                        return (
                          <div
                            key={training.id}
                            className={`training-block status-${training.status}${isSelected ? ' selected' : ''}`}
                            style={{
                              top: pos.top % cellHeight,
                              height: pos.height,
                              left: `${left}%`,
                              width: `${width}%`
                            }}
                            onClick={(e) => handleTrainingClick(e, training)}
                            onDoubleClick={() => handleDoubleClick(training)}
                          >
                            <div className="training-title">{training.name || getTrainingDisplayTitle(training, true)}</div>
                            <div className="training-time">
                              {formatTime(training.uhrzeit_von)} - {formatTime(training.uhrzeit_bis)}
                            </div>
                            {isDayView && tarifName && (
                              <div className="training-tarif">{tarifName}</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Training Modal */}
      {editingTraining && (
        <TrainingModal
          training={editingTraining}
          spieler={spieler}
          tarife={tarife}
          userId={userId}
          onClose={() => setEditingTraining(null)}
          onSave={() => {
            setEditingTraining(null)
            onUpdate()
          }}
        />
      )}

      {/* Add Training Modal */}
      {showAddTraining && (
        <TrainingModal
          spieler={spieler}
          tarife={tarife}
          userId={userId}
          initialDate={formatDate(currentDate)}
          onClose={() => setShowAddTraining(false)}
          onSave={() => {
            setShowAddTraining(false)
            onUpdate()
          }}
        />
      )}
    </div>
  )
}

// ============ TRAINING MODAL ============
function TrainingModal({
  training,
  spieler,
  tarife,
  userId,
  initialDate,
  onClose,
  onSave
}: {
  training?: Training
  spieler: Spieler[]
  tarife: Tarif[]
  userId: string
  initialDate?: string
  onClose: () => void
  onSave: () => void
}) {
  const [datum, setDatum] = useState(training?.datum || initialDate || formatDate(new Date()))
  const [uhrzeitVon, setUhrzeitVon] = useState(training?.uhrzeit_von || '09:00')
  const [uhrzeitBis, setUhrzeitBis] = useState(training?.uhrzeit_bis || '10:00')
  const [selectedSpieler, setSelectedSpieler] = useState<string[]>(training?.spieler_ids || [])
  const [entfernteSpieler, setEntfernteSpieler] = useState<{spieler_id: string, muss_bezahlen: boolean, entfernt_am: string}[]>(training?.entfernte_spieler || [])
  const [tarifId, setTarifId] = useState(training?.tarif_id || '')
  const [status, setStatus] = useState<Training['status']>(training?.status || 'geplant')
  const [notiz, setNotiz] = useState(training?.notiz || '')
  const [trainingName, setTrainingName] = useState(training?.name || '')
  const [barBezahlt, setBarBezahlt] = useState(training?.bar_bezahlt || false)
  const [customPreis, setCustomPreis] = useState(training?.custom_preis_pro_stunde?.toString() || '')
  const [wiederholen, setWiederholen] = useState(false)
  const [wiederholenBis, setWiederholenBis] = useState('2026-03-29')
  const [serienAktion, setSerienAktion] = useState<'einzeln' | 'nachfolgende'>('einzeln')
  const [saving, setSaving] = useState(false)
  const [spielerSuche, setSpielerSuche] = useState('')

  // State für Bezahl-Abfrage bei Spieler-Entfernung
  const [removeDialog, setRemoveDialog] = useState<{spielerId: string, spielerName: string} | null>(null)

  // State für Bezahl-Abfrage bei Löschen/Absagen
  const [cancelDialog, setCancelDialog] = useState<{type: 'delete' | 'cancel', previousStatus?: Training['status']} | null>(null)

  // Prüfen ob Training Teil einer Serie ist
  const istSerie = training?.serie_id != null

  // Abrechnungsart ermitteln
  const selectedTarif = tarife.find(t => t.id === tarifId)
  const abrechnungsart = selectedTarif?.abrechnung || 'proTraining'

  // Prüft ob Bezahl-Abfrage nötig ist (nur bei proTraining/proSpieler mit Spielern)
  const brauchtBezahlAbfrage = training &&
    (abrechnungsart === 'proTraining' || abrechnungsart === 'proSpieler') &&
    selectedSpieler.length > 0

  const toggleSpieler = async (id: string) => {
    const isRemoving = selectedSpieler.includes(id)

    // Nur bei existierendem Training und relevanter Abrechnungsart nachfragen
    if (isRemoving && training && (abrechnungsart === 'proTraining' || abrechnungsart === 'proSpieler')) {
      const spielerObj = spieler.find(s => s.id === id)
      setRemoveDialog({ spielerId: id, spielerName: spielerObj?.name || 'Spieler' })
    } else {
      // Direkt entfernen/hinzufügen ohne Abfrage
      setSelectedSpieler((prev) =>
        prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
      )
      // Bei Hinzufügen: aus entfernten Spielern wieder entfernen falls vorhanden
      if (!isRemoving) {
        setEntfernteSpieler(prev => prev.filter(es => es.spieler_id !== id))
      }
    }
  }

  const handleRemoveWithPayment = (mussBezahlen: boolean) => {
    if (!removeDialog) return

    // Spieler aus selectedSpieler entfernen
    setSelectedSpieler(prev => prev.filter(s => s !== removeDialog.spielerId))

    // Zu entfernten Spielern hinzufügen mit Bezahlstatus
    setEntfernteSpieler(prev => [
      ...prev.filter(es => es.spieler_id !== removeDialog.spielerId),
      {
        spieler_id: removeDialog.spielerId,
        muss_bezahlen: mussBezahlen,
        entfernt_am: new Date().toISOString()
      }
    ])

    setRemoveDialog(null)
  }

  const handleSave = async () => {
    // Bei abgesagten Trainings sind keine aktiven Spieler nötig
    if (selectedSpieler.length === 0 && status !== 'abgesagt') {
      alert('Bitte mindestens einen Spieler auswählen')
      return
    }

    if (!tarifId && !customPreis) {
      alert('Bitte einen Tarif auswählen oder einen individuellen Preis eingeben')
      return
    }

    setSaving(true)
    try {
      const trainingData = {
        user_id: userId,
        datum,
        uhrzeit_von: uhrzeitVon,
        uhrzeit_bis: uhrzeitBis,
        spieler_ids: selectedSpieler,
        entfernte_spieler: entfernteSpieler.length > 0 ? entfernteSpieler : null,
        tarif_id: tarifId || null,
        status,
        notiz: notiz || null,
        name: trainingName || null,
        bar_bezahlt: barBezahlt,
        custom_preis_pro_stunde: customPreis ? parseFloat(customPreis) : null
      }

      if (training) {
        if (serienAktion === 'nachfolgende' && training.serie_id) {
          // Alle nachfolgenden Trainings der Serie aktualisieren (gleicher Wochentag, >= Datum)
          const { data: serienTrainings } = await supabase
            .from('trainings')
            .select('id, datum')
            .eq('serie_id', training.serie_id)
            .gte('datum', training.datum)

          if (serienTrainings && serienTrainings.length > 0) {
            // Berechne den Tages-Offset vom Original
            const originalDate = new Date(training.datum)
            const neuesDate = new Date(datum)
            const tageOffset = Math.round((neuesDate.getTime() - originalDate.getTime()) / (1000 * 60 * 60 * 24))

            for (const t of serienTrainings) {
              const trainingsDate = new Date(t.datum)
              trainingsDate.setDate(trainingsDate.getDate() + tageOffset)

              await supabase.from('trainings').update({
                ...trainingData,
                datum: formatDate(trainingsDate)
              }).eq('id', t.id)
            }
          }
        } else {
          // Nur dieses eine Training aktualisieren
          await supabase.from('trainings').update(trainingData).eq('id', training.id)

          // Wenn bar_bezahlt geändert wurde, auch spielerPayments aktualisieren
          if (training.bar_bezahlt !== barBezahlt) {
            for (const spielerId of selectedSpieler) {
              await supabase
                .from('spieler_training_payments')
                .update({ bar_bezahlt: barBezahlt })
                .eq('training_id', training.id)
                .eq('spieler_id', spielerId)
            }
          }
        }
      } else if (wiederholen && wiederholenBis) {
        // Create series of trainings
        const serieId = crypto.randomUUID()
        const trainingsToCreate = []
        let currentDate = new Date(datum)
        const endDate = new Date(wiederholenBis)

        while (currentDate <= endDate) {
          trainingsToCreate.push({
            ...trainingData,
            datum: formatDate(currentDate),
            serie_id: serieId
          })
          currentDate.setDate(currentDate.getDate() + 7)
        }

        await supabase.from('trainings').insert(trainingsToCreate)
      } else {
        await supabase.from('trainings').insert(trainingData)
      }

      // Automatische Guthaben-Verrechnung bei Status-Wechsel auf "durchgefuehrt"
      const statusWurdeAufDurchgefuehrtGeaendert = status === 'durchgefuehrt' && (!training || training.status !== 'durchgefuehrt')
      if (statusWurdeAufDurchgefuehrtGeaendert && selectedSpieler.length > 0) {
        const tarif = tarife.find(ta => ta.id === tarifId)
        const preis = customPreis ? parseFloat(customPreis) : (tarif?.preis_pro_stunde || 0)
        const duration = calculateDuration(uhrzeitVon, uhrzeitBis)
        const abrechnungsart = tarif?.abrechnung || 'proTraining'

        // Berechne Betrag pro Spieler
        let betragProSpieler = preis * duration
        if (abrechnungsart === 'proSpieler') {
          const entfernteMitBezahlung = entfernteSpieler.filter(es => es.muss_bezahlen)
          betragProSpieler = betragProSpieler / (selectedSpieler.length + entfernteMitBezahlung.length)
        }

        // Training-ID ermitteln (bei neuem Training aus DB laden)
        let trainingId = training?.id
        if (!trainingId) {
          const { data: neuesTraining } = await supabase
            .from('trainings')
            .select('id')
            .eq('user_id', userId)
            .eq('datum', datum)
            .eq('uhrzeit_von', uhrzeitVon)
            .eq('uhrzeit_bis', uhrzeitBis)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
          trainingId = neuesTraining?.id
        }

        // Für jeden Spieler prüfen ob Guthaben vorhanden
        for (const spielerId of selectedSpieler) {
          const { data: guthaben } = await supabase
            .from('guthaben')
            .select('*')
            .eq('spieler_id', spielerId)
            .eq('user_id', userId)
            .single()

          if (guthaben && guthaben.aktuell >= betragProSpieler && betragProSpieler > 0) {
            // Guthaben abbuchen
            await supabase
              .from('guthaben')
              .update({
                aktuell: guthaben.aktuell - betragProSpieler,
                verbraucht_gesamt: guthaben.verbraucht_gesamt + betragProSpieler,
                updated_at: new Date().toISOString()
              })
              .eq('id', guthaben.id)

            // Transaktion speichern
            await supabase
              .from('guthaben_transaktionen')
              .insert({
                user_id: userId,
                spieler_id: spielerId,
                betrag: -betragProSpieler,
                typ: 'abbuchung',
                training_id: trainingId,
                beschreibung: `Training vom ${datum.split('-').reverse().join('.')}`,
                bar: false,
                datum: formatDate(new Date())
              })

            // Training als bezahlt markieren für diesen Spieler
            if (trainingId) {
              const { data: existingPayment } = await supabase
                .from('spieler_training_payments')
                .select('id')
                .eq('training_id', trainingId)
                .eq('spieler_id', spielerId)
                .single()

              if (existingPayment) {
                await supabase
                  .from('spieler_training_payments')
                  .update({ bezahlt: true })
                  .eq('id', existingPayment.id)
              } else {
                await supabase
                  .from('spieler_training_payments')
                  .insert({
                    user_id: userId,
                    training_id: trainingId,
                    spieler_id: spielerId,
                    bezahlt: true,
                    bar_bezahlt: false
                  })
              }
            }
          }
        }
      }

      onSave()
    } catch (err) {
      console.error('Error saving training:', err)
      alert('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!training) return

    // Bei proTraining/proSpieler erst Bezahl-Abfrage zeigen
    if (brauchtBezahlAbfrage) {
      setCancelDialog({ type: 'delete' })
      return
    }

    // Sonst direkt löschen
    await executeDelete()
  }

  const executeDelete = async () => {
    if (!training) return

    if (serienAktion === 'nachfolgende' && training.serie_id) {
      const confirmed = await showConfirm('Serie löschen', 'Dieses und alle nachfolgenden Trainings der Serie wirklich löschen?')
      if (!confirmed) return
      await supabase
        .from('trainings')
        .delete()
        .eq('serie_id', training.serie_id)
        .gte('datum', training.datum)
    } else {
      const confirmed = await showConfirm('Training löschen', 'Training wirklich löschen?')
      if (!confirmed) return
      await supabase.from('trainings').delete().eq('id', training.id)
    }
    onSave()
  }

  // Handler für Status-Änderung auf "abgesagt"
  const handleStatusChange = (newStatus: Training['status']) => {
    // Wenn auf "abgesagt" gewechselt wird und Bezahl-Abfrage nötig
    if (newStatus === 'abgesagt' && status !== 'abgesagt' && brauchtBezahlAbfrage) {
      setCancelDialog({ type: 'cancel', previousStatus: status })
      return
    }
    setStatus(newStatus)
  }

  // Handler für Löschen/Absagen mit Bezahl-Info
  const handleCancelWithPayment = async (mussBezahlen: boolean) => {
    if (!cancelDialog || !training) return

    if (cancelDialog.type === 'delete') {
      // Bei Löschen: Erst entfernte Spieler mit Bezahlpflicht speichern, dann löschen
      if (mussBezahlen) {
        // Alle aktuellen Spieler als "entfernt mit Bezahlpflicht" markieren
        const neueEntfernteSpieler = selectedSpieler.map(spielerId => ({
          spieler_id: spielerId,
          muss_bezahlen: true,
          entfernt_am: new Date().toISOString()
        }))

        // Training auf abgesagt setzen statt löschen (um Abrechnung zu ermöglichen)
        await supabase.from('trainings').update({
          status: 'abgesagt',
          entfernte_spieler: [...entfernteSpieler, ...neueEntfernteSpieler],
          spieler_ids: [] // Alle Spieler entfernen
        }).eq('id', training.id)

        setCancelDialog(null)
        onSave()
      } else {
        // Ohne Bezahlung: normal löschen
        setCancelDialog(null)
        await executeDelete()
      }
    } else if (cancelDialog.type === 'cancel') {
      // Bei Absagen: Spieler immer als entfernt markieren (mit oder ohne Bezahlpflicht)
      const neueEntfernteSpieler = selectedSpieler.map(spielerId => ({
        spieler_id: spielerId,
        muss_bezahlen: mussBezahlen,
        entfernt_am: new Date().toISOString()
      }))

      setEntfernteSpieler(prev => [...prev, ...neueEntfernteSpieler])
      setSelectedSpieler([]) // Alle Spieler entfernen
      setStatus('abgesagt')
      setCancelDialog(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{training ? 'Training bearbeiten' : 'Neues Training'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Datum</label>
            <input
              type="date"
              className="form-control"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Von</label>
              <input
                type="time"
                className="form-control"
                value={uhrzeitVon}
                onChange={(e) => {
                  const neueStartzeit = e.target.value
                  setUhrzeitVon(neueStartzeit)
                  // Automatisch Endzeit auf +1 Stunde setzen
                  const [h, m] = neueStartzeit.split(':').map(Number)
                  const endH = (h + 1) % 24
                  setUhrzeitBis(`${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
                }}
              />
            </div>
            <div className="form-group">
              <label>Bis</label>
              <input
                type="time"
                className="form-control"
                value={uhrzeitBis}
                onChange={(e) => setUhrzeitBis(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Spieler auswählen</label>
            <input
              type="text"
              className="form-control"
              placeholder="Spieler suchen..."
              value={spielerSuche}
              onChange={(e) => setSpielerSuche(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <div className="multi-select">
              {spieler
                .filter(s => s.name.toLowerCase().includes(spielerSuche.toLowerCase()))
                .map((s) => (
                <div
                  key={s.id}
                  className={`multi-select-item ${selectedSpieler.includes(s.id) ? 'selected' : ''}`}
                  onClick={() => toggleSpieler(s.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedSpieler.includes(s.id)}
                    readOnly
                  />
                  <span>{s.name}</span>
                </div>
              ))}
              {spieler.length === 0 && (
                <div style={{ padding: 12, color: 'var(--gray-500)' }}>
                  Noch keine Spieler angelegt
                </div>
              )}
              {spieler.length > 0 && spieler.filter(s => s.name.toLowerCase().includes(spielerSuche.toLowerCase())).length === 0 && (
                <div style={{ padding: 12, color: 'var(--gray-500)' }}>
                  Kein Spieler gefunden
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Trainingsname (optional)</label>
            <input
              type="text"
              className="form-control"
              value={trainingName}
              onChange={(e) => setTrainingName(e.target.value)}
              placeholder="z.B. Mannschaftstraining, Techniktraining..."
            />
            <small style={{ color: 'var(--gray-500)', fontSize: 12 }}>
              Ohne Angabe werden die Spielernamen angezeigt
            </small>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Tarif</label>
              <select
                className="form-control"
                value={tarifId}
                onChange={(e) => setTarifId(e.target.value)}
              >
                <option value="">-- Individuell --</option>
                {tarife.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.preis_pro_stunde} €/h)
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select
                className="form-control"
                value={status}
                onChange={(e) => handleStatusChange(e.target.value as Training['status'])}
              >
                <option value="geplant">Geplant</option>
                <option value="durchgefuehrt">Durchgeführt</option>
                <option value="abgesagt">Abgesagt</option>
              </select>
            </div>
          </div>

          {!tarifId && (
            <div className="form-group">
              <label>Individueller Preis pro Stunde (€)</label>
              <input
                type="number"
                className="form-control"
                value={customPreis}
                onChange={(e) => setCustomPreis(e.target.value)}
                placeholder="z.B. 45"
              />
            </div>
          )}

          <div className="form-group">
            <label>Notiz</label>
            <textarea
              className="form-control"
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              rows={2}
              placeholder="Optionale Notiz zum Training..."
            />
          </div>

          <div className="form-group">
            <label className="checkbox-group">
              <input
                type="checkbox"
                checked={barBezahlt}
                onChange={(e) => setBarBezahlt(e.target.checked)}
              />
              Bar bezahlt
            </label>
          </div>

          {/* Serienoptionen beim Bearbeiten */}
          {training && istSerie && (
            <div className="form-group" style={{ background: 'var(--primary-light)', padding: 12, borderRadius: 'var(--radius)' }}>
              <label style={{ fontWeight: 500, marginBottom: 8, display: 'block', color: 'var(--primary)' }}>
                Dieses Training ist Teil einer Serie
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label className="checkbox-group">
                  <input
                    type="radio"
                    name="serienAktion"
                    checked={serienAktion === 'einzeln'}
                    onChange={() => setSerienAktion('einzeln')}
                  />
                  Nur dieses Training bearbeiten
                </label>
                <label className="checkbox-group">
                  <input
                    type="radio"
                    name="serienAktion"
                    checked={serienAktion === 'nachfolgende'}
                    onChange={() => setSerienAktion('nachfolgende')}
                  />
                  Dieses und alle nachfolgenden Trainings bearbeiten
                </label>
              </div>
            </div>
          )}

          {!training && (
            <>
              <div className="form-group">
                <label className="checkbox-group">
                  <input
                    type="checkbox"
                    checked={wiederholen}
                    onChange={(e) => setWiederholen(e.target.checked)}
                  />
                  Wöchentlich wiederholen
                </label>
              </div>

              {wiederholen && (
                <div className="form-group">
                  <label>Wiederholen bis</label>
                  <input
                    type="date"
                    className="form-control"
                    value={wiederholenBis}
                    onChange={(e) => setWiederholenBis(e.target.value)}
                    min={datum}
                  />
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          {training && (
            <button className="btn btn-danger" onClick={handleDelete}>
              Löschen
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Speichere...' : 'Speichern'}
          </button>
        </div>
      </div>

      {/* Dialog für Bezahl-Abfrage bei Spieler-Entfernung */}
      {removeDialog && (
        <div className="modal-overlay" onClick={() => setRemoveDialog(null)} style={{ zIndex: 1001 }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Spieler entfernen</h3>
              <button className="modal-close" onClick={() => setRemoveDialog(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 16 }}>
                <strong>{removeDialog.spielerName}</strong> aus diesem Training entfernen.
              </p>
              <p style={{ color: 'var(--gray-600)', marginBottom: 8 }}>
                Muss der Spieler den Betrag trotzdem bezahlen?
              </p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setRemoveDialog(null)}
              >
                Abbrechen
              </button>
              <button
                className="btn btn-success"
                onClick={() => handleRemoveWithPayment(false)}
              >
                Nein, nicht bezahlen
              </button>
              <button
                className="btn btn-warning"
                onClick={() => handleRemoveWithPayment(true)}
              >
                Ja, muss bezahlen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog für Bezahl-Abfrage bei Löschen/Absagen */}
      {cancelDialog && (
        <div className="modal-overlay" onClick={() => setCancelDialog(null)} style={{ zIndex: 1001 }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h3>{cancelDialog.type === 'delete' ? 'Training löschen' : 'Training absagen'}</h3>
              <button className="modal-close" onClick={() => setCancelDialog(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 16 }}>
                {cancelDialog.type === 'delete'
                  ? 'Dieses Training wird gelöscht.'
                  : 'Dieses Training wird auf "Abgesagt" gesetzt.'}
              </p>
              <p style={{ color: 'var(--gray-600)', marginBottom: 8 }}>
                Müssen die Spieler den Betrag trotzdem bezahlen?
              </p>
              <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                Betroffene Spieler: {selectedSpieler.map(id => spieler.find(s => s.id === id)?.name).filter(Boolean).join(', ')}
              </p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setCancelDialog(null)}
              >
                Abbrechen
              </button>
              <button
                className="btn btn-success"
                onClick={() => handleCancelWithPayment(false)}
              >
                Nein, nicht bezahlen
              </button>
              <button
                className="btn btn-warning"
                onClick={() => handleCancelWithPayment(true)}
              >
                Ja, müssen bezahlen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ VERWALTUNG VIEW ============
function VerwaltungView({
  spieler,
  tarife,
  trainer,
  onUpdate,
  userId
}: {
  spieler: Spieler[]
  tarife: Tarif[]
  trainer: Trainer[]
  onUpdate: () => void
  userId: string
}) {
  const [activeSubTab, setActiveSubTab] = useState<'spieler' | 'tarife' | 'trainer'>('spieler')
  const [showSpielerModal, setShowSpielerModal] = useState(false)
  const [showTarifModal, setShowTarifModal] = useState(false)
  const [showTrainerModal, setShowTrainerModal] = useState(false)
  const [editingSpieler, setEditingSpieler] = useState<Spieler | null>(null)
  const [editingTarif, setEditingTarif] = useState<Tarif | null>(null)
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredSpieler = useMemo(() => {
    if (!searchTerm) return spieler
    const term = searchTerm.toLowerCase()
    return spieler.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.kontakt_email?.toLowerCase().includes(term)
    )
  }, [spieler, searchTerm])

  return (
    <div>
      <div className="tabs">
        <button
          className={`tab ${activeSubTab === 'spieler' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('spieler')}
        >
          Spieler ({spieler.length})
        </button>
        <button
          className={`tab ${activeSubTab === 'tarife' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('tarife')}
        >
          Tarife ({tarife.length})
        </button>
        <button
          className={`tab ${activeSubTab === 'trainer' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('trainer')}
        >
          Trainer ({trainer.length})
        </button>
      </div>

      {activeSubTab === 'spieler' && (
        <div className="card">
          <div className="card-header">
            <h3>Spieler-Verwaltung</h3>
            <button className="btn btn-primary" onClick={() => setShowSpielerModal(true)}>
              + Neuer Spieler
            </button>
          </div>

          <div className="search-box">
            <input
              type="text"
              placeholder="Suche nach Name oder E-Mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Desktop Table */}
          <div className="table-container desktop-table">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>E-Mail</th>
                  <th>Telefon</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredSpieler.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.kontakt_email || '-'}</td>
                    <td>{s.kontakt_telefon || '-'}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => {
                          setEditingSpieler(s)
                          setShowSpielerModal(true)
                        }}
                      >
                        Bearbeiten
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredSpieler.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-state">
                      Keine Spieler gefunden
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="mobile-card-list">
            {filteredSpieler.map((s) => (
              <div key={s.id} className="mobile-card">
                <div className="mobile-card-header">
                  <div className="mobile-card-title">{s.name}</div>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">E-Mail</span>
                    <span className="mobile-card-value">{s.kontakt_email || '-'}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Telefon</span>
                    <span className="mobile-card-value">{s.kontakt_telefon || '-'}</span>
                  </div>
                </div>
                <div className="mobile-card-actions">
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      setEditingSpieler(s)
                      setShowSpielerModal(true)
                    }}
                  >
                    Bearbeiten
                  </button>
                </div>
              </div>
            ))}
            {filteredSpieler.length === 0 && (
              <div className="empty-state">Keine Spieler gefunden</div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'tarife' && (
        <div className="card">
          <div className="card-header">
            <h3>Tarif-Verwaltung</h3>
            <button className="btn btn-primary" onClick={() => setShowTarifModal(true)}>
              + Neuer Tarif
            </button>
          </div>

          {/* Desktop Table */}
          <div className="table-container desktop-table">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Preis/Stunde</th>
                  <th>Abrechnung</th>
                  <th>Beschreibung</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {tarife.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.preis_pro_stunde} €</td>
                    <td>
                      {t.abrechnung === 'proTraining'
                        ? 'Pro Training'
                        : t.abrechnung === 'proSpieler'
                          ? 'Pro Spieler'
                          : 'Monatlich'}
                    </td>
                    <td>{t.beschreibung || '-'}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => {
                          setEditingTarif(t)
                          setShowTarifModal(true)
                        }}
                      >
                        Bearbeiten
                      </button>
                    </td>
                  </tr>
                ))}
                {tarife.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      Keine Tarife angelegt
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="mobile-card-list">
            {tarife.map((t) => (
              <div key={t.id} className="mobile-card">
                <div className="mobile-card-header">
                  <div className="mobile-card-title">{t.name}</div>
                  <div className="mobile-card-subtitle">{t.preis_pro_stunde} €/h</div>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Abrechnung</span>
                    <span className="mobile-card-value">
                      {t.abrechnung === 'proTraining'
                        ? 'Pro Training'
                        : t.abrechnung === 'proSpieler'
                          ? 'Pro Spieler'
                          : 'Monatlich'}
                    </span>
                  </div>
                  {t.beschreibung && (
                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Beschreibung</span>
                      <span className="mobile-card-value">{t.beschreibung}</span>
                    </div>
                  )}
                </div>
                <div className="mobile-card-actions">
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      setEditingTarif(t)
                      setShowTarifModal(true)
                    }}
                  >
                    Bearbeiten
                  </button>
                </div>
              </div>
            ))}
            {tarife.length === 0 && (
              <div className="empty-state">Keine Tarife angelegt</div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'trainer' && (
        <div className="card">
          <div className="card-header">
            <h3>Trainer-Verwaltung</h3>
          </div>
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-500)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
            <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>Demnächst verfügbar</div>
            <p style={{ fontSize: 14 }}>
              Die Trainer-Verwaltung befindet sich noch in Entwicklung.
            </p>
          </div>
        </div>
      )}

      {/* Spieler Modal */}
      {showSpielerModal && (
        <SpielerModal
          spieler={editingSpieler}
          alleSpieler={spieler}
          userId={userId}
          onClose={() => {
            setShowSpielerModal(false)
            setEditingSpieler(null)
          }}
          onSave={() => {
            setShowSpielerModal(false)
            setEditingSpieler(null)
            onUpdate()
          }}
        />
      )}

      {/* Tarif Modal */}
      {showTarifModal && (
        <TarifModal
          tarif={editingTarif}
          userId={userId}
          onClose={() => {
            setShowTarifModal(false)
            setEditingTarif(null)
          }}
          onSave={() => {
            setShowTarifModal(false)
            setEditingTarif(null)
            onUpdate()
          }}
        />
      )}

      {/* Trainer Modal */}
      {showTrainerModal && (
        <TrainerModal
          trainerData={editingTrainer}
          userId={userId}
          onClose={() => {
            setShowTrainerModal(false)
            setEditingTrainer(null)
          }}
          onSave={() => {
            setShowTrainerModal(false)
            setEditingTrainer(null)
            onUpdate()
          }}
        />
      )}
    </div>
  )
}

// ============ SPIELER MODAL ============
function SpielerModal({
  spieler,
  alleSpieler,
  userId,
  onClose,
  onSave
}: {
  spieler: Spieler | null
  alleSpieler: Spieler[]
  userId: string
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState(spieler?.name || '')
  const [email, setEmail] = useState(spieler?.kontakt_email || '')
  const [telefon, setTelefon] = useState(spieler?.kontakt_telefon || '')
  const [adresse, setAdresse] = useState(spieler?.rechnungs_adresse || '')
  const [abweichendeRechnung, setAbweichendeRechnung] = useState(spieler?.abweichende_rechnung || false)
  const [rechnungsEmpfaenger, setRechnungsEmpfaenger] = useState(spieler?.rechnungs_empfaenger || '')
  const [rechnungsSpielerId, setRechnungsSpielerId] = useState(spieler?.rechnungs_spieler_id || '')
  const [notizen, setNotizen] = useState(spieler?.notizen || '')
  const [iban, setIban] = useState(spieler?.iban || '')
  const [mandatsreferenz, setMandatsreferenz] = useState(spieler?.mandatsreferenz || '')
  const [unterschriftsdatum, setUnterschriftsdatum] = useState(spieler?.unterschriftsdatum || '')
  const [saving, setSaving] = useState(false)

  // Spieler die als Rechnungsempfänger verfügbar sind (nicht der aktuelle Spieler selbst)
  const verfuegbareRechnungsSpieler = alleSpieler.filter(s =>
    s.id !== spieler?.id && !s.rechnungs_spieler_id // Nur Spieler die selbst keinen anderen Rechnungsempfänger haben
  )

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Name ist erforderlich')
      return
    }

    setSaving(true)
    try {
      const data: Record<string, unknown> = {
        user_id: userId,
        name: name.trim(),
        kontakt_email: email || null,
        kontakt_telefon: telefon || null,
        rechnungs_adresse: adresse || null,
        notizen: notizen || null,
        iban: iban || null,
        mandatsreferenz: mandatsreferenz || null,
        unterschriftsdatum: unterschriftsdatum || null
      }

      // Rechnungsempfänger-Logik
      if (rechnungsSpielerId) {
        // Anderer Spieler ist Rechnungsempfänger
        data.abweichende_rechnung = false
        data.rechnungs_empfaenger = null
        data.rechnungs_spieler_id = rechnungsSpielerId
      } else if (abweichendeRechnung) {
        // Manuell eingegebener abweichender Empfänger
        data.abweichende_rechnung = true
        data.rechnungs_empfaenger = rechnungsEmpfaenger || null
        data.rechnungs_spieler_id = null
      } else {
        data.abweichende_rechnung = false
        data.rechnungs_empfaenger = null
        data.rechnungs_spieler_id = null
      }

      if (spieler) {
        const { error } = await supabase.from('spieler').update(data).eq('id', spieler.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('spieler').insert(data)
        if (error) throw error
      }
      onSave()
    } catch (err) {
      console.error('Error saving spieler:', err)
      alert('Fehler beim Speichern: ' + (err instanceof Error ? err.message : 'Unbekannter Fehler'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!spieler) return
    const confirmed = await showConfirm('Spieler löschen', 'Spieler wirklich löschen?')
    if (!confirmed) return

    await supabase.from('spieler').delete().eq('id', spieler.id)
    onSave()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{spieler ? 'Spieler bearbeiten' : 'Neuer Spieler'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vor- und Nachname"
            />
          </div>
          <div className="form-group">
            <label>E-Mail</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@beispiel.de"
            />
          </div>
          <div className="form-group">
            <label>Telefon</label>
            <input
              type="tel"
              className="form-control"
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
              placeholder="+49 123 456789"
            />
          </div>
          <div className="form-group">
            <label>Rechnungsadresse</label>
            <textarea
              className="form-control"
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              rows={3}
              placeholder="Straße, PLZ Ort"
            />
          </div>
          {/* Rechnungsempfänger-Auswahl */}
          {verfuegbareRechnungsSpieler.length > 0 && (
            <div className="form-group">
              <label>Rechnung über anderen Spieler (z.B. Geschwister)</label>
              <select
                className="form-control"
                value={rechnungsSpielerId}
                onChange={(e) => {
                  setRechnungsSpielerId(e.target.value)
                  if (e.target.value) {
                    setAbweichendeRechnung(false)
                  }
                }}
              >
                <option value="">-- Eigene Rechnung --</option>
                {verfuegbareRechnungsSpieler.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {rechnungsSpielerId && (
                <p style={{ fontSize: 12, color: 'var(--primary)', marginTop: 4 }}>
                  Trainings dieses Spielers werden auf der Rechnung von "{verfuegbareRechnungsSpieler.find(s => s.id === rechnungsSpielerId)?.name}" mit aufgeführt.
                </p>
              )}
            </div>
          )}

          {/* Manueller abweichender Rechnungsempfänger (nur wenn kein Spieler ausgewählt) */}
          {!rechnungsSpielerId && (
            <>
              <div className="form-group">
                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id="abweichendeRechnung"
                    checked={abweichendeRechnung}
                    onChange={(e) => setAbweichendeRechnung(e.target.checked)}
                  />
                  <label htmlFor="abweichendeRechnung">
                    Abweichender Rechnungsempfänger (z.B. bei Kindern)
                  </label>
                </div>
              </div>
              {abweichendeRechnung && (
                <div className="form-group" style={{ background: 'var(--gray-50)', padding: 12, borderRadius: 'var(--radius)', marginTop: -8 }}>
                  <label>Rechnungsempfänger (Name)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={rechnungsEmpfaenger}
                    onChange={(e) => setRechnungsEmpfaenger(e.target.value)}
                    placeholder="z.B. Eltern des Kindes"
                  />
                  <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
                    Die Rechnungsadresse oben wird dann für diesen Empfänger verwendet.
                  </p>
                </div>
              )}
            </>
          )}
          {/* SEPA-Lastschrift Daten */}
          <div style={{ marginTop: 16, padding: 12, background: 'var(--gray-50)', borderRadius: 'var(--radius)' }}>
            <label style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>SEPA-Lastschrift (optional)</label>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label>IBAN</label>
              <input
                type="text"
                className="form-control"
                value={iban}
                onChange={(e) => setIban(e.target.value.toUpperCase())}
                placeholder="DE89 3704 0044 0532 0130 00"
              />
            </div>
            <div className="form-row" style={{ gap: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Mandatsreferenz</label>
                <input
                  type="text"
                  className="form-control"
                  value={mandatsreferenz}
                  onChange={(e) => setMandatsreferenz(e.target.value)}
                  placeholder="z.B. MANDAT-001"
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Unterschriftsdatum</label>
                <input
                  type="date"
                  className="form-control"
                  value={unterschriftsdatum}
                  onChange={(e) => setUnterschriftsdatum(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Notizen</label>
            <textarea
              className="form-control"
              value={notizen}
              onChange={(e) => setNotizen(e.target.value)}
              rows={2}
              placeholder="Interne Notizen..."
            />
          </div>
        </div>
        <div className="modal-footer">
          {spieler && (
            <button className="btn btn-danger" onClick={handleDelete}>
              Löschen
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Speichere...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ TARIF MODAL ============
function TarifModal({
  tarif,
  userId,
  onClose,
  onSave
}: {
  tarif: Tarif | null
  userId: string
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState(tarif?.name || '')
  const [preis, setPreis] = useState(tarif?.preis_pro_stunde?.toString() || '')
  const [abrechnung, setAbrechnung] = useState<Tarif['abrechnung']>(tarif?.abrechnung || 'proTraining')
  const [beschreibung, setBeschreibung] = useState(tarif?.beschreibung || '')
  const [inklUst, setInklUst] = useState(tarif?.inkl_ust ?? true)
  const [ustSatz, setUstSatz] = useState(tarif?.ust_satz?.toString() || '19')
  const [saving, setSaving] = useState(false)

  // Berechne Netto/Brutto zur Anzeige
  const bruttoPreis = parseFloat(preis) || 0
  const ustSatzNum = parseFloat(ustSatz) || 19
  const nettoPreis = inklUst ? bruttoPreis / (1 + ustSatzNum / 100) : bruttoPreis
  const ustBetrag = inklUst ? bruttoPreis - nettoPreis : bruttoPreis * (ustSatzNum / 100)

  const handleSave = async () => {
    if (!name.trim() || !preis) {
      alert('Name und Preis sind erforderlich')
      return
    }

    setSaving(true)
    try {
      const data = {
        user_id: userId,
        name: name.trim(),
        preis_pro_stunde: parseFloat(preis),
        abrechnung,
        beschreibung: beschreibung || null,
        inkl_ust: inklUst,
        ust_satz: parseFloat(ustSatz) || 19
      }

      if (tarif) {
        await supabase.from('tarife').update(data).eq('id', tarif.id)
      } else {
        await supabase.from('tarife').insert(data)
      }
      onSave()
    } catch (err) {
      console.error('Error saving tarif:', err)
      alert('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!tarif) return
    const confirmed = await showConfirm('Tarif löschen', 'Tarif wirklich löschen?')
    if (!confirmed) return

    await supabase.from('tarife').delete().eq('id', tarif.id)
    onSave()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{tarif ? 'Tarif bearbeiten' : 'Neuer Tarif'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Einzeltraining"
            />
          </div>
          <div className="form-group">
            <label>Preis pro Stunde (€) * {inklUst ? '(inkl. USt)' : '(netto)'}</label>
            <input
              type="number"
              className="form-control"
              value={preis}
              onChange={(e) => setPreis(e.target.value)}
              placeholder="z.B. 45"
              min="0"
              step="0.01"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="checkbox-group">
                <input
                  type="checkbox"
                  checked={inklUst}
                  onChange={(e) => setInklUst(e.target.checked)}
                />
                Preis inkl. USt
              </label>
            </div>
            <div className="form-group">
              <label>USt-Satz (%)</label>
              <select
                className="form-control"
                value={ustSatz}
                onChange={(e) => setUstSatz(e.target.value)}
              >
                <option value="19">19%</option>
                <option value="7">7%</option>
                <option value="0">0% (steuerfrei)</option>
              </select>
            </div>
          </div>
          {preis && parseFloat(ustSatz) > 0 && (
            <div style={{ background: 'var(--gray-100)', padding: 12, borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Netto:</span>
                <span>{nettoPreis.toFixed(2)} €</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>USt ({ustSatz}%):</span>
                <span>{ustBetrag.toFixed(2)} €</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                <span>Brutto:</span>
                <span>{(inklUst ? bruttoPreis : bruttoPreis + ustBetrag).toFixed(2)} €</span>
              </div>
            </div>
          )}
          <div className="form-group">
            <label>Abrechnungsart</label>
            <select
              className="form-control"
              value={abrechnung}
              onChange={(e) => setAbrechnung(e.target.value as Tarif['abrechnung'])}
            >
              <option value="proTraining">Pro Training</option>
              <option value="proSpieler">Pro Spieler</option>
              <option value="monatlich">Monatlich</option>
            </select>
          </div>
          <div className="form-group">
            <label>Beschreibung</label>
            <textarea
              className="form-control"
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              rows={2}
              placeholder="Optionale Beschreibung..."
            />
          </div>
        </div>
        <div className="modal-footer">
          {tarif && (
            <button className="btn btn-danger" onClick={handleDelete}>
              Löschen
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Speichere...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ============ TRAINER MODAL ============
function TrainerModal({
  trainerData,
  userId,
  onClose,
  onSave
}: {
  trainerData: Trainer | null
  userId: string
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState(trainerData?.name || '')
  const [stundensatz, setStundensatz] = useState(trainerData?.stundensatz?.toString() || '25')
  const [notiz, setNotiz] = useState(trainerData?.notiz || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Name ist erforderlich')
      return
    }

    setSaving(true)
    try {
      const data = {
        user_id: userId,
        name: name.trim(),
        stundensatz: parseFloat(stundensatz) || 25,
        notiz: notiz || null
      }

      if (trainerData) {
        await supabase.from('trainer').update(data).eq('id', trainerData.id)
      } else {
        await supabase.from('trainer').insert(data)
      }
      onSave()
    } catch (err) {
      console.error('Error saving trainer:', err)
      alert('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!trainerData) return
    const confirmed = await showConfirm('Trainer löschen', 'Trainer wirklich löschen?')
    if (!confirmed) return

    await supabase.from('trainer').delete().eq('id', trainerData.id)
    onSave()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{trainerData ? 'Trainer bearbeiten' : 'Neuer Trainer'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name des Trainers"
            />
          </div>
          <div className="form-group">
            <label>Stundensatz (€) *</label>
            <input
              type="number"
              className="form-control"
              value={stundensatz}
              onChange={(e) => setStundensatz(e.target.value)}
              placeholder="z.B. 25"
              min="0"
              step="0.01"
            />
          </div>
          <div className="form-group">
            <label>Notiz</label>
            <textarea
              className="form-control"
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              rows={2}
              placeholder="Optionale Notiz..."
            />
          </div>
        </div>
        <div className="modal-footer">
          {trainerData && (
            <button className="btn btn-danger" onClick={handleDelete}>
              Löschen
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Speichere...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ ABRECHNUNG VIEW ============
function AbrechnungView({
  trainings,
  spieler,
  tarife,
  adjustments,
  spielerPayments,
  setSpielerPayments,
  profile,
  pdfVorlagen,
  onUpdate,
  onNavigateToTraining,
  userId
}: {
  trainings: Training[]
  spieler: Spieler[]
  tarife: Tarif[]
  adjustments: MonthlyAdjustment[]
  spielerPayments: SpielerTrainingPayment[]
  setSpielerPayments: React.Dispatch<React.SetStateAction<SpielerTrainingPayment[]>>
  profile: TrainerProfile | null
  pdfVorlagen: PdfVorlage[]
  onUpdate: () => void
  onNavigateToTraining: (training: Training) => void
  userId: string
}) {
  const [selectedMonth, setSelectedMonth] = useState(getMonthString(new Date()))
  const [filter, setFilter] = useState<'alle' | 'bezahlt' | 'offen' | 'ausstehend' | 'bar'>('alle')
  const [filterType, setFilterType] = useState<'keine' | 'spieler' | 'tag'>('keine')
  const [selectedSpielerId, setSelectedSpielerId] = useState<string>('')
  const [spielerSuche, setSpielerSuche] = useState('')
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showManuelleRechnungModal, setShowManuelleRechnungModal] = useState(false)
  const [selectedSpielerDetail, setSelectedSpielerDetail] = useState<string | null>(null)
  const [showKorrekturModal, setShowKorrekturModal] = useState<string | null>(null)
  const [korrekturBetrag, setKorrekturBetrag] = useState('')
  const [korrekturGrund, setKorrekturGrund] = useState('')
  const [korrekturSaving, setKorrekturSaving] = useState(false)
  const [showTrainingKorrekturModal, setShowTrainingKorrekturModal] = useState<Training | null>(null)
  const [trainingKorrekturBetrag, setTrainingKorrekturBetrag] = useState('')
  const [trainingKorrekturGrund, setTrainingKorrekturGrund] = useState('')
  // Bulk-Auswahl für Trainings eines Spielers
  const [selectedTrainingsForBulk, setSelectedTrainingsForBulk] = useState<Set<string>>(new Set())

  const monthTrainings = useMemo(() => {
    return trainings.filter((t) => {
      const tMonth = t.datum.substring(0, 7)
      if (tMonth !== selectedMonth) return false

      // Durchgeführte Trainings immer einbeziehen
      if (t.status === 'durchgefuehrt') return true

      // Abgesagte Trainings nur wenn entfernte Spieler mit Bezahlpflicht vorhanden
      if (t.status === 'abgesagt') {
        const hatBezahlpflichtige = (t.entfernte_spieler || []).some(es => es.muss_bezahlen)
        return hatBezahlpflichtige
      }

      return false
    })
  }, [trainings, selectedMonth])


  // Prüft den Bezahlstatus eines Spielers für ein Training
  // Nutzt spielerPayments wenn vorhanden, sonst Fallback auf training.bezahlt/bar_bezahlt
  const getSpielerPaymentStatus = (spielerId: string, training: Training): { bezahlt: boolean, barBezahlt: boolean, ausstehend: boolean } => {
    const payment = spielerPayments.find(p => p.training_id === training.id && p.spieler_id === spielerId)
    if (payment) {
      return { bezahlt: payment.bezahlt, barBezahlt: payment.bar_bezahlt, ausstehend: payment.ausstehend || false }
    }
    // Fallback: Für Einzeltrainings (nur 1 Spieler) das alte Feld nutzen
    if (training.spieler_ids.length === 1) {
      return { bezahlt: training.bezahlt, barBezahlt: training.bar_bezahlt, ausstehend: false }
    }
    // Für Gruppentrainings ohne expliziten Eintrag: als offen betrachten
    return { bezahlt: false, barBezahlt: false, ausstehend: false }
  }

  const spielerSummary = useMemo(() => {
    const summary: {
      [spielerId: string]: {
        spieler: Spieler
        trainings: Training[]
        summe: number
        barSumme: number
        bezahltSumme: number
        ausstehendSumme: number
        offeneSumme: number
        bezahlt: boolean
        ausstehend: boolean
        adjustment: number
        monatlicheSerien: Set<string> // Track welche Serien bereits berechnet wurden
      }
    } = {}

    monthTrainings.forEach((t) => {
      const tarif = tarife.find((ta) => ta.id === t.tarif_id)
      const preis = t.custom_preis_pro_stunde || tarif?.preis_pro_stunde || 0
      const duration = calculateDuration(t.uhrzeit_von, t.uhrzeit_bis)
      const abrechnungsart = t.custom_abrechnung || tarif?.abrechnung || 'proTraining'

      // Bei proSpieler: Anzahl zahlungspflichtiger Spieler = aktive + entfernte mit muss_bezahlen
      const entfernteMitBezahlung = (t.entfernte_spieler || []).filter(es => es.muss_bezahlen)
      const zahlendeSpielerAnzahl = t.spieler_ids.length + entfernteMitBezahlung.length

      t.spieler_ids.forEach((spielerId) => {
        if (!summary[spielerId]) {
          const sp = spieler.find((s) => s.id === spielerId)
          if (!sp) return
          summary[spielerId] = {
            spieler: sp,
            trainings: [],
            summe: 0,
            barSumme: 0,
            bezahltSumme: 0,
            ausstehendSumme: 0,
            offeneSumme: 0,
            bezahlt: false,
            ausstehend: false,
            adjustment: 0,
            monatlicheSerien: new Set()
          }
        }

        summary[spielerId].trainings.push(t)

        // Berechne den Preis basierend auf Abrechnungsart
        let spielerPreis = 0

        if (abrechnungsart === 'monatlich') {
          // Monatlicher Tarif: nur einmal pro Tarif pro Spieler pro Monat berechnen
          // Verwende Tarif-ID als Key, damit alle Trainings mit gleichem monatlichen Tarif nur einmal gezählt werden
          const monatlichKey = t.tarif_id || t.id
          if (!summary[spielerId].monatlicheSerien.has(monatlichKey)) {
            summary[spielerId].monatlicheSerien.add(monatlichKey)
            // Bei monatlich ist der Preis der Monatsbetrag (nicht pro Stunde)
            spielerPreis = preis
          }
          // Sonst: spielerPreis bleibt 0, da Tarif bereits berechnet
        } else {
          // Pro Training oder Pro Spieler
          const totalPreis = preis * duration
          spielerPreis = totalPreis
          if (abrechnungsart === 'proSpieler') {
            // Teile durch Gesamtzahl zahlungspflichtiger Spieler (inkl. entfernte mit Bezahlpflicht)
            spielerPreis = spielerPreis / zahlendeSpielerAnzahl
          }
        }

        // Training-Korrektur anwenden (z.B. Kartenlesergebühren)
        const trainingsKorrektur = t.korrektur_betrag || 0
        spielerPreis += trainingsKorrektur

        summary[spielerId].summe += spielerPreis

        // Kategorisiere nach Bezahlstatus
        // Nutze spieler-spezifischen Bezahlstatus!
        const paymentStatus = getSpielerPaymentStatus(spielerId, t)
        if (spielerPreis > 0 || trainingsKorrektur !== 0) {
          if (paymentStatus.barBezahlt) {
            summary[spielerId].barSumme += spielerPreis
          } else if (paymentStatus.bezahlt) {
            summary[spielerId].bezahltSumme += spielerPreis
          } else if (paymentStatus.ausstehend) {
            summary[spielerId].ausstehendSumme += spielerPreis
          } else {
            summary[spielerId].offeneSumme += spielerPreis
          }
        }
      })

      // Entfernte Spieler mit Bezahlpflicht (nur bei proTraining oder proSpieler)
      if (abrechnungsart !== 'monatlich') {
        entfernteMitBezahlung.forEach((entfernter) => {
          const spielerId = entfernter.spieler_id
          if (!summary[spielerId]) {
            const sp = spieler.find((s) => s.id === spielerId)
            if (!sp) return
            summary[spielerId] = {
              spieler: sp,
              trainings: [],
              summe: 0,
              barSumme: 0,
              bezahltSumme: 0,
              ausstehendSumme: 0,
              offeneSumme: 0,
              bezahlt: false,
              ausstehend: false,
              adjustment: 0,
              monatlicheSerien: new Set()
            }
          }

          // Training auch für entfernte Spieler tracken
          if (!summary[spielerId].trainings.includes(t)) {
            summary[spielerId].trainings.push(t)
          }

          // Berechne den Preis
          const totalPreis = preis * duration
          let spielerPreis = totalPreis
          if (abrechnungsart === 'proSpieler') {
            spielerPreis = spielerPreis / zahlendeSpielerAnzahl
          }

          summary[spielerId].summe += spielerPreis

          // Entfernte Spieler: Bezahlstatus prüfen
          const paymentStatus = getSpielerPaymentStatus(spielerId, t)
          if (paymentStatus.barBezahlt) {
            summary[spielerId].barSumme += spielerPreis
          } else if (paymentStatus.bezahlt) {
            summary[spielerId].bezahltSumme += spielerPreis
          } else if (paymentStatus.ausstehend) {
            summary[spielerId].ausstehendSumme += spielerPreis
          } else {
            summary[spielerId].offeneSumme += spielerPreis
          }
        })
      }
    })

    // Apply adjustments
    Object.keys(summary).forEach((spielerId) => {
      const adjustment = adjustments.find(
        (a) => a.spieler_id === spielerId && a.monat === selectedMonth
      )

      summary[spielerId].adjustment = adjustment?.betrag || 0
      summary[spielerId].summe += summary[spielerId].adjustment
      // Anpassungen werden zu offenen Beträgen gezählt (können dann manuell als bezahlt markiert werden)
      if (summary[spielerId].adjustment > 0) {
        summary[spielerId].offeneSumme += summary[spielerId].adjustment
      }

      // Bezahlt nur wenn ALLE Trainings bezahlt sind (bar oder normal) UND keine offenen/ausstehenden Beträge
      summary[spielerId].bezahlt = summary[spielerId].offeneSumme <= 0 && summary[spielerId].ausstehendSumme <= 0
      // Ausstehend wenn mindestens ein Training ausstehend ist (aber nicht alles bezahlt)
      summary[spielerId].ausstehend = summary[spielerId].ausstehendSumme > 0 && !summary[spielerId].bezahlt
    })

    return Object.values(summary)
  }, [monthTrainings, spieler, tarife, adjustments, spielerPayments, selectedMonth])

  // Alle Tage im Monat mit Trainings
  const tageImMonat = useMemo(() => {
    const tage = new Set<string>()
    monthTrainings.forEach(t => tage.add(t.datum))
    return Array.from(tage).sort()
  }, [monthTrainings])

  const filteredSummary = useMemo(() => {
    let result = spielerSummary

    // Bei Tag-Filter: Zeige nur Trainings des Tages mit korrekten Tages-Summen
    if (filterType === 'tag' && selectedTag) {
      result = result
        .filter(s => s.trainings.some(t => t.datum === selectedTag))
        .map(s => {
          const tagTrainings = s.trainings.filter(t => t.datum === selectedTag)

          // Bestimme welches Training das ERSTE des Monats für jeden monatlichen Tarif ist
          const alleTrainingsSortiert = [...s.trainings].sort((a, b) => a.datum.localeCompare(b.datum))
          const monatlicheErstesTraining = new Map<string, string>() // tarifKey -> erstes training.id
          alleTrainingsSortiert.forEach(t => {
            const tarif = tarife.find(ta => ta.id === t.tarif_id)
            const abrechnungsart = t.custom_abrechnung || tarif?.abrechnung || 'proTraining'
            if (abrechnungsart === 'monatlich') {
              const monatlichKey = t.tarif_id || t.id
              if (!monatlicheErstesTraining.has(monatlichKey)) {
                monatlicheErstesTraining.set(monatlichKey, t.id)
              }
            }
          })

          // Berechne Summen nur für die Trainings des gewählten Tages
          let tagSumme = 0
          let tagBarSumme = 0
          let tagBezahltSumme = 0
          let tagOffeneSumme = 0

          tagTrainings.forEach(t => {
            const tarif = tarife.find(ta => ta.id === t.tarif_id)
            const preis = t.custom_preis_pro_stunde || tarif?.preis_pro_stunde || 0
            const duration = calculateDuration(t.uhrzeit_von, t.uhrzeit_bis)
            const abrechnungsart = t.custom_abrechnung || tarif?.abrechnung || 'proTraining'

            let spielerPreis = 0

            if (abrechnungsart === 'monatlich') {
              // Monatlicher Tarif: nur wenn dieses Training das ERSTE des Monats ist
              const monatlichKey = t.tarif_id || t.id
              const erstesTrainingId = monatlicheErstesTraining.get(monatlichKey)
              if (t.id === erstesTrainingId) {
                spielerPreis = preis
              }
              // Sonst: 0€ da inkl. im Monatstarif
            } else {
              spielerPreis = preis * duration
              if (abrechnungsart === 'proSpieler') {
                const zahlendeSpielerAnzahl = t.spieler_ids.length + (t.entfernte_spieler?.filter(e => e.muss_bezahlen).length || 0)
                spielerPreis = spielerPreis / zahlendeSpielerAnzahl
              }
            }

            // Korrektur anwenden
            spielerPreis += (t.korrektur_betrag || 0)

            tagSumme += spielerPreis

            // Bezahlstatus
            const paymentStatus = getSpielerPaymentStatus(s.spieler.id, t)
            if (spielerPreis > 0) {
              if (paymentStatus.barBezahlt) {
                tagBarSumme += spielerPreis
              } else if (paymentStatus.bezahlt) {
                tagBezahltSumme += spielerPreis
              } else {
                tagOffeneSumme += spielerPreis
              }
            }
          })

          return {
            ...s,
            trainings: tagTrainings,
            summe: tagSumme,
            barSumme: tagBarSumme,
            bezahltSumme: tagBezahltSumme,
            offeneSumme: tagOffeneSumme
            // bezahlt bleibt vom Original (Monatsstatus)
          }
        })
        // Filtere Spieler heraus die keine Trainings am Tag haben
        .filter(s => s.trainings.length > 0)
    }

    // Status-Filter (bezahlt/offen/ausstehend/bar)
    switch (filter) {
      case 'bezahlt':
        result = result.filter((s) => s.bezahlt)
        break
      case 'offen':
        result = result.filter((s) => !s.bezahlt && !s.ausstehend)
        break
      case 'ausstehend':
        result = result.filter((s) => s.ausstehend)
        break
      case 'bar':
        result = result.filter((s) => s.barSumme > 0)
        break
    }

    // Zusätzlicher Filter nach Spieler
    if (filterType === 'spieler' && selectedSpielerId) {
      result = result.filter((s) => s.spieler.id === selectedSpielerId)
    }

    return result
  }, [spielerSummary, filter, filterType, selectedSpielerId, selectedTag, tarife, getSpielerPaymentStatus])

  const stats = useMemo(() => {
    // Trainings-Stats
    const trainingsTotal = filteredSummary.reduce((sum, s) => sum + s.summe, 0)
    const trainingsBar = filteredSummary.reduce((sum, s) => sum + s.barSumme, 0)
    const trainingsBezahlt = trainingsBar + filteredSummary.reduce((sum, s) => sum + s.bezahltSumme, 0)
    const trainingsOffen = filteredSummary.reduce((sum, s) => sum + s.offeneSumme, 0)

    // Stats zeigen NUR Trainings, keine manuellen Rechnungen
    // Manuelle Rechnungen werden separat in Buchhaltung > Offene Posten verwaltet
    return {
      total: trainingsTotal,
      bar: trainingsBar,
      bezahlt: trainingsBezahlt,
      offen: trainingsOffen
    }
  }, [filteredSummary])

  // Alle Trainings eines Spielers im Monat als bezahlt/offen markieren
  const toggleAlleBezahlt = async (spielerId: string, currentStatus: boolean) => {
    preserveScroll()
    const spielerData = spielerSummary.find(s => s.spieler.id === spielerId)
    if (!spielerData) return

    const newStatus = !currentStatus

    // Optimistisches Update - sofort alle UI aktualisieren
    const updatedPayments: SpielerTrainingPayment[] = []
    const newPayments: SpielerTrainingPayment[] = []

    for (const training of spielerData.trainings) {
      const existingPayment = spielerPayments.find(
        p => p.training_id === training.id && p.spieler_id === spielerId
      )

      if (existingPayment) {
        updatedPayments.push({ ...existingPayment, bezahlt: newStatus, ausstehend: false })
      } else {
        newPayments.push({
          id: `temp-${training.id}-${spielerId}`,
          user_id: userId,
          training_id: training.id,
          spieler_id: spielerId,
          bezahlt: newStatus,
          bar_bezahlt: training.bar_bezahlt || false,
          ausstehend: false,
          created_at: new Date().toISOString()
        })
      }
    }

    setSpielerPayments(prev => {
      const updated = prev.map(p => {
        const match = updatedPayments.find(up => up.id === p.id)
        return match || p
      })
      return [...updated, ...newPayments]
    })

    // Datenbank-Operationen
    for (const training of spielerData.trainings) {
      const existingPayment = spielerPayments.find(
        p => p.training_id === training.id && p.spieler_id === spielerId
      )

      if (existingPayment) {
        await supabase
          .from('spieler_training_payments')
          .update({ bezahlt: newStatus, ausstehend: false })
          .eq('id', existingPayment.id)
      } else {
        await supabase
          .from('spieler_training_payments')
          .insert({
            user_id: userId,
            training_id: training.id,
            spieler_id: spielerId,
            bezahlt: newStatus,
            bar_bezahlt: training.bar_bezahlt || false,
            ausstehend: false
          })
      }
    }
  }

  // Alle Trainings eines Spielers im Monat als bar bezahlt markieren
  const toggleAlleBarBezahlt = async (spielerId: string) => {
    preserveScroll()
    const spielerData = spielerSummary.find(s => s.spieler.id === spielerId)
    if (!spielerData) return

    // Optimistisches Update - sofort alle UI aktualisieren
    const updatedPayments: SpielerTrainingPayment[] = []
    const newPayments: SpielerTrainingPayment[] = []

    for (const training of spielerData.trainings) {
      const existingPayment = spielerPayments.find(
        p => p.training_id === training.id && p.spieler_id === spielerId
      )

      if (existingPayment) {
        updatedPayments.push({ ...existingPayment, bezahlt: true, bar_bezahlt: true, ausstehend: false })
      } else {
        newPayments.push({
          id: `temp-${training.id}-${spielerId}`,
          user_id: userId,
          training_id: training.id,
          spieler_id: spielerId,
          bezahlt: true,
          bar_bezahlt: true,
          ausstehend: false,
          created_at: new Date().toISOString()
        })
      }
    }

    setSpielerPayments(prev => {
      const updated = prev.map(p => {
        const match = updatedPayments.find(up => up.id === p.id)
        return match || p
      })
      return [...updated, ...newPayments]
    })

    // Datenbank-Operationen
    for (const training of spielerData.trainings) {
      const existingPayment = spielerPayments.find(
        p => p.training_id === training.id && p.spieler_id === spielerId
      )

      if (existingPayment) {
        await supabase
          .from('spieler_training_payments')
          .update({ bezahlt: true, bar_bezahlt: true, ausstehend: false })
          .eq('id', existingPayment.id)
      } else {
        await supabase
          .from('spieler_training_payments')
          .insert({
            user_id: userId,
            training_id: training.id,
            spieler_id: spielerId,
            bezahlt: true,
            bar_bezahlt: true,
            ausstehend: false
          })
      }
    }
  }

  // Alle Trainings eines Spielers im Monat als ausstehend/offen markieren (Toggle)
  const toggleAlleAusstehend = async (spielerId: string, currentAusstehend: boolean) => {
    preserveScroll()
    const spielerData = spielerSummary.find(s => s.spieler.id === spielerId)
    if (!spielerData) return

    const newAusstehend = !currentAusstehend

    // Optimistisches Update - sofort alle UI aktualisieren
    const updatedPayments: SpielerTrainingPayment[] = []
    const newPayments: SpielerTrainingPayment[] = []

    for (const training of spielerData.trainings) {
      const existingPayment = spielerPayments.find(
        p => p.training_id === training.id && p.spieler_id === spielerId
      )

      if (existingPayment) {
        updatedPayments.push({ ...existingPayment, bezahlt: false, bar_bezahlt: false, ausstehend: newAusstehend })
      } else {
        newPayments.push({
          id: `temp-${training.id}-${spielerId}`,
          user_id: userId,
          training_id: training.id,
          spieler_id: spielerId,
          bezahlt: false,
          bar_bezahlt: false,
          ausstehend: newAusstehend,
          created_at: new Date().toISOString()
        })
      }
    }

    setSpielerPayments(prev => {
      const updated = prev.map(p => {
        const match = updatedPayments.find(up => up.id === p.id)
        return match || p
      })
      return [...updated, ...newPayments]
    })

    // Datenbank-Operationen
    for (const training of spielerData.trainings) {
      const existingPayment = spielerPayments.find(
        p => p.training_id === training.id && p.spieler_id === spielerId
      )

      if (existingPayment) {
        await supabase
          .from('spieler_training_payments')
          .update({ bezahlt: false, bar_bezahlt: false, ausstehend: newAusstehend })
          .eq('id', existingPayment.id)
      } else {
        await supabase
          .from('spieler_training_payments')
          .insert({
            user_id: userId,
            training_id: training.id,
            spieler_id: spielerId,
            bezahlt: false,
            bar_bezahlt: false,
            ausstehend: newAusstehend
          })
      }
    }
  }

  // Einzelnes Training für einen Spieler als bezahlt markieren
  const toggleTrainingBezahlt = async (trainingId: string, spielerId: string, currentStatus: boolean) => {
    preserveScroll()
    const existingPayment = spielerPayments.find(
      p => p.training_id === trainingId && p.spieler_id === spielerId
    )

    // Finde das Training um den bar_bezahlt Status zu prüfen
    const training = monthTrainings.find(t => t.id === trainingId)
    const trainingBarBezahlt = training?.bar_bezahlt || false
    const newStatus = !currentStatus

    // Optimistisches Update - sofort UI aktualisieren
    if (existingPayment) {
      setSpielerPayments(prev => prev.map(p =>
        p.id === existingPayment.id ? { ...p, bezahlt: newStatus, ausstehend: false } : p
      ))
    } else {
      // Temporärer Eintrag für optimistisches Update
      const tempPayment: SpielerTrainingPayment = {
        id: `temp-${trainingId}-${spielerId}`,
        user_id: userId,
        training_id: trainingId,
        spieler_id: spielerId,
        bezahlt: newStatus,
        bar_bezahlt: trainingBarBezahlt,
        ausstehend: false,
        created_at: new Date().toISOString()
      }
      setSpielerPayments(prev => [...prev, tempPayment])
    }

    // Datenbank-Operation
    if (existingPayment) {
      await supabase
        .from('spieler_training_payments')
        .update({ bezahlt: newStatus, ausstehend: false })
        .eq('id', existingPayment.id)
    } else {
      await supabase
        .from('spieler_training_payments')
        .insert({
          user_id: userId,
          training_id: trainingId,
          spieler_id: spielerId,
          bezahlt: newStatus,
          bar_bezahlt: trainingBarBezahlt,
          ausstehend: false
        })
    }
  }


  // Korrektur speichern oder aktualisieren
  const saveKorrektur = async (spielerId: string) => {
    preserveScroll()
    setKorrekturSaving(true)
    try {
      const betrag = parseFloat(korrekturBetrag.replace(',', '.'))
      if (isNaN(betrag)) {
        alert('Bitte gültigen Betrag eingeben')
        return
      }

      // Prüfen ob bereits eine Korrektur existiert
      const existingAdjustment = adjustments.find(
        a => a.spieler_id === spielerId && a.monat === selectedMonth
      )

      if (existingAdjustment) {
        // Update
        await supabase
          .from('monthly_adjustments')
          .update({
            betrag,
            grund: korrekturGrund || null
          })
          .eq('id', existingAdjustment.id)
      } else {
        // Insert
        await supabase
          .from('monthly_adjustments')
          .insert({
            user_id: userId,
            spieler_id: spielerId,
            monat: selectedMonth,
            betrag,
            grund: korrekturGrund || null
          })
      }

      setShowKorrekturModal(null)
      setKorrekturBetrag('')
      setKorrekturGrund('')
      onUpdate()
    } catch (error) {
      console.error('Fehler beim Speichern der Korrektur:', error)
      alert('Fehler beim Speichern')
    } finally {
      setKorrekturSaving(false)
    }
  }

  // Korrektur löschen
  const deleteKorrektur = async (spielerId: string) => {
    preserveScroll()
    const existingAdjustment = adjustments.find(
      a => a.spieler_id === spielerId && a.monat === selectedMonth
    )
    if (!existingAdjustment) return

    const confirmed = await showConfirm('Korrektur löschen', 'Korrektur wirklich löschen?')
    if (!confirmed) return

    await supabase
      .from('monthly_adjustments')
      .delete()
      .eq('id', existingAdjustment.id)

    setShowKorrekturModal(null)
    setKorrekturBetrag('')
    setKorrekturGrund('')
    onUpdate()
  }

  // Modal für Korrektur öffnen
  const openKorrekturModal = (spielerId: string) => {
    const existingAdjustment = adjustments.find(
      a => a.spieler_id === spielerId && a.monat === selectedMonth
    )
    if (existingAdjustment) {
      setKorrekturBetrag(existingAdjustment.betrag.toString())
      setKorrekturGrund(existingAdjustment.grund || '')
    } else {
      setKorrekturBetrag('')
      setKorrekturGrund('')
    }
    setShowKorrekturModal(spielerId)
  }

  // Training-Korrektur Modal öffnen
  const openTrainingKorrekturModal = (training: Training) => {
    setTrainingKorrekturBetrag(training.korrektur_betrag?.toString() || '')
    setTrainingKorrekturGrund(training.korrektur_grund || '')
    setShowTrainingKorrekturModal(training)
  }

  // Training-Korrektur speichern
  const saveTrainingKorrektur = async () => {
    preserveScroll()
    if (!showTrainingKorrekturModal) return

    const betrag = trainingKorrekturBetrag ? parseFloat(trainingKorrekturBetrag.replace(',', '.')) : null

    await supabase
      .from('trainings')
      .update({
        korrektur_betrag: betrag,
        korrektur_grund: trainingKorrekturGrund || null
      })
      .eq('id', showTrainingKorrekturModal.id)

    setShowTrainingKorrekturModal(null)
    setTrainingKorrekturBetrag('')
    setTrainingKorrekturGrund('')
    onUpdate()
  }

  // Training-Korrektur löschen
  const deleteTrainingKorrektur = async () => {
    preserveScroll()
    if (!showTrainingKorrekturModal) return
    const confirmed = await showConfirm('Korrektur entfernen', 'Korrektur wirklich entfernen?')
    if (!confirmed) return

    await supabase
      .from('trainings')
      .update({
        korrektur_betrag: null,
        korrektur_grund: null
      })
      .eq('id', showTrainingKorrekturModal.id)

    setShowTrainingKorrekturModal(null)
    setTrainingKorrekturBetrag('')
    setTrainingKorrekturGrund('')
    onUpdate()
  }

  // Toggle einzelnes Training für Bulk-Auswahl
  const toggleTrainingBulkSelection = (trainingId: string) => {
    setSelectedTrainingsForBulk(prev => {
      const newSet = new Set(prev)
      if (newSet.has(trainingId)) {
        newSet.delete(trainingId)
      } else {
        newSet.add(trainingId)
      }
      return newSet
    })
  }

  // Ausgewählte Trainings als bezahlt markieren
  const markSelectedTrainingsAsBezahlt = async (spielerId: string) => {
    preserveScroll()
    if (selectedTrainingsForBulk.size === 0) return

    for (const trainingId of selectedTrainingsForBulk) {
      const existingPayment = spielerPayments.find(
        p => p.training_id === trainingId && p.spieler_id === spielerId
      )

      if (existingPayment) {
        if (!existingPayment.bezahlt) {
          await supabase
            .from('spieler_training_payments')
            .update({ bezahlt: true })
            .eq('id', existingPayment.id)
        }
      } else {
        const training = monthTrainings.find(t => t.id === trainingId)
        await supabase
          .from('spieler_training_payments')
          .insert({
            user_id: userId,
            training_id: trainingId,
            spieler_id: spielerId,
            bezahlt: true,
            bar_bezahlt: training?.bar_bezahlt || false
          })
      }
    }

    setSelectedTrainingsForBulk(new Set())
    onUpdate()
  }

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Gesamtumsatz</div>
          <div className="stat-value" style={{ color: '#3B82F6' }}>{stats.total.toFixed(2)} €</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Bar bezahlt</div>
          <div className="stat-value" style={{ color: '#10B981' }}>{stats.bar.toFixed(2)} €</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Bezahlt</div>
          <div className="stat-value" style={{ color: '#22C55E' }}>
            {stats.bezahlt.toFixed(2)} €
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Offen</div>
          <div className="stat-value" style={{ color: '#6B7280' }}>
            {stats.offen.toFixed(2)} €
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-header-actions">
            <div className="filter-pills" style={{ flexWrap: 'wrap', gap: 8 }}>
              <input
                type="month"
                className="form-control"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value)
                  setSelectedTag('')
                }}
                style={{ width: 'auto', minWidth: 140 }}
              />
              <select
                className="form-control"
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                style={{ width: 'auto' }}
              >
                <option value="alle">Alle</option>
                <option value="bezahlt">Nur bezahlt</option>
                <option value="ausstehend">Nur ausstehend</option>
                <option value="offen">Nur offen</option>
                <option value="bar">Nur bar</option>
              </select>
              <select
                className="form-control"
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value as typeof filterType)
                  setSelectedSpielerId('')
                  setSelectedTag('')
                }}
                style={{ width: 'auto' }}
              >
                <option value="keine">Weitere Filter...</option>
                <option value="spieler">Nach Spieler</option>
                <option value="tag">Nach Tag</option>
              </select>
              {filterType === 'spieler' && (
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Spieler suchen..."
                    value={spielerSuche}
                    onChange={(e) => {
                      setSpielerSuche(e.target.value)
                      if (!e.target.value) setSelectedSpielerId('')
                    }}
                    style={{ width: 'auto', minWidth: 180 }}
                  />
                  {spielerSuche && !selectedSpielerId && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'white',
                      border: '1px solid var(--gray-200)',
                      borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      zIndex: 1000,
                      maxHeight: 200,
                      overflowY: 'auto'
                    }}>
                      {spielerSummary
                        .filter(s => s.spieler.name.toLowerCase().includes(spielerSuche.toLowerCase()))
                        .map(s => (
                          <div
                            key={s.spieler.id}
                            onClick={() => {
                              setSelectedSpielerId(s.spieler.id)
                              setSpielerSuche(s.spieler.name)
                            }}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--gray-100)'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-50)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                          >
                            {s.spieler.name}
                          </div>
                        ))}
                      {spielerSummary.filter(s => s.spieler.name.toLowerCase().includes(spielerSuche.toLowerCase())).length === 0 && (
                        <div style={{ padding: '8px 12px', color: 'var(--gray-500)' }}>Kein Spieler gefunden</div>
                      )}
                    </div>
                  )}
                  {selectedSpielerId && (
                    <button
                      onClick={() => {
                        setSelectedSpielerId('')
                        setSpielerSuche('')
                      }}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--gray-500)',
                        fontSize: 16
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}
              {filterType === 'tag' && (
                <select
                  className="form-control"
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  style={{ width: 'auto', minWidth: 150 }}
                >
                  <option value="">Tag wählen...</option>
                  {tageImMonat.map(tag => (
                    <option key={tag} value={tag}>
                      {formatDateGerman(tag)}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowManuelleRechnungModal(true)}>
                + Sonstige Rechnung
              </button>
              <button className="btn btn-primary" onClick={() => setShowInvoiceModal(true)}>
                Rechnung erstellen
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="table-container desktop-table">
          <table>
            <thead>
              <tr>
                <th>Spieler</th>
                <th>Trainings</th>
                <th>Summe</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredSummary.map((item) => (
                <tr
                  key={item.spieler.id}
                  onClick={() => setSelectedSpielerDetail(item.spieler.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ color: 'var(--primary)', fontWeight: 500 }}>{item.spieler.name}</td>
                  <td>{item.trainings.length} Trainings</td>
                  <td>
                    {item.summe.toFixed(2)} €
                    {item.barSumme > 0 && (
                      <span style={{ color: 'var(--warning)', fontSize: 12, marginLeft: 8 }}>
                        ({item.barSumme.toFixed(2)} € bar)
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`status-badge ${item.bezahlt ? 'bezahlt' : item.ausstehend ? 'ausstehend' : 'offen'}`}>
                      {item.bezahlt ? 'Bezahlt' : item.ausstehend ? 'Ausstehend' : 'Offen'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleAlleBezahlt(item.spieler.id, item.bezahlt)
                        }}
                      >
                        {item.bezahlt ? 'Offen' : 'Bezahlt'}
                      </button>
                      {!item.bezahlt && (
                        <>
                          <button
                            className="btn btn-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleAlleAusstehend(item.spieler.id, item.ausstehend)
                            }}
                            style={{
                              background: item.ausstehend ? '#6B7280' : '#F59E0B',
                              color: 'white',
                              borderColor: item.ausstehend ? '#6B7280' : '#F59E0B'
                            }}
                            title={item.ausstehend ? "Zurück auf offen setzen" : "Als ausstehend markieren"}
                          >
                            {item.ausstehend ? 'Offen' : 'Ausstehend'}
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleAlleBarBezahlt(item.spieler.id)
                            }}
                            style={{ background: '#10B981', color: 'white', borderColor: '#10B981' }}
                            title="Alle Trainings als bar bezahlt markieren"
                          >
                            Bar
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSummary.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-state">
                    Keine Abrechnungen für diesen Monat
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List */}
        <div className="mobile-card-list">
          {filteredSummary.map((item) => (
            <div
              key={item.spieler.id}
              className="mobile-card"
              onClick={() => setSelectedSpielerDetail(item.spieler.id)}
              style={{ cursor: 'pointer' }}
            >
              <div className="mobile-card-header">
                <div>
                  <div className="mobile-card-title" style={{ color: 'var(--primary)' }}>{item.spieler.name}</div>
                  <div className="mobile-card-subtitle">{item.trainings.length} Trainings</div>
                </div>
                <span className={`status-badge ${item.bezahlt ? 'bezahlt' : item.ausstehend ? 'ausstehend' : 'offen'}`}>
                  {item.bezahlt ? 'Bezahlt' : item.ausstehend ? 'Ausstehend' : 'Offen'}
                </span>
              </div>
              <div className="mobile-card-body">
                <div className="mobile-card-row">
                  <span className="mobile-card-label">Summe</span>
                  <span className="mobile-card-value" style={{ fontWeight: 600 }}>
                    {item.summe.toFixed(2)} €
                  </span>
                </div>
                {item.barSumme > 0 && (
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">davon bar</span>
                    <span className="mobile-card-value" style={{ color: 'var(--warning)' }}>
                      {item.barSumme.toFixed(2)} €
                    </span>
                  </div>
                )}
              </div>
              <div className="mobile-card-actions">
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleAlleBezahlt(item.spieler.id, item.bezahlt)
                  }}
                >
                  {item.bezahlt ? 'Offen' : 'Bezahlt'}
                </button>
                {!item.bezahlt && (
                  <>
                    <button
                      className="btn btn-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleAlleAusstehend(item.spieler.id, item.ausstehend)
                      }}
                      style={{
                        background: item.ausstehend ? '#6B7280' : '#F59E0B',
                        color: 'white',
                        borderColor: item.ausstehend ? '#6B7280' : '#F59E0B'
                      }}
                    >
                      {item.ausstehend ? 'Offen' : 'Ausstehend'}
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleAlleBarBezahlt(item.spieler.id)
                      }}
                      style={{ background: '#10B981', color: 'white', borderColor: '#10B981' }}
                    >
                      Bar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {filteredSummary.length === 0 && (
            <div className="empty-state">Keine Abrechnungen für diesen Monat</div>
          )}
        </div>
      </div>

      {/* Spieler Detail Modal */}
      {selectedSpielerDetail && (() => {
        const detail = spielerSummary.find(s => s.spieler.id === selectedSpielerDetail)
        if (!detail) return null

        // WICHTIG: Erst alle Trainings des Monats sortieren und monatliche Tarife tracken
        // damit wir wissen, welches Training das ERSTE des monatlichen Tarifs ist
        const alleTrainingsSortiert = [...detail.trainings].sort((a, b) => a.datum.localeCompare(b.datum))

        // Tracking über ALLE Trainings des Monats, um zu wissen welches das erste ist
        const monatlicheErstesTraining = new Map<string, string>() // tarifKey -> erstes training.id
        alleTrainingsSortiert.forEach(t => {
          const tarif = tarife.find(ta => ta.id === t.tarif_id)
          const abrechnungsart = t.custom_abrechnung || tarif?.abrechnung || 'proTraining'
          if (abrechnungsart === 'monatlich') {
            const monatlichKey = t.tarif_id || t.id
            if (!monatlicheErstesTraining.has(monatlichKey)) {
              monatlicheErstesTraining.set(monatlichKey, t.id)
            }
          }
        })

        // Filtere Trainings nach Tag wenn Tag-Filter aktiv
        const gefilterteTrainings = filterType === 'tag' && selectedTag
          ? detail.trainings.filter(t => t.datum === selectedTag)
          : detail.trainings

        // Berechne Betrag pro Training (mit korrektem monatlichen Tracking)
        const trainingsDetail = gefilterteTrainings
          .sort((a, b) => a.datum.localeCompare(b.datum))
          .map(t => {
            const tarif = tarife.find(ta => ta.id === t.tarif_id)
            const preis = t.custom_preis_pro_stunde || tarif?.preis_pro_stunde || 0
            const duration = calculateDuration(t.uhrzeit_von, t.uhrzeit_bis)
            const abrechnungsart = t.custom_abrechnung || tarif?.abrechnung || 'proTraining'

            let basisBetrag = 0
            let istMonatlicheSerieErstesTraining = false

            if (abrechnungsart === 'monatlich') {
              // Monatlicher Tarif: nur einmal pro Tarif pro Monat berechnen
              // Prüfe ob dieses Training das ERSTE des Monats für diesen Tarif ist
              const monatlichKey = t.tarif_id || t.id
              const erstesTrainingId = monatlicheErstesTraining.get(monatlichKey)
              if (t.id === erstesTrainingId) {
                basisBetrag = preis // Monatsbetrag, nicht pro Stunde
                istMonatlicheSerieErstesTraining = true
              }
              // Sonst: basisBetrag bleibt 0, da Tarif bereits beim ersten Training berechnet
            } else {
              basisBetrag = preis * duration
              if (abrechnungsart === 'proSpieler') {
                basisBetrag = basisBetrag / t.spieler_ids.length
              }
            }

            // Korrektur anwenden (z.B. Kartenlesergebühren abziehen)
            const korrektur = t.korrektur_betrag || 0
            const betrag = basisBetrag + korrektur
            return { training: t, basisBetrag, korrektur, betrag, tarif, istMonatlicheSerieErstesTraining, abrechnungsart }
          })

        // Berechne gefilterte Summen mit korrektem Bezahlstatus
        const gefilterteSumme = trainingsDetail.reduce((sum, t) => sum + t.betrag, 0)
        const gefilterteBarSumme = trainingsDetail.filter(t => {
          const ps = getSpielerPaymentStatus(detail.spieler.id, t.training)
          return ps.barBezahlt
        }).reduce((sum, t) => sum + t.betrag, 0)
        const gefilterteBezahltSumme = trainingsDetail.filter(t => {
          const ps = getSpielerPaymentStatus(detail.spieler.id, t.training)
          return ps.bezahlt && !ps.barBezahlt
        }).reduce((sum, t) => sum + t.betrag, 0)
        const gefilterteOffeneSumme = trainingsDetail.filter(t => {
          const ps = getSpielerPaymentStatus(detail.spieler.id, t.training)
          return !ps.bezahlt && !ps.barBezahlt
        }).reduce((sum, t) => sum + t.betrag, 0)

        return (
          <div className="modal-overlay" onClick={() => setSelectedSpielerDetail(null)}>
            <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Trainings von {detail.spieler.name}</h3>
                <button className="modal-close" onClick={() => setSelectedSpielerDetail(null)}>×</button>
              </div>
              <div className="modal-body">
                <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                  <div>
                    <strong>{filterType === 'tag' && selectedTag ? 'Tag:' : 'Monat:'}</strong> {filterType === 'tag' && selectedTag ? formatDateGerman(selectedTag) : selectedMonth}
                  </div>
                  <div>
                    <strong>Gesamt:</strong> {gefilterteSumme.toFixed(2)} €
                  </div>
                  {gefilterteBarSumme > 0 && (
                    <div style={{ color: 'var(--warning)' }}>
                      <strong>Bar:</strong> {gefilterteBarSumme.toFixed(2)} €
                    </div>
                  )}
                  {gefilterteBezahltSumme > 0 && (
                    <div style={{ color: 'var(--success)' }}>
                      <strong>Bezahlt:</strong> {gefilterteBezahltSumme.toFixed(2)} €
                    </div>
                  )}
                  {gefilterteOffeneSumme > 0 && (
                    <div style={{ color: 'var(--danger)' }}>
                      <strong>Offen:</strong> {gefilterteOffeneSumme.toFixed(2)} €
                    </div>
                  )}
                </div>

                {/* Bulk-Auswahl für Trainings */}
                {(() => {
                  const offeneTrainings = trainingsDetail.filter(t => {
                    const ps = getSpielerPaymentStatus(detail.spieler.id, t.training)
                    return !ps.bezahlt && !ps.barBezahlt
                  })
                  const alleOffenenAusgewaehlt = offeneTrainings.length > 0 &&
                    offeneTrainings.every(t => selectedTrainingsForBulk.has(t.training.id))

                  return offeneTrainings.length > 0 && (
                    <div style={{
                      padding: '12px',
                      background: selectedTrainingsForBulk.size > 0 ? 'var(--status-durchgefuehrt-bg)' : 'var(--gray-50)',
                      borderRadius: 8,
                      marginBottom: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      flexWrap: 'wrap'
                    }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={alleOffenenAusgewaehlt}
                          onChange={() => {
                            if (alleOffenenAusgewaehlt) {
                              setSelectedTrainingsForBulk(new Set())
                            } else {
                              setSelectedTrainingsForBulk(new Set(offeneTrainings.map(t => t.training.id)))
                            }
                          }}
                        />
                        <span style={{ fontWeight: 500 }}>
                          {alleOffenenAusgewaehlt ? 'Alle abwählen' : `Alle ${offeneTrainings.length} offenen auswählen`}
                        </span>
                      </label>
                      {selectedTrainingsForBulk.size > 0 && (
                        <>
                          <span style={{ color: 'var(--status-durchgefuehrt-text)' }}>
                            {selectedTrainingsForBulk.size} ausgewählt
                          </span>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => markSelectedTrainingsAsBezahlt(detail.spieler.id)}
                            style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
                          >
                            ✓ Als bezahlt markieren
                          </button>
                        </>
                      )}
                    </div>
                  )
                })()}

                <div className="table-container" style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 30 }}></th>
                        <th>Datum</th>
                        <th>Uhrzeit</th>
                        <th>Tarif</th>
                        <th style={{ textAlign: 'right' }}>Betrag</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                        <th style={{ textAlign: 'center' }}>Korrektur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trainingsDetail.map(({ training, basisBetrag, korrektur, betrag, tarif, istMonatlicheSerieErstesTraining, abrechnungsart }) => {
                        const istMonatlich = abrechnungsart === 'monatlich'
                        const paymentStatusRow = getSpielerPaymentStatus(detail.spieler.id, training)
                        const istOffen = !paymentStatusRow.bezahlt && !paymentStatusRow.barBezahlt
                        return (
                          <tr
                            key={training.id}
                            style={{
                              ...(paymentStatusRow.barBezahlt
                                ? { background: 'var(--warning-light)' }
                                : paymentStatusRow.bezahlt
                                ? { background: 'var(--success-light)' }
                                : {}),
                              ...(istMonatlich && !istMonatlicheSerieErstesTraining ? { opacity: 0.6 } : {})
                            }}
                          >
                            <td style={{ textAlign: 'center' }}>
                              {istOffen && (
                                <input
                                  type="checkbox"
                                  checked={selectedTrainingsForBulk.has(training.id)}
                                  onChange={() => toggleTrainingBulkSelection(training.id)}
                                />
                              )}
                            </td>
                            <td
                              style={{ color: 'var(--primary)', cursor: 'pointer' }}
                              onClick={() => {
                                setSelectedSpielerDetail(null)
                                onNavigateToTraining(training)
                              }}
                              title="Klicken um im Kalender zu bearbeiten"
                            >
                              {formatDateGerman(training.datum)}
                            </td>
                            <td>{formatTime(training.uhrzeit_von)} - {formatTime(training.uhrzeit_bis)}</td>
                            <td>
                              {tarif?.name || '-'}
                              {istMonatlich && (
                                <span style={{
                                  background: istMonatlicheSerieErstesTraining ? 'var(--primary)' : 'var(--gray-300)',
                                  color: istMonatlicheSerieErstesTraining ? '#fff' : 'var(--gray-600)',
                                  padding: '1px 4px',
                                  borderRadius: 3,
                                  fontSize: 9,
                                  marginLeft: 4
                                }}>
                                  mtl.
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 500 }}>
                              {istMonatlich && !istMonatlicheSerieErstesTraining ? (
                                <span style={{ color: 'var(--gray-400)', fontSize: 11 }}>inkl.</span>
                              ) : korrektur !== 0 ? (
                                <div>
                                  <span style={{ textDecoration: 'line-through', color: 'var(--gray-400)', fontSize: 11 }}>
                                    {basisBetrag.toFixed(2)} €
                                  </span>
                                  <br />
                                  <span style={{ color: korrektur < 0 ? 'var(--success)' : 'var(--warning)' }}>
                                    {betrag.toFixed(2)} €
                                  </span>
                                </div>
                              ) : (
                                <span>{betrag.toFixed(2)} €</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {paymentStatusRow.barBezahlt ? (
                                <span className="status-badge" style={{ background: 'var(--warning)', color: '#1E40AF', fontSize: 11 }}>
                                  Bar
                                </span>
                              ) : (
                                <button
                                  className={`btn btn-sm ${paymentStatusRow.bezahlt ? 'btn-success' : 'btn-secondary'}`}
                                  style={{ fontSize: 11, padding: '2px 8px' }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleTrainingBezahlt(training.id, detail.spieler.id, paymentStatusRow.bezahlt)
                                  }}
                                >
                                  {paymentStatusRow.bezahlt ? 'Bezahlt' : 'Offen'}
                                </button>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                className={`btn btn-sm ${korrektur !== 0 ? 'btn-warning' : 'btn-secondary'}`}
                                style={{ fontSize: 10, padding: '2px 6px' }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openTrainingKorrekturModal(training)
                                }}
                                title={training.korrektur_grund || 'Betrag korrigieren'}
                              >
                                {korrektur !== 0 ? `${korrektur > 0 ? '+' : ''}${korrektur.toFixed(2)}€` : '±'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 'bold', background: 'var(--gray-100)' }}>
                        <td colSpan={4}>Summe Trainings</td>
                        <td style={{ textAlign: 'right' }}>{gefilterteSumme.toFixed(2)} €</td>
                        <td></td>
                        <td></td>
                      </tr>
                      {detail.adjustment !== 0 && (
                        <tr style={{
                          fontWeight: 'bold',
                          background: detail.adjustment < 0 ? 'var(--success-light)' : 'var(--warning-light)',
                          color: detail.adjustment < 0 ? 'var(--success)' : 'var(--warning)'
                        }}>
                          <td colSpan={4}>
                            Monatskorrektur
                            {adjustments.find(a => a.spieler_id === detail.spieler.id && a.monat === selectedMonth)?.grund && (
                              <span style={{ fontWeight: 'normal', marginLeft: 8, fontSize: 12 }}>
                                ({adjustments.find(a => a.spieler_id === detail.spieler.id && a.monat === selectedMonth)?.grund})
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>{detail.adjustment.toFixed(2)} €</td>
                          <td></td>
                          <td></td>
                        </tr>
                      )}
                      {detail.adjustment !== 0 && (
                        <tr style={{ fontWeight: 'bold', background: 'var(--gray-200)' }}>
                          <td colSpan={4}>Gesamt</td>
                          <td style={{ textAlign: 'right' }}>{(gefilterteSumme + detail.adjustment).toFixed(2)} €</td>
                          <td></td>
                          <td></td>
                        </tr>
                      )}
                    </tfoot>
                  </table>
                </div>

                {/* Korrektur Sektion - nur im Monats-View (nicht Tag-Filter) */}
                {!(filterType === 'tag' && selectedTag) && (
                  <div style={{
                    marginTop: 16,
                    padding: 12,
                    background: 'var(--gray-50)',
                    borderRadius: 8,
                    border: '1px solid var(--gray-200)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>Monatskorrektur</strong>
                        <p style={{ fontSize: 12, color: 'var(--gray-600)', margin: '4px 0 0' }}>
                          z.B. Gutschrift bei Regenausfall, Sonderzuschläge
                        </p>
                      </div>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 13 }}
                        onClick={() => openKorrekturModal(detail.spieler.id)}
                      >
                        {detail.adjustment !== 0 ? 'Korrektur bearbeiten' : 'Korrektur hinzufügen'}
                      </button>
                    </div>
                  </div>
                )}

              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setSelectedSpielerDetail(null)}>
                  Schließen
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Invoice Modal */}
      {showInvoiceModal && (
        <InvoiceModal
          spieler={spieler}
          spielerSummary={spielerSummary}
          tarife={tarife}
          profile={profile}
          selectedMonth={selectedMonth}
          pdfVorlagen={pdfVorlagen}
          userId={userId}
          onUpdate={onUpdate}
          onClose={() => {
            setShowInvoiceModal(false)
          }}
        />
      )}

      {/* Manuelle Rechnung Modal */}
      {showManuelleRechnungModal && (
        <ManuelleRechnungModal
          profile={profile}
          selectedMonth={selectedMonth}
          userId={userId}
          onClose={() => setShowManuelleRechnungModal(false)}
          onSave={() => {
            setShowManuelleRechnungModal(false)
            onUpdate()
          }}
        />
      )}

      {/* Korrektur Modal */}
      {showKorrekturModal && (() => {
        const korrekturSpieler = spieler.find(s => s.id === showKorrekturModal)
        const existingAdjustment = adjustments.find(
          a => a.spieler_id === showKorrekturModal && a.monat === selectedMonth
        )
        return (
          <div className="modal-overlay" onClick={() => setShowKorrekturModal(null)}>
            <div className="modal" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Monatskorrektur</h3>
                <button className="modal-close" onClick={() => setShowKorrekturModal(null)}>×</button>
              </div>
              <div className="modal-body">
                <div style={{ marginBottom: 16 }}>
                  <strong>Spieler:</strong> {korrekturSpieler?.name}<br />
                  <strong>Monat:</strong> {selectedMonth}
                </div>

                <div className="form-group">
                  <label>Betrag (€)</label>
                  <input
                    type="text"
                    value={korrekturBetrag}
                    onChange={e => setKorrekturBetrag(e.target.value)}
                    placeholder="-15.00 für Gutschrift, 10.00 für Zuschlag"
                    style={{ fontFamily: 'monospace' }}
                  />
                  <small style={{ color: 'var(--gray-500)', display: 'block', marginTop: 4 }}>
                    Negativer Wert = Gutschrift (z.B. Regenausfall)<br />
                    Positiver Wert = Zuschlag
                  </small>
                </div>

                <div className="form-group">
                  <label>Grund (optional)</label>
                  <input
                    type="text"
                    value={korrekturGrund}
                    onChange={e => setKorrekturGrund(e.target.value)}
                    placeholder="z.B. Regenausfall 05.12., Materialkosten"
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                <div>
                  {existingAdjustment && (
                    <button
                      className="btn btn-danger"
                      onClick={() => deleteKorrektur(showKorrekturModal)}
                      disabled={korrekturSaving}
                    >
                      Löschen
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary" onClick={() => setShowKorrekturModal(null)}>
                    Abbrechen
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => saveKorrektur(showKorrekturModal)}
                    disabled={korrekturSaving || !korrekturBetrag}
                  >
                    {korrekturSaving ? 'Speichern...' : 'Speichern'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Training-Korrektur Modal */}
      {showTrainingKorrekturModal && (() => {
        const training = showTrainingKorrekturModal
        const tarif = tarife.find(t => t.id === training.tarif_id)
        const preis = training.custom_preis_pro_stunde || tarif?.preis_pro_stunde || 0
        const duration = calculateDuration(training.uhrzeit_von, training.uhrzeit_bis)
        const abrechnungsart = training.custom_abrechnung || tarif?.abrechnung || 'proTraining'
        let basisBetrag = preis * duration
        if (abrechnungsart === 'proSpieler') {
          basisBetrag = basisBetrag / training.spieler_ids.length
        }

        return (
          <div className="modal-overlay" onClick={() => setShowTrainingKorrekturModal(null)}>
            <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Betrag korrigieren</h3>
                <button className="modal-close" onClick={() => setShowTrainingKorrekturModal(null)}>×</button>
              </div>
              <div className="modal-body">
                <div style={{ marginBottom: 16, padding: 12, background: 'var(--gray-50)', borderRadius: 8 }}>
                  <div><strong>Datum:</strong> {formatDateGerman(training.datum)}</div>
                  <div><strong>Uhrzeit:</strong> {formatTime(training.uhrzeit_von)} - {formatTime(training.uhrzeit_bis)}</div>
                  <div><strong>Tarif:</strong> {tarif?.name || '-'}</div>
                  <div><strong>Basis-Betrag:</strong> {basisBetrag.toFixed(2)} €</div>
                </div>

                <div className="form-group">
                  <label>Korrektur-Betrag (€)</label>
                  <input
                    type="text"
                    value={trainingKorrekturBetrag}
                    onChange={e => setTrainingKorrekturBetrag(e.target.value)}
                    placeholder="-1.50 für Abzug, 5.00 für Zuschlag"
                    style={{ fontFamily: 'monospace' }}
                  />
                  <small style={{ color: 'var(--gray-500)', display: 'block', marginTop: 4 }}>
                    Negativer Wert = Abzug (z.B. -1.50 € Kartenlesergebühren)<br />
                    Positiver Wert = Zuschlag
                  </small>
                </div>

                <div className="form-group">
                  <label>Grund</label>
                  <input
                    type="text"
                    value={trainingKorrekturGrund}
                    onChange={e => setTrainingKorrekturGrund(e.target.value)}
                    placeholder="z.B. Kartenlesergebühren, Materialkosten"
                  />
                </div>

                {trainingKorrekturBetrag && (
                  <div style={{
                    padding: 12,
                    background: parseFloat(trainingKorrekturBetrag.replace(',', '.')) < 0 ? 'var(--success-light)' : 'var(--warning-light)',
                    borderRadius: 8,
                    marginTop: 16
                  }}>
                    <strong>Neuer Betrag:</strong>{' '}
                    {(basisBetrag + (parseFloat(trainingKorrekturBetrag.replace(',', '.')) || 0)).toFixed(2)} €
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                <div>
                  {training.korrektur_betrag && (
                    <button
                      className="btn btn-danger"
                      onClick={deleteTrainingKorrektur}
                    >
                      Entfernen
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary" onClick={() => setShowTrainingKorrekturModal(null)}>
                    Abbrechen
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={saveTrainingKorrektur}
                  >
                    Speichern
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}

// ============ INVOICE MODAL ============
function InvoiceModal({
  spieler,
  spielerSummary,
  tarife,
  profile,
  selectedMonth,
  pdfVorlagen,
  onClose,
  userId,
  onUpdate
}: {
  spieler: Spieler[]
  spielerSummary: {
    spieler: Spieler
    trainings: Training[]
    summe: number
    offeneSumme: number
    barSumme: number
    bezahltSumme: number
    bezahlt: boolean
  }[]
  tarife: Tarif[]
  profile: TrainerProfile | null
  selectedMonth: string
  pdfVorlagen: PdfVorlage[]
  onClose: () => void
  userId: string
  onUpdate: () => void
}) {
  const [step, setStep] = useState(1)
  const [selectedSpielerId, setSelectedSpielerId] = useState('')
  const [iban, setIban] = useState(profile?.iban || '')
  const [adresse, setAdresse] = useState(profile?.adresse || '')
  const [ustIdNr, setUstIdNr] = useState(profile?.ust_id_nr || '')
  const [kleinunternehmer, setKleinunternehmer] = useState(profile?.kleinunternehmer || false)

  const [rechnungsstellerName, setRechnungsstellerName] = useState(
    `${profile?.name || ''} ${profile?.nachname || ''}`.trim()
  )
  const [rechnungsstellerAdresse, setRechnungsstellerAdresse] = useState(profile?.adresse || '')
  const [rechnungsempfaengerName, setRechnungsempfaengerName] = useState('')
  const [rechnungsempfaengerAdresse, setRechnungsempfaengerAdresse] = useState('')
  const [rechnungsnummer, setRechnungsnummer] = useState(generateRechnungsnummer())
  const [rechnungsdatum, setRechnungsdatum] = useState(formatDate(new Date()))

  // PDF-Vorlage Auswahl (leer = Standard-Vorlage verwenden)
  const [selectedPdfVorlageId, setSelectedPdfVorlageId] = useState('')

  // Manuelle Korrektur (z.B. Regenausfall)
  const [korrekturBetrag, setKorrekturBetrag] = useState('')
  const [korrekturGrund, setKorrekturGrund] = useState('')

  // E-Mail-Versand State
  const [sendingEmail, setSendingEmail] = useState(false)

  // Option: Als offenen Posten speichern (für Buchhaltung)
  const [alsOffenenPostenSpeichern, setAlsOffenenPostenSpeichern] = useState(true)

  // Vorschau-Modus: 'edit' | 'pdf' | 'email'
  const [previewMode, setPreviewMode] = useState<'edit' | 'pdf' | 'email'>('edit')

  // Benutzerdefinierter E-Mail-Text (leer = automatisch generiert)
  const [customEmailText, setCustomEmailText] = useState('')
  const [customEmailBetreff, setCustomEmailBetreff] = useState('')

  // Benutzerdefinierter PDF-Inhalt (leer = automatisch generiert)
  const [customPdfHtml, setCustomPdfHtml] = useState('')

  // Trainingsaufstellung für den ausgewählten Spieler
  const selectedSummary = spielerSummary.find((s) => s.spieler.id === selectedSpielerId)

  // Finde Spieler die diesen Spieler als Rechnungsempfänger haben (z.B. Geschwister)
  const verknuepfteSpieler = useMemo(() => {
    if (!selectedSpielerId) return []
    return spieler.filter(s => s.rechnungs_spieler_id === selectedSpielerId)
  }, [selectedSpielerId, spieler])

  // Summaries der verknüpften Spieler
  const verknuepfteSummaries = useMemo(() => {
    return verknuepfteSpieler.map(vs => ({
      spieler: vs,
      summary: spielerSummary.find(ss => ss.spieler.id === vs.id)
    })).filter(v => v.summary && v.summary.trainings.length > 0)
  }, [verknuepfteSpieler, spielerSummary])

  // Berechne die Positionen mit USt-Details (ohne bar bezahlte Trainings)
  // Inkludiert auch Trainings von verknüpften Spielern (Geschwister)
  const rechnungsPositionen = useMemo(() => {
    if (!selectedSummary) return []

    // Sammle alle Trainings: eigene + verknüpfte Spieler
    const alleTrainings: { training: Training; spielerName: string; spielerId: string }[] = []

    // Eigene Trainings (ohne bar bezahlte)
    selectedSummary.trainings.filter(t => !t.bar_bezahlt).forEach(t => {
      alleTrainings.push({ training: t, spielerName: selectedSummary.spieler.name, spielerId: selectedSummary.spieler.id })
    })

    // Trainings von verknüpften Spielern (ohne bar bezahlte)
    verknuepfteSummaries.forEach(vs => {
      if (vs.summary) {
        vs.summary.trainings.filter(t => !t.bar_bezahlt).forEach(t => {
          alleTrainings.push({ training: t, spielerName: vs.spieler.name, spielerId: vs.spieler.id })
        })
      }
    })

    // Sortiere nach Datum für korrekte monatliche Berechnung
    alleTrainings.sort((a, b) => a.training.datum.localeCompare(b.training.datum))

    // Track monatliche Serien pro Spieler: "spielerId|serieId"
    const monatlicheSerienTracking = new Set<string>()

    return alleTrainings.map(({ training: t, spielerName, spielerId }) => {
      const tarif = tarife.find((ta) => ta.id === t.tarif_id)
      const preis = t.custom_preis_pro_stunde || tarif?.preis_pro_stunde || 0
      const duration = calculateDuration(t.uhrzeit_von, t.uhrzeit_bis)
      const abrechnungsart = t.custom_abrechnung || tarif?.abrechnung || 'proTraining'

      let einzelPreis = 0
      let istMonatlich = false
      let istMonatlicheSerieErstesTraining = false

      if (abrechnungsart === 'monatlich') {
        istMonatlich = true
        // Monatlicher Tarif: nur einmal pro Tarif pro Spieler berechnen
        const monatlichKey = t.tarif_id || t.id
        const trackingKey = `${spielerId}|${monatlichKey}`
        if (!monatlicheSerienTracking.has(trackingKey)) {
          monatlicheSerienTracking.add(trackingKey)
          einzelPreis = preis // Monatsbetrag, nicht pro Stunde
          istMonatlicheSerieErstesTraining = true
        }
        // Sonst: einzelPreis bleibt 0
      } else {
        einzelPreis = preis * duration
        if (abrechnungsart === 'proSpieler') {
          einzelPreis = einzelPreis / t.spieler_ids.length
        }
      }

      // Training-Korrektur anwenden
      einzelPreis += (t.korrektur_betrag || 0)

      // USt-Berechnung basierend auf Tarif
      const inklUst = tarif?.inkl_ust ?? true
      const ustSatz = tarif?.ust_satz ?? 19

      let netto: number
      let ust: number
      let brutto: number

      if (kleinunternehmer || ustSatz === 0) {
        netto = einzelPreis
        ust = 0
        brutto = einzelPreis
      } else if (inklUst) {
        // Preis ist bereits inkl. USt
        brutto = einzelPreis
        netto = brutto / (1 + ustSatz / 100)
        ust = brutto - netto
      } else {
        // Preis ist netto
        netto = einzelPreis
        ust = netto * (ustSatz / 100)
        brutto = netto + ust
      }

      // Bei monatlichem Tarif: Zeitraum statt einzelnes Datum
      let anzeigedatum = t.datum
      let anzeigezeit = `${t.uhrzeit_von} - ${t.uhrzeit_bis}`

      if (istMonatlich && istMonatlicheSerieErstesTraining) {
        // Ermittle den Monatszeitraum aus selectedMonth (Format: YYYY-MM)
        const [year, month] = selectedMonth.split('-').map(Number)
        const ersterTag = new Date(year, month - 1, 1)
        const letzterTag = new Date(year, month, 0) // Letzter Tag des Monats
        const formatTag = (d: Date) => `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`
        anzeigedatum = `${formatTag(ersterTag)} - ${formatTag(letzterTag)}`
        // Zeit beibehalten (Trainingszeit anzeigen)
      }

      return {
        trainingId: t.id,
        datum: anzeigedatum,
        zeit: anzeigezeit,
        dauer: duration,
        tarifName: tarif?.name || 'Unbekannt',
        spielerName,
        spielerId,
        ustSatz,
        netto,
        ust,
        brutto,
        istMonatlich,
        istMonatlicheSerieErstesTraining
      }
    }).filter(p => p.brutto !== 0 || p.netto !== 0) // Entferne 0€-Positionen (außer dem ersten monatlichen Training)
  }, [selectedSummary, verknuepfteSummaries, tarife, kleinunternehmer, selectedMonth])

  // Berechne Gesamtsummen inkl. Korrektur
  const summen = useMemo(() => {
    const netto = rechnungsPositionen.reduce((sum, p) => sum + p.netto, 0)
    const ust = rechnungsPositionen.reduce((sum, p) => sum + p.ust, 0)
    const brutto = rechnungsPositionen.reduce((sum, p) => sum + p.brutto, 0)

    // Korrektur (Brutto-Betrag, z.B. -10 für Gutschrift wegen Regenausfall)
    const korrektur = parseFloat(korrekturBetrag) || 0
    // USt aus Korrektur berechnen (wenn nicht Kleinunternehmer)
    const korrekturUst = kleinunternehmer ? 0 : korrektur - (korrektur / 1.19)
    const korrekturNetto = korrektur - korrekturUst

    return {
      netto,
      ust,
      brutto,
      korrekturNetto,
      korrekturUst,
      korrektur,
      gesamtNetto: netto + korrekturNetto,
      gesamtUst: ust + korrekturUst,
      gesamtBrutto: brutto + korrektur
    }
  }, [rechnungsPositionen, korrekturBetrag, kleinunternehmer])

  useEffect(() => {
    if (selectedSpielerId) {
      const sp = spieler.find((s) => s.id === selectedSpielerId)
      if (sp) {
        // Wenn abweichender Rechnungsempfänger eingestellt, diesen verwenden
        if (sp.abweichende_rechnung && sp.rechnungs_empfaenger) {
          setRechnungsempfaengerName(sp.rechnungs_empfaenger)
        } else {
          setRechnungsempfaengerName(sp.name)
        }
        setRechnungsempfaengerAdresse(sp.rechnungs_adresse || '')
      }
    }
  }, [selectedSpielerId, spieler])

  // Vorschau-Daten für PDF und E-Mail generieren
  const vorschauDaten = useMemo(() => {
    if (!selectedSummary) return { pdfHtml: '', emailText: '' }

    const hatMehrereSpieler = verknuepfteSummaries.length > 0

    // Monat formatieren
    const [year, month] = selectedMonth.split('-')
    const monatNamen = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
    const monatFormatiert = `${monatNamen[parseInt(month) - 1]} ${year}`

    // Positionen-Tabelle HTML - Sportliches Design mit Zebra-Streifen
    const positionenHtml = rechnungsPositionen.map((p, idx) => `
      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#EFF6FF'};">
        <td style="padding: 10px; border-bottom: 1px solid #E8E4DF;">${p.istMonatlich ? p.datum : formatDateGerman(p.datum)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #E8E4DF;">${p.zeit}</td>
        <td style="padding: 10px; border-bottom: 1px solid #E8E4DF;">${p.istMonatlich ? 'Monatsbeitrag' : `${p.dauer.toFixed(1)} Std.`}</td>
        ${hatMehrereSpieler ? `<td style="padding: 10px; border-bottom: 1px solid #E8E4DF;">${p.spielerName}</td>` : ''}
        <td style="padding: 10px; border-bottom: 1px solid #E8E4DF;">${p.tarifName}${p.istMonatlich ? ' (mtl.)' : ''}</td>
        <td style="padding: 10px; border-bottom: 1px solid #E8E4DF; text-align: right; font-family: monospace;">${p.netto.toFixed(2)} €</td>
        ${!kleinunternehmer ? `<td style="padding: 10px; border-bottom: 1px solid #E8E4DF; text-align: right; font-family: monospace;">${p.ust.toFixed(2)} €</td>` : ''}
        <td style="padding: 10px; border-bottom: 1px solid #E8E4DF; text-align: right; font-family: monospace; font-weight: 600;">${p.brutto.toFixed(2)} €</td>
      </tr>
    `).join('')

    // Korrekturzeile falls vorhanden - Sportliches Design
    const korrekturColSpan = hatMehrereSpieler ? 4 : 3
    const korrekturHtml = summen.korrektur !== 0 ? `
      <tr style="background: ${summen.korrektur < 0 ? 'linear-gradient(135deg, #DBEAFE 0%, #DBEAFE 100%)' : 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)'};">
        <td colspan="${korrekturColSpan}" style="padding: 10px; border-bottom: 1px solid #E8E4DF;"><em>${korrekturGrund || 'Manuelle Korrektur'}</em></td>
        <td style="padding: 10px; border-bottom: 1px solid #E8E4DF;"><em>Korrektur</em></td>
        <td style="padding: 10px; border-bottom: 1px solid #E8E4DF; text-align: right; font-family: monospace;">${summen.korrekturNetto.toFixed(2)} €</td>
        ${!kleinunternehmer ? `<td style="padding: 10px; border-bottom: 1px solid #E8E4DF; text-align: right; font-family: monospace;">${summen.korrekturUst.toFixed(2)} €</td>` : ''}
        <td style="padding: 10px; border-bottom: 1px solid #E8E4DF; text-align: right; font-family: monospace; font-weight: 600;">${summen.korrektur.toFixed(2)} €</td>
      </tr>
    ` : ''

    // PDF-Vorlage verwenden wenn ausgewählt
    const selectedPdfVorlage = pdfVorlagen.find(v => v.id === selectedPdfVorlageId)

    // Summen-Block - Sportliches Design
    const summenBlockHtml = `
      <div style="background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%); border-radius: 12px; padding: 20px; margin-top: 24px; border-left: 4px solid #3B82F6;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #374151;">
          <span>Nettobetrag:</span>
          <span style="font-family: monospace;">${summen.gesamtNetto.toFixed(2)} €</span>
        </div>
        ${!kleinunternehmer ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #374151;">
          <span>USt (19%):</span>
          <span style="font-family: monospace;">${summen.gesamtUst.toFixed(2)} €</span>
        </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; padding-top: 12px; margin-top: 12px; border-top: 2px solid #3B82F6; font-weight: bold; font-size: 16px; color: #1E40AF;">
          <span>Gesamtbetrag:</span>
          <span style="font-family: monospace; font-size: 18px;">${summen.gesamtBrutto.toFixed(2)} €</span>
        </div>
      </div>
    `

    // Positionen-Tabelle - Sportliches Design
    const positionenTabelle = `
      <table style="width: 100%; border-collapse: separate; border-spacing: 0; margin: 20px 0; font-size: 11px; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <thead>
          <tr style="background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);">
            <th style="padding: 12px 10px; text-align: left; color: white; font-weight: 600;">Datum</th>
            <th style="padding: 12px 10px; text-align: left; color: white; font-weight: 600;">Zeit</th>
            <th style="padding: 12px 10px; text-align: left; color: white; font-weight: 600;">Dauer</th>
            ${hatMehrereSpieler ? '<th style="padding: 12px 10px; text-align: left; color: white; font-weight: 600;">Spieler</th>' : ''}
            <th style="padding: 12px 10px; text-align: left; color: white; font-weight: 600;">Tarif</th>
            <th style="padding: 12px 10px; text-align: right; color: white; font-weight: 600;">Netto</th>
            ${!kleinunternehmer ? '<th style="padding: 12px 10px; text-align: right; color: white; font-weight: 600;">USt</th>' : ''}
            <th style="padding: 12px 10px; text-align: right; color: white; font-weight: 600;">Brutto</th>
          </tr>
        </thead>
        <tbody>
          ${positionenHtml}
          ${korrekturHtml}
        </tbody>
      </table>
    `

    // Klassische Positionen-Tabelle - Professionell ohne Farben
    const positionenHtmlKlassisch = rechnungsPositionen.map((p, idx) => `
      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#EFF6FF'};">
        <td style="padding: 8px; border-bottom: 1px solid #E8E4DF;">${p.istMonatlich ? p.datum : formatDateGerman(p.datum)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #E8E4DF;">${p.zeit}</td>
        <td style="padding: 8px; border-bottom: 1px solid #E8E4DF;">${p.istMonatlich ? 'Monatsbeitrag' : `${p.dauer.toFixed(1)} Std.`}</td>
        ${hatMehrereSpieler ? `<td style="padding: 8px; border-bottom: 1px solid #E8E4DF;">${p.spielerName}</td>` : ''}
        <td style="padding: 8px; border-bottom: 1px solid #E8E4DF;">${p.tarifName}${p.istMonatlich ? ' (mtl.)' : ''}</td>
        <td style="padding: 8px; border-bottom: 1px solid #E8E4DF; text-align: right; font-family: monospace;">${p.netto.toFixed(2)} €</td>
        ${!kleinunternehmer ? `<td style="padding: 8px; border-bottom: 1px solid #E8E4DF; text-align: right; font-family: monospace;">${p.ust.toFixed(2)} €</td>` : ''}
        <td style="padding: 8px; border-bottom: 1px solid #E8E4DF; text-align: right; font-family: monospace; font-weight: 600;">${p.brutto.toFixed(2)} €</td>
      </tr>
    `).join('')

    const korrekturHtmlKlassisch = summen.korrektur !== 0 ? `
      <tr style="background: #EFF6FF;">
        <td colspan="${korrekturColSpan}" style="padding: 8px; border-bottom: 1px solid #E8E4DF;"><em>${korrekturGrund || 'Manuelle Korrektur'}</em></td>
        <td style="padding: 8px; border-bottom: 1px solid #E8E4DF;"><em>Korrektur</em></td>
        <td style="padding: 8px; border-bottom: 1px solid #E8E4DF; text-align: right; font-family: monospace;">${summen.korrekturNetto.toFixed(2)} €</td>
        ${!kleinunternehmer ? `<td style="padding: 8px; border-bottom: 1px solid #E8E4DF; text-align: right; font-family: monospace;">${summen.korrekturUst.toFixed(2)} €</td>` : ''}
        <td style="padding: 8px; border-bottom: 1px solid #E8E4DF; text-align: right; font-family: monospace; font-weight: 600;">${summen.korrektur.toFixed(2)} €</td>
      </tr>
    ` : ''

    const positionenTabelleKlassisch = `
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 11px;">
        <thead>
          <tr style="background: #1E40AF;">
            <th style="padding: 10px 8px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Datum</th>
            <th style="padding: 10px 8px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Zeit</th>
            <th style="padding: 10px 8px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Dauer</th>
            ${hatMehrereSpieler ? '<th style="padding: 10px 8px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Spieler</th>' : ''}
            <th style="padding: 10px 8px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Tarif</th>
            <th style="padding: 10px 8px; text-align: right; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Netto</th>
            ${!kleinunternehmer ? '<th style="padding: 10px 8px; text-align: right; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">USt</th>' : ''}
            <th style="padding: 10px 8px; text-align: right; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Brutto</th>
          </tr>
        </thead>
        <tbody>
          ${positionenHtmlKlassisch}
          ${korrekturHtmlKlassisch}
        </tbody>
      </table>
    `

    // Klassischer Summen-Block - Professionell ohne Farben
    const summenBlockKlassisch = `
      <div style="background: #EFF6FF; border: 1px solid #E8E4DF; padding: 16px; margin-top: 20px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #374151;">
          <span>Nettobetrag:</span>
          <span style="font-family: monospace;">${summen.gesamtNetto.toFixed(2)} €</span>
        </div>
        ${!kleinunternehmer ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #374151;">
          <span>USt (19%):</span>
          <span style="font-family: monospace;">${summen.gesamtUst.toFixed(2)} €</span>
        </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; padding-top: 10px; margin-top: 10px; border-top: 2px solid #1E40AF; font-weight: bold; font-size: 14px; color: #1E40AF;">
          <span>Gesamtbetrag:</span>
          <span style="font-family: monospace; font-size: 16px;">${summen.gesamtBrutto.toFixed(2)} €</span>
        </div>
      </div>
    `

    // Spieler-spezifische Daten für SEPA
    const spielerIban = selectedSummary?.spieler.iban || ''
    const spielerMandatsreferenz = selectedSummary?.spieler.mandatsreferenz || ''
    const spielerUnterschriftsdatum = selectedSummary?.spieler.unterschriftsdatum ? formatDateGerman(selectedSummary.spieler.unterschriftsdatum) : ''

    // IBAN maskieren (nur erste 4 und letzte 4 Zeichen zeigen)
    const maskiereIban = (iban: string): string => {
      if (!iban || iban.length < 10) return iban
      const clean = iban.replace(/\s/g, '')
      return clean.substring(0, 4) + ' **** **** ' + clean.substring(clean.length - 4)
    }

    // Platzhalter-Werte
    const platzhalterWerte: Record<string, string> = {
      '{{spieler_name}}': selectedSummary?.spieler.name || '',
      '{{rechnungsnummer}}': rechnungsnummer,
      '{{rechnungsdatum}}': formatDateGerman(rechnungsdatum),
      '{{monat}}': monatFormatiert,
      '{{positionen_tabelle}}': positionenTabelle,
      '{{netto}}': `${summen.gesamtNetto.toFixed(2)} €`,
      '{{ust}}': `${summen.gesamtUst.toFixed(2)} €`,
      '{{brutto}}': `${summen.gesamtBrutto.toFixed(2)} €`,
      '{{iban}}': iban,
      '{{trainer_name}}': rechnungsstellerName,
      '{{trainer_adresse}}': rechnungsstellerAdresse,
      '{{trainer_adresse_html}}': rechnungsstellerAdresse.replace(/\n/g, '<br>') + (profile?.steuernummer ? `<br><span style="color: #6B7280; font-size: 10px;">Steuernummer: ${profile.steuernummer}</span>` : '') + (ustIdNr ? `<br><span style="color: #6B7280; font-size: 10px;">USt-IdNr: ${ustIdNr}</span>` : ''),
      '{{steuernummer}}': profile?.steuernummer || '',
      '{{empfaenger_name}}': rechnungsempfaengerName,
      '{{empfaenger_adresse}}': rechnungsempfaengerAdresse,
      '{{empfaenger_adresse_html}}': rechnungsempfaengerAdresse.replace(/\n/g, '<br>'),
      '{{kleinunternehmer_hinweis}}': kleinunternehmer ? '<p><em>Gemäß §19 UStG wird keine Umsatzsteuer berechnet.</em></p>' : '',
      '{{summen_block}}': summenBlockHtml,
      '{{positionen_tabelle_klassisch}}': positionenTabelleKlassisch,
      '{{summen_block_klassisch}}': summenBlockKlassisch,
      '{{spieler_iban}}': maskiereIban(spielerIban),
      '{{spieler_mandatsreferenz}}': spielerMandatsreferenz,
      '{{spieler_unterschriftsdatum}}': spielerUnterschriftsdatum,
      '{{trainer_steuernummer_block}}': profile?.steuernummer ? `<div style="color: #6B7280; font-size: 10px; margin-top: 8px;">Steuernummer: ${profile.steuernummer}</div>` : '',
    }

    // Funktion zum Ersetzen der Platzhalter
    const ersetzePlatzhalter = (text: string): string => {
      let result = text
      for (const [key, value] of Object.entries(platzhalterWerte)) {
        result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value)
      }
      return result
    }

    // PDF HTML generieren
    let pdfHtml: string
    if (selectedPdfVorlage) {
      pdfHtml = ersetzePlatzhalter(selectedPdfVorlage.inhalt)
    } else {
      // Standard PDF-Layout - Professionelles Design
      pdfHtml = `
        <!-- Header -->
        <div style="background: #3B82F6; margin: -24px -24px 24px -24px; padding: 24px;">
          <h1 style="text-align: center; margin: 0; font-size: 28px; color: white; font-weight: 700; letter-spacing: 2px; ">RECHNUNG</h1>
        </div>

        <!-- Adressbereich -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 24px; gap: 20px;">
          <div style="flex: 1; background: #EFF6FF; padding: 16px; border-left: 3px solid #374151;">
            <div style="font-size: 10px; text-transform: uppercase; color: #6B7280; font-weight: 600; margin-bottom: 8px;">Rechnungssteller</div>
            <div style="font-weight: 600; color: #1E40AF;">${rechnungsstellerName}</div>
            <div style="color: #374151; font-size: 11px; margin-top: 4px;">${rechnungsstellerAdresse.replace(/\n/g, '<br>')}</div>
            ${profile?.steuernummer ? `<div style="color: #6B7280; font-size: 10px; margin-top: 8px;">Steuernummer: ${profile?.steuernummer}</div>` : ''}
            ${ustIdNr ? `<div style="color: #6B7280; font-size: 10px;">USt-IdNr: ${ustIdNr}</div>` : ''}
          </div>
          <div style="flex: 1; background: #EFF6FF; padding: 16px; border-left: 3px solid #6B7280;">
            <div style="font-size: 10px; text-transform: uppercase; color: #6B7280; font-weight: 600; margin-bottom: 8px;">Rechnungsempfänger</div>
            <div style="font-weight: 600; color: #1E40AF;">${rechnungsempfaengerName}</div>
            <div style="color: #374151; font-size: 11px; margin-top: 4px;">${rechnungsempfaengerAdresse.replace(/\n/g, '<br>')}</div>
          </div>
        </div>

        <!-- Rechnungsdetails -->
        <div style="display: flex; gap: 12px; margin-bottom: 24px;">
          <div style="flex: 1; background: #EFF6FF; padding: 12px 16px; text-align: center; border: 1px solid #E8E4DF;">
            <div style="font-size: 10px; text-transform: uppercase; color: #6B7280; font-weight: 600;">Rechnungsnummer</div>
            <div style="font-size: 14px; font-weight: 700; color: #1E40AF; margin-top: 4px;">${rechnungsnummer}</div>
          </div>
          <div style="flex: 1; background: #EFF6FF; padding: 12px 16px; text-align: center; border: 1px solid #E8E4DF;">
            <div style="font-size: 10px; text-transform: uppercase; color: #6B7280; font-weight: 600;">Rechnungsdatum</div>
            <div style="font-size: 14px; font-weight: 700; color: #1E40AF; margin-top: 4px;">${formatDateGerman(rechnungsdatum)}</div>
          </div>
          <div style="flex: 1; background: #EFF6FF; padding: 12px 16px; text-align: center; border: 1px solid #E8E4DF;">
            <div style="font-size: 10px; text-transform: uppercase; color: #6B7280; font-weight: 600;">Leistungszeitraum</div>
            <div style="font-size: 14px; font-weight: 700; color: #1E40AF; margin-top: 4px;">${monatFormatiert}</div>
          </div>
        </div>

        <!-- Anrede -->
        <p style="color: #374151; margin-bottom: 8px;">Sehr geehrte Damen und Herren,</p>
        <p style="color: #374151; margin-bottom: 20px;">für die im Leistungszeitraum erbrachten Trainerstunden erlaube ich mir, folgende Rechnung zu stellen:</p>

        <!-- Positionen -->
        ${positionenTabelleKlassisch}

        <!-- Summen -->
        ${summenBlockKlassisch}

        ${kleinunternehmer ? '<p style="color: #6B7280; font-style: italic; margin-top: 16px; font-size: 11px;">Gemäß §19 UStG wird keine Umsatzsteuer berechnet.</p>' : ''}

        <!-- Zahlungshinweis -->
        <div style="margin-top: 32px; background: #EFF6FF; padding: 20px; border: 1px solid #E8E4DF; border-left: 3px solid #374151;">
          <div style="font-weight: 600; color: #1E40AF; margin-bottom: 12px;">Zahlungsinformationen</div>
          <div style="display: flex; gap: 24px; color: #374151; font-size: 12px;">
            <div>
              <span style="font-weight: 600;">IBAN:</span> ${iban}<br>
              <span style="font-weight: 600;">Kontoinhaber:</span> ${rechnungsstellerName}
            </div>
            <div style="color: #6B7280;">
              Bitte überweisen Sie den Betrag<br>innerhalb von <strong>14 Tagen</strong>.
            </div>
          </div>
        </div>

        <!-- Abschluss -->
        <div style="margin-top: 32px; color: #374151;">
          <p>Vielen Dank für Ihr Vertrauen und die gute Zusammenarbeit!</p>
          <p style="margin-top: 24px;">Mit freundlichen Grüßen<br><strong style="color: #1E40AF;">${rechnungsstellerName}</strong></p>
        </div>
      `
    }

    // E-Mail-Text generieren
    const emailText = selectedPdfVorlage
      ? `Sehr geehrte/r ${rechnungsempfaengerName},

anbei erhalten Sie die Rechnung Nr. ${rechnungsnummer} für ${monatFormatiert}.

Gesamtbetrag: ${summen.gesamtBrutto.toFixed(2)} €

Der Betrag wird per SEPA-Lastschrift von Ihrem Konto abgebucht.

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
${rechnungsstellerName}`
      : `Sehr geehrte/r ${rechnungsempfaengerName},

anbei erhalten Sie die Rechnung Nr. ${rechnungsnummer} für ${monatFormatiert}.

Gesamtbetrag: ${summen.gesamtBrutto.toFixed(2)} €

Bitte überweisen Sie den Betrag innerhalb von 14 Tagen auf folgendes Konto:
IBAN: ${iban}
Kontoinhaber: ${rechnungsstellerName}

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
${rechnungsstellerName}`

    const emailBetreff = `Rechnung ${rechnungsnummer} - ${monatFormatiert}`

    return { pdfHtml, emailText, emailBetreff, monatFormatiert }
  }, [selectedSummary, verknuepfteSummaries, rechnungsPositionen, summen, selectedMonth, rechnungsnummer, rechnungsdatum, rechnungsstellerName, rechnungsstellerAdresse, rechnungsempfaengerName, rechnungsempfaengerAdresse, iban, ustIdNr, kleinunternehmer, korrekturGrund, profile, pdfVorlagen, selectedPdfVorlageId])

  const generatePDF = async () => {
    // Zuerst Rechnung speichern wenn gewünscht
    if (alsOffenenPostenSpeichern) {
      const trainingIds = rechnungsPositionen.map(p => p.trainingId).filter(Boolean) as string[]
      const alleSpielerIds = [selectedSpielerId, ...verknuepfteSpieler.map(v => v.id)]

      const [year, month] = selectedMonth.split('-')
      const monatNamen = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
      const monatFormatiert = `${monatNamen[parseInt(month) - 1]} ${year}`

      const { error: saveError } = await supabase
        .from('manuelle_rechnungen')
        .insert({
          user_id: userId,
          rechnungsnummer,
          rechnungsdatum,
          monat: selectedMonth,
          empfaenger_name: rechnungsempfaengerName,
          empfaenger_adresse: rechnungsempfaengerAdresse,
          leistungszeitraum: monatFormatiert,
          beschreibung: `Trainingsrechnung für ${alleSpielerIds.length > 1 ? alleSpielerIds.length + ' Spieler' : selectedSummary?.spieler.name}`,
          positionen: rechnungsPositionen.map(p => ({
            beschreibung: `${p.spielerName}: ${p.tarifName} (${p.datum})`,
            menge: 1,
            einzelpreis: p.brutto
          })),
          ust_satz: kleinunternehmer ? 0 : 19,
          netto_gesamt: summen.gesamtNetto,
          ust_betrag: summen.gesamtUst,
          brutto_gesamt: summen.gesamtBrutto,
          zahlungsziel: 14,
          bezahlt: false,
          bar_bezahlt: false,
          training_ids: trainingIds,
          spieler_id: selectedSpielerId
        })

      if (saveError) {
        console.error('Fehler beim Speichern der Rechnung:', saveError)
        alert('Fehler beim Speichern der Rechnung in der Buchhaltung')
      } else {
        onUpdate() // Daten neu laden
      }
    }

    const hatMehrereSpieler = verknuepfteSummaries.length > 0

    // Monat formatieren
    const [year, month] = selectedMonth.split('-')
    const monatNamen = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
    const monatFormatiert = `${monatNamen[parseInt(month) - 1]} ${year}`

    // Erstelle Tabellenzeilen für jede Position - Sportliches Design mit Zebra-Stripes
    const positionenHtml = rechnungsPositionen.map((p, index) => `
      <tr style="background: ${index % 2 === 0 ? '#EFF6FF' : 'white'};">
        <td style="padding: 12px; border-bottom: 1px solid #E8E4DF;">${p.istMonatlich ? p.datum : formatDateGerman(p.datum)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #E8E4DF;">${p.zeit}</td>
        <td style="padding: 12px; border-bottom: 1px solid #E8E4DF;">${p.istMonatlich ? 'Monatsbeitrag' : `${p.dauer.toFixed(1)} Std.`}</td>
        ${hatMehrereSpieler ? `<td style="padding: 12px; border-bottom: 1px solid #E8E4DF;">${p.spielerName}</td>` : ''}
        <td style="padding: 12px; border-bottom: 1px solid #E8E4DF;">${p.tarifName}${p.istMonatlich ? ' (mtl.)' : ''}</td>
        <td style="padding: 12px; border-bottom: 1px solid #E8E4DF; text-align: right">${p.netto.toFixed(2)} €</td>
        ${!kleinunternehmer ? `<td style="padding: 12px; border-bottom: 1px solid #E8E4DF; text-align: right">${p.ust.toFixed(2)} €</td>` : ''}
        <td style="padding: 12px; border-bottom: 1px solid #E8E4DF; text-align: right; font-weight: 600; color: #1E40AF;">${p.brutto.toFixed(2)} €</td>
      </tr>
    `).join('')

    // Korrekturzeile falls vorhanden - Sportliches Design
    const korrekturColSpan = hatMehrereSpieler ? 4 : 3
    const korrekturHtml = summen.korrektur !== 0 ? `
      <tr style="background: linear-gradient(135deg, ${summen.korrektur < 0 ? '#DBEAFE' : '#EFF6FF'} 0%, ${summen.korrektur < 0 ? '#DBEAFE' : '#DBEAFE'} 100%);">
        <td colspan="${korrekturColSpan}" style="padding: 12px; border-bottom: 1px solid #E8E4DF;"><em style="color: ${summen.korrektur < 0 ? '#B54332' : '#3B82F6'};">${korrekturGrund || 'Manuelle Korrektur'}</em></td>
        <td style="padding: 12px; border-bottom: 1px solid #E8E4DF;"><em>Korrektur</em></td>
        <td style="padding: 12px; border-bottom: 1px solid #E8E4DF; text-align: right">${summen.korrekturNetto >= 0 ? '' : ''}${summen.korrekturNetto.toFixed(2)} €</td>
        ${!kleinunternehmer ? `<td style="padding: 12px; border-bottom: 1px solid #E8E4DF; text-align: right">${summen.korrekturUst.toFixed(2)} €</td>` : ''}
        <td style="padding: 12px; border-bottom: 1px solid #E8E4DF; text-align: right; font-weight: 600;">${summen.korrektur >= 0 ? '' : ''}${summen.korrektur.toFixed(2)} €</td>
      </tr>
    ` : ''

    // Positionen-Tabelle als HTML - Sportliches Design
    const positionenTabelle = `
      <table style="width: 100%; border-collapse: separate; border-spacing: 0; margin: 20px 0; font-size: 11px; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <thead>
          <tr style="background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);">
            <th style="padding: 14px 12px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Datum</th>
            <th style="padding: 14px 12px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Zeit</th>
            <th style="padding: 14px 12px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Dauer</th>
            ${hatMehrereSpieler ? '<th style="padding: 14px 12px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Spieler</th>' : ''}
            <th style="padding: 14px 12px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Tarif</th>
            <th style="padding: 14px 12px; text-align: right; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Netto</th>
            ${!kleinunternehmer ? '<th style="padding: 14px 12px; text-align: right; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">USt</th>' : ''}
            <th style="padding: 14px 12px; text-align: right; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Brutto</th>
          </tr>
        </thead>
        <tbody>
          ${positionenHtml}
          ${korrekturHtml}
        </tbody>
      </table>
    `

    // Summen-Block als HTML - Sportliches Design
    const summenBlock = `
      <div style="background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%); border-radius: 12px; padding: 20px; margin-top: 24px; border-left: 4px solid #3B82F6;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #374151;">
          <span>Nettobetrag:</span>
          <span style="font-weight: 500;">${summen.gesamtNetto.toFixed(2)} €</span>
        </div>
        ${!kleinunternehmer ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #374151;">
          <span>USt (19%):</span>
          <span style="font-weight: 500;">${summen.gesamtUst.toFixed(2)} €</span>
        </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; padding-top: 12px; border-top: 2px solid #3B82F6; margin-top: 8px;">
          <span style="font-size: 16px; font-weight: 700; color: #1E40AF;">Gesamtbetrag:</span>
          <span style="font-size: 18px; font-weight: 700; color: #1E40AF;">${summen.gesamtBrutto.toFixed(2)} €</span>
        </div>
      </div>
    `

    // Klassische Positionen-Tabelle - Professionell ohne Farben
    const positionenHtmlKlassisch = rechnungsPositionen.map((p, idx) => `
      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#EFF6FF'};">
        <td style="padding: 8px; border-bottom: 1px solid #E8E4DF;">${p.istMonatlich ? p.datum : formatDateGerman(p.datum)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #E8E4DF;">${p.zeit}</td>
        <td style="padding: 8px; border-bottom: 1px solid #E8E4DF;">${p.istMonatlich ? 'Monatsbeitrag' : `${p.dauer.toFixed(1)} Std.`}</td>
        ${hatMehrereSpieler ? `<td style="padding: 8px; border-bottom: 1px solid #E8E4DF;">${p.spielerName}</td>` : ''}
        <td style="padding: 8px; border-bottom: 1px solid #E8E4DF;">${p.tarifName}${p.istMonatlich ? ' (mtl.)' : ''}</td>
        <td style="padding: 8px; border-bottom: 1px solid #E8E4DF; text-align: right; font-family: monospace;">${p.netto.toFixed(2)} €</td>
        ${!kleinunternehmer ? `<td style="padding: 8px; border-bottom: 1px solid #E8E4DF; text-align: right; font-family: monospace;">${p.ust.toFixed(2)} €</td>` : ''}
        <td style="padding: 8px; border-bottom: 1px solid #E8E4DF; text-align: right; font-family: monospace; font-weight: 600;">${p.brutto.toFixed(2)} €</td>
      </tr>
    `).join('')

    const korrekturHtmlKlassisch = summen.korrektur !== 0 ? `
      <tr style="background: #EFF6FF;">
        <td colspan="${korrekturColSpan}" style="padding: 8px; border-bottom: 1px solid #E8E4DF;"><em>${korrekturGrund || 'Manuelle Korrektur'}</em></td>
        <td style="padding: 8px; border-bottom: 1px solid #E8E4DF;"><em>Korrektur</em></td>
        <td style="padding: 8px; border-bottom: 1px solid #E8E4DF; text-align: right; font-family: monospace;">${summen.korrekturNetto.toFixed(2)} €</td>
        ${!kleinunternehmer ? `<td style="padding: 8px; border-bottom: 1px solid #E8E4DF; text-align: right; font-family: monospace;">${summen.korrekturUst.toFixed(2)} €</td>` : ''}
        <td style="padding: 8px; border-bottom: 1px solid #E8E4DF; text-align: right; font-family: monospace; font-weight: 600;">${summen.korrektur.toFixed(2)} €</td>
      </tr>
    ` : ''

    const positionenTabelleKlassisch = `
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 11px;">
        <thead>
          <tr style="background: #1E40AF;">
            <th style="padding: 10px 8px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Datum</th>
            <th style="padding: 10px 8px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Zeit</th>
            <th style="padding: 10px 8px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Dauer</th>
            ${hatMehrereSpieler ? '<th style="padding: 10px 8px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Spieler</th>' : ''}
            <th style="padding: 10px 8px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Tarif</th>
            <th style="padding: 10px 8px; text-align: right; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Netto</th>
            ${!kleinunternehmer ? '<th style="padding: 10px 8px; text-align: right; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">USt</th>' : ''}
            <th style="padding: 10px 8px; text-align: right; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Brutto</th>
          </tr>
        </thead>
        <tbody>
          ${positionenHtmlKlassisch}
          ${korrekturHtmlKlassisch}
        </tbody>
      </table>
    `

    // Klassischer Summen-Block - Professionell ohne Farben
    const summenBlockKlassisch = `
      <div style="background: #EFF6FF; border: 1px solid #E8E4DF; padding: 16px; margin-top: 20px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #374151;">
          <span>Nettobetrag:</span>
          <span style="font-family: monospace;">${summen.gesamtNetto.toFixed(2)} €</span>
        </div>
        ${!kleinunternehmer ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #374151;">
          <span>USt (19%):</span>
          <span style="font-family: monospace;">${summen.gesamtUst.toFixed(2)} €</span>
        </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; padding-top: 10px; margin-top: 10px; border-top: 2px solid #1E40AF; font-weight: bold; font-size: 14px; color: #1E40AF;">
          <span>Gesamtbetrag:</span>
          <span style="font-family: monospace; font-size: 16px;">${summen.gesamtBrutto.toFixed(2)} €</span>
        </div>
      </div>
    `

    // Positionen als Text für E-Mail-Vorlage
    const positionenText = rechnungsPositionen.map(p =>
      `${p.istMonatlich ? p.datum : formatDateGerman(p.datum)} | ${p.zeit} | ${p.istMonatlich ? 'Monatsbeitrag' : `${p.dauer.toFixed(1)} Std.`}${hatMehrereSpieler ? ` | ${p.spielerName}` : ''} | ${p.tarifName} | ${p.brutto.toFixed(2)} €`
    ).join('\n')
    const korrekturNum = parseFloat(korrekturBetrag) || 0
    const korrekturText = korrekturNum !== 0
      ? `\nKorrektur: ${korrekturNum > 0 ? '+' : ''}${korrekturNum.toFixed(2)} €`
      : ''

    // IBAN maskieren (nur erste 4 und letzte 4 Zeichen zeigen)
    const maskiereIban = (ibanStr: string | undefined): string => {
      if (!ibanStr) return ''
      const cleaned = ibanStr.replace(/\s/g, '')
      if (cleaned.length <= 8) return cleaned
      return `${cleaned.slice(0, 4)}${'*'.repeat(cleaned.length - 8)}${cleaned.slice(-4)}`
    }

    // Spieler-SEPA-Daten
    const spielerIban = selectedSummary?.spieler.iban || ''
    const spielerMandatsreferenz = selectedSummary?.spieler.mandatsreferenz || ''
    const spielerUnterschriftsdatum = selectedSummary?.spieler.unterschriftsdatum
      ? formatDateGerman(selectedSummary.spieler.unterschriftsdatum)
      : ''

    // Platzhalter-Werte für PDF
    const platzhalterWerte: Record<string, string> = {
      '{{spieler_name}}': selectedSummary?.spieler.name || '',
      '{{rechnungsnummer}}': rechnungsnummer,
      '{{rechnungsdatum}}': formatDateGerman(rechnungsdatum),
      '{{monat}}': monatFormatiert,
      '{{positionen}}': positionenText + korrekturText,
      '{{positionen_tabelle}}': positionenTabelle,
      '{{netto}}': `${summen.gesamtNetto.toFixed(2)} €`,
      '{{ust}}': `${summen.gesamtUst.toFixed(2)} €`,
      '{{brutto}}': `${summen.gesamtBrutto.toFixed(2)} €`,
      '{{iban}}': iban,
      '{{trainer_name}}': rechnungsstellerName,
      '{{trainer_adresse}}': rechnungsstellerAdresse,
      '{{trainer_adresse_html}}': rechnungsstellerAdresse.replace(/\n/g, '<br>') + (profile?.steuernummer ? `<br><span style="color: #6B7280; font-size: 10px;">Steuernummer: ${profile.steuernummer}</span>` : '') + (ustIdNr ? `<br><span style="color: #6B7280; font-size: 10px;">USt-IdNr: ${ustIdNr}</span>` : ''),
      '{{steuernummer}}': profile?.steuernummer || '',
      '{{empfaenger_name}}': rechnungsempfaengerName,
      '{{empfaenger_adresse}}': rechnungsempfaengerAdresse,
      '{{empfaenger_adresse_html}}': rechnungsempfaengerAdresse.replace(/\n/g, '<br>'),
      '{{kleinunternehmer_hinweis}}': kleinunternehmer ? '<p><em>Gemäß §19 UStG wird keine Umsatzsteuer berechnet.</em></p>' : '',
      '{{ust_zeile}}': !kleinunternehmer ? `Nettobetrag: ${summen.gesamtNetto.toFixed(2)} €<br>USt (19%): ${summen.gesamtUst.toFixed(2)} €` : '',
      '{{summen_block}}': summenBlock,
      '{{positionen_tabelle_klassisch}}': positionenTabelleKlassisch,
      '{{summen_block_klassisch}}': summenBlockKlassisch,
      '{{spieler_iban}}': maskiereIban(spielerIban),
      '{{spieler_mandatsreferenz}}': spielerMandatsreferenz,
      '{{spieler_unterschriftsdatum}}': spielerUnterschriftsdatum,
      '{{trainer_steuernummer_block}}': profile?.steuernummer ? `<div style="color: #6B7280; font-size: 10px; margin-top: 8px;">Steuernummer: ${profile.steuernummer}</div>` : '',
    }

    // Funktion zum Ersetzen der Platzhalter
    const ersetzePlatzhalter = (text: string): string => {
      let result = text
      for (const [key, value] of Object.entries(platzhalterWerte)) {
        result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value)
      }
      return result
    }

    // PDF-Vorlage verwenden wenn ausgewählt
    const selectedPdfVorlage = pdfVorlagen.find(v => v.id === selectedPdfVorlageId)

    let html: string

    // Wenn benutzerdefinierter PDF-Inhalt vorhanden, diesen verwenden
    if (customPdfHtml) {
      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Rechnung ${rechnungsnummer}</title>
          <style>
            body { font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.6; font-size: 12px; }
            h1 { text-align: center; margin-bottom: 30px; font-size: 24px; }
            .section { margin-bottom: 20px; }
            .flex { display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f5f5f5; font-size: 11px; }
            .total { text-align: right; margin-top: 20px; }
            .total-row { display: flex; justify-content: flex-end; gap: 40px; margin: 4px 0; }
            .total-row.highlight { font-weight: bold; font-size: 14px; margin-top: 8px; border-top: 2px solid #333; padding-top: 8px; }
            .footer { margin-top: 40px; }
            @media print {
              body { padding: 20px; margin: 0; }
              @page { size: A4; margin: 15mm; }
            }
          </style>
        </head>
        <body>${customPdfHtml}</body>
        </html>
      `
    } else if (selectedPdfVorlage) {
      // Eigene PDF-Vorlage mit Platzhaltern verwenden
      const pdfBody = ersetzePlatzhalter(selectedPdfVorlage.inhalt)
      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Rechnung ${rechnungsnummer}</title>
          <style>
            body { font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.6; font-size: 12px; }
            h1 { text-align: center; margin-bottom: 30px; font-size: 24px; }
            .section { margin-bottom: 20px; }
            .flex { display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f5f5f5; font-size: 11px; }
            .total { text-align: right; margin-top: 20px; }
            .total-row { display: flex; justify-content: flex-end; gap: 40px; margin: 4px 0; }
            .total-row.highlight { font-weight: bold; font-size: 14px; margin-top: 8px; border-top: 2px solid #333; padding-top: 8px; }
            .footer { margin-top: 40px; }
            @media print {
              body { padding: 20px; margin: 0; }
              @page { size: A4; margin: 15mm; }
            }
          </style>
        </head>
        <body>${pdfBody}</body>
        </html>
      `
    } else {
      // Standard PDF-Layout - Professionelles Design
      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Rechnung ${rechnungsnummer}</title>
          <style>
            body {
              font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
              padding: 24px;
              line-height: 1.6;
              font-size: 12px;
              color: #1E40AF;
              background: #ffffff;
            }
            @media print {
              body { padding: 20px; margin: 0; }
              @page { size: A4; margin: 15mm; }
            }
          </style>
        </head>
        <body>
          <!-- Header -->
          <div style="background: #1E40AF; margin: -24px -24px 24px -24px; padding: 24px;">
            <h1 style="text-align: center; margin: 0; font-size: 28px; color: white; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">Rechnung</h1>
          </div>

          <!-- Adressen in Cards -->
          <div style="display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px;">
            <div style="flex: 1; background: #EFF6FF; padding: 16px; border-left: 3px solid #374151;">
              <div style="font-size: 10px; text-transform: uppercase; color: #6B7280; font-weight: 600; margin-bottom: 8px; letter-spacing: 0.5px;">Rechnungssteller</div>
              <strong style="color: #1E40AF;">${rechnungsstellerName}</strong><br>
              <span style="color: #374151;">${rechnungsstellerAdresse.replace(/\n/g, '<br>')}</span>
              ${profile?.steuernummer ? `<br><span style="color: #6B7280; font-size: 11px;">Steuernr: ${profile?.steuernummer}</span>` : ''}
              ${ustIdNr ? `<br><span style="color: #6B7280; font-size: 11px;">USt-IdNr: ${ustIdNr}</span>` : ''}
            </div>
            <div style="flex: 1; background: #EFF6FF; padding: 16px; border-left: 3px solid #6B7280;">
              <div style="font-size: 10px; text-transform: uppercase; color: #6B7280; font-weight: 600; margin-bottom: 8px; letter-spacing: 0.5px;">Rechnungsempfänger</div>
              <strong style="color: #1E40AF;">${rechnungsempfaengerName}</strong><br>
              <span style="color: #374151;">${rechnungsempfaengerAdresse.replace(/\n/g, '<br>')}</span>
            </div>
          </div>

          <!-- Rechnungsdetails -->
          <div style="background: #EFF6FF; padding: 16px; margin-bottom: 24px; display: flex; justify-content: space-around; text-align: center; border: 1px solid #E8E4DF;">
            <div>
              <div style="font-size: 10px; text-transform: uppercase; color: #6B7280; font-weight: 600;">Rechnungsnummer</div>
              <div style="font-size: 14px; font-weight: 700; color: #1E40AF;">${rechnungsnummer}</div>
            </div>
            <div style="border-left: 2px solid #d1d5db; padding-left: 24px;">
              <div style="font-size: 10px; text-transform: uppercase; color: #6B7280; font-weight: 600;">Rechnungsdatum</div>
              <div style="font-size: 14px; font-weight: 700; color: #1E40AF;">${formatDateGerman(rechnungsdatum)}</div>
            </div>
            <div style="border-left: 2px solid #d1d5db; padding-left: 24px;">
              <div style="font-size: 10px; text-transform: uppercase; color: #6B7280; font-weight: 600;">Leistungszeitraum</div>
              <div style="font-size: 14px; font-weight: 700; color: #1E40AF;">${monatFormatiert}</div>
            </div>
          </div>

          <p style="color: #374151;">Sehr geehrte Damen und Herren,</p>
          <p style="color: #374151;">für die im Leistungszeitraum erbrachten Trainerstunden erlaube ich mir, folgende Rechnung zu stellen:</p>

          ${positionenTabelleKlassisch}
          ${summenBlockKlassisch}

          ${kleinunternehmer ? '<p style="color: #6B7280; font-style: italic; margin-top: 16px;"><em>Gemäß §19 UStG wird keine Umsatzsteuer berechnet.</em></p>' : ''}

          <!-- Zahlungsinfo Box -->
          <div style="background: #EFF6FF; padding: 20px; margin-top: 24px; border: 1px solid #E8E4DF; border-left: 3px solid #374151;">
            <div style="font-size: 11px; text-transform: uppercase; color: #1E40AF; font-weight: 600; margin-bottom: 12px;">Zahlungsinformationen</div>
            <p style="margin: 0 0 8px 0; color: #374151;">Bitte überweisen Sie den Betrag innerhalb von 14 Tagen auf folgendes Konto:</p>
            <div style="margin-top: 8px;">
              <strong style="color: #1E40AF;">IBAN:</strong> <span style="font-family: monospace; color: #1E40AF;">${iban}</span><br>
              <strong style="color: #1E40AF;">Kontoinhaber:</strong> <span style="color: #374151;">${rechnungsstellerName}</span>
            </div>
          </div>

          <p style="margin-top: 24px; color: #374151;">Vielen Dank für Ihr Vertrauen!</p>
          <p style="color: #374151;">Mit freundlichen Grüßen<br><strong style="color: #1E40AF;">${rechnungsstellerName}</strong></p>
        </body>
        </html>
      `
    }

    // Blob erstellen für saubere URL (ohne "about:blank")
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const printWindow = window.open(url, '_blank')
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print()
        // URL nach dem Drucken freigeben
        URL.revokeObjectURL(url)
      }
    }
  }

  // E-Mail mit PDF-Anhang versenden (verwendet dieselbe Vorlage wie generatePDF)
  const sendInvoiceEmail = async () => {
    if (!profile?.smtp_host || !profile?.smtp_user || !profile?.smtp_pass) {
      alert('Bitte konfiguriere zuerst deine SMTP-Einstellungen unter "Weiteres" → "Mein Profil".')
      return
    }

    const spielerEmail = selectedSummary?.spieler.kontakt_email
    if (!spielerEmail) {
      alert('Keine E-Mail-Adresse für diesen Spieler hinterlegt.')
      return
    }

    setSendingEmail(true)

    try {
      const hatMehrereSpieler = verknuepfteSummaries.length > 0

      // Monat formatieren
      const [year, month] = selectedMonth.split('-')
      const monatNamen = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
      const monatFormatiert = `${monatNamen[parseInt(month) - 1]} ${year}`

      // Prüfe ob eine PDF-Vorlage ausgewählt ist
      const selectedPdfVorlage = pdfVorlagen.find(v => v.id === selectedPdfVorlageId)

      let pdfBlob: Blob

      if (true) { // Immer html2canvas
        // ============ MIT VORLAGE ODER BEARBEITETEM INHALT: HTML zu PDF mit html2canvas ============

        // HTML-Hilfsdaten erstellen - Sportliches Design mit Zebra-Stripes
        const positionenHtml = rechnungsPositionen.map((p, index) => `
          <tr style="background: ${index % 2 === 0 ? '#EFF6FF' : '#ffffff'} !important;">
            <td style="padding: 10px 8px; border-bottom: 1px solid #E8E4DF; color: #1E40AF !important;">${p.istMonatlich ? p.datum : formatDateGerman(p.datum)}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid #E8E4DF; color: #1E40AF !important;">${p.zeit}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid #E8E4DF; color: #1E40AF !important;">${p.istMonatlich ? 'Monatsbeitrag' : `${p.dauer.toFixed(1)} Std.`}</td>
            ${hatMehrereSpieler ? `<td style="padding: 10px 8px; border-bottom: 1px solid #E8E4DF; color: #1E40AF !important;">${p.spielerName}</td>` : ''}
            <td style="padding: 10px 8px; border-bottom: 1px solid #E8E4DF; color: #1E40AF !important;">${p.tarifName}${p.istMonatlich ? ' (mtl.)' : ''}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid #E8E4DF; text-align: right; color: #1E40AF !important;">${p.netto.toFixed(2)} €</td>
            ${!kleinunternehmer ? `<td style="padding: 10px 8px; border-bottom: 1px solid #E8E4DF; text-align: right; color: #1E40AF !important;">${p.ust.toFixed(2)} €</td>` : ''}
            <td style="padding: 10px 8px; border-bottom: 1px solid #E8E4DF; text-align: right; font-weight: 600; color: #3B82F6 !important;">${p.brutto.toFixed(2)} €</td>
          </tr>
        `).join('')

        const positionenTabelle = `
          <div class="positionen-tabelle-wrapper" style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; font-size: 10px; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <thead>
              <tr style="background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);">
                <th style="padding: 12px 8px; text-align: left; color: white !important; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; width: 18%;">Datum</th>
                <th style="padding: 12px 8px; text-align: left; color: white !important; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; width: 14%;">Zeit</th>
                <th style="padding: 12px 8px; text-align: left; color: white !important; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; width: 12%;">Dauer</th>
                ${hatMehrereSpieler ? '<th style="padding: 12px 8px; text-align: left; color: white !important; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; width: 12%;">Spieler</th>' : ''}
                <th style="padding: 12px 8px; text-align: left; color: white !important; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; width: 18%;">Tarif</th>
                <th style="padding: 12px 8px; text-align: right; color: white !important; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; width: 10%;">Netto</th>
                ${!kleinunternehmer ? '<th style="padding: 12px 8px; text-align: right; color: white !important; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; width: 8%;">USt</th>' : ''}
                <th style="padding: 12px 8px; text-align: right; color: white !important; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; width: 10%;">Brutto</th>
              </tr>
            </thead>
            <tbody>
              ${positionenHtml}
            </tbody>
          </table>
          </div>
        `

        const summenBlock = `
          <div style="background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%); border-radius: 12px; padding: 16px; margin-top: 20px; border-left: 4px solid #3B82F6;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #374151;">
              <span>Nettobetrag:</span>
              <span style="font-weight: 500;">${summen.gesamtNetto.toFixed(2)} €</span>
            </div>
            ${!kleinunternehmer ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #374151;">
              <span>USt (19%):</span>
              <span style="font-weight: 500;">${summen.gesamtUst.toFixed(2)} €</span>
            </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; padding-top: 10px; border-top: 2px solid #3B82F6; margin-top: 6px;">
              <span style="font-size: 14px; font-weight: 700; color: #1E40AF;">Gesamtbetrag:</span>
              <span style="font-size: 16px; font-weight: 700; color: #1E40AF;">${summen.gesamtBrutto.toFixed(2)} €</span>
            </div>
          </div>
        `

        // Klassische Varianten ohne Farben
        const positionenHtmlKlassisch = rechnungsPositionen.map((p, idx) => `
          <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#EFF6FF'};">
            <td style="padding: 8px; border-bottom: 1px solid #E8E4DF; color: #1E40AF;">${p.istMonatlich ? p.datum : formatDateGerman(p.datum)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #E8E4DF; color: #1E40AF;">${p.zeit}</td>
            <td style="padding: 8px; border-bottom: 1px solid #E8E4DF; color: #1E40AF;">${p.istMonatlich ? 'Monatsbeitrag' : `${p.dauer.toFixed(1)} Std.`}</td>
            ${hatMehrereSpieler ? `<td style="padding: 8px; border-bottom: 1px solid #E8E4DF; color: #1E40AF;">${p.spielerName}</td>` : ''}
            <td style="padding: 8px; border-bottom: 1px solid #E8E4DF; color: #1E40AF;">${p.tarifName}${p.istMonatlich ? ' (mtl.)' : ''}</td>
            <td style="padding: 8px; border-bottom: 1px solid #E8E4DF; text-align: right; font-family: monospace; color: #1E40AF;">${p.netto.toFixed(2)} €</td>
            ${!kleinunternehmer ? `<td style="padding: 8px; border-bottom: 1px solid #E8E4DF; text-align: right; font-family: monospace; color: #1E40AF;">${p.ust.toFixed(2)} €</td>` : ''}
            <td style="padding: 8px; border-bottom: 1px solid #E8E4DF; text-align: right; font-family: monospace; font-weight: 600; color: #1E40AF;">${p.brutto.toFixed(2)} €</td>
          </tr>
        `).join('')

        const positionenTabelleKlassisch = `
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 10px;">
            <thead>
              <tr style="background: #1E40AF;">
                <th style="padding: 10px 8px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px;">Datum</th>
                <th style="padding: 10px 8px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px;">Zeit</th>
                <th style="padding: 10px 8px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px;">Dauer</th>
                ${hatMehrereSpieler ? '<th style="padding: 10px 8px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px;">Spieler</th>' : ''}
                <th style="padding: 10px 8px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px;">Tarif</th>
                <th style="padding: 10px 8px; text-align: right; color: white; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px;">Netto</th>
                ${!kleinunternehmer ? '<th style="padding: 10px 8px; text-align: right; color: white; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px;">USt</th>' : ''}
                <th style="padding: 10px 8px; text-align: right; color: white; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px;">Brutto</th>
              </tr>
            </thead>
            <tbody>
              ${positionenHtmlKlassisch}
            </tbody>
          </table>
        `

        const summenBlockKlassisch = `
          <div style="background: #EFF6FF; border: 1px solid #E8E4DF; padding: 16px; margin-top: 20px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #374151;">
              <span>Nettobetrag:</span>
              <span style="font-family: monospace;">${summen.gesamtNetto.toFixed(2)} €</span>
            </div>
            ${!kleinunternehmer ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #374151;">
              <span>USt (19%):</span>
              <span style="font-family: monospace;">${summen.gesamtUst.toFixed(2)} €</span>
            </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; padding-top: 10px; margin-top: 10px; border-top: 2px solid #1E40AF; font-weight: bold; font-size: 14px; color: #1E40AF;">
              <span>Gesamtbetrag:</span>
              <span style="font-family: monospace; font-size: 16px;">${summen.gesamtBrutto.toFixed(2)} €</span>
            </div>
          </div>
        `

        // IBAN maskieren
        const maskiereIban = (ibanStr: string | undefined): string => {
          if (!ibanStr) return '-'
          const cleaned = ibanStr.replace(/\s/g, '')
          if (cleaned.length <= 8) return cleaned
          return `${cleaned.slice(0, 4)}${'*'.repeat(cleaned.length - 8)}${cleaned.slice(-4)}`
        }

        // Spieler-SEPA-Daten
        const spielerIban = selectedSummary?.spieler.iban || ''
        const spielerMandatsreferenz = selectedSummary?.spieler.mandatsreferenz || '-'
        const spielerUnterschriftsdatum = selectedSummary?.spieler.unterschriftsdatum
          ? formatDateGerman(selectedSummary.spieler.unterschriftsdatum)
          : '-'

        // Platzhalter ersetzen
        const platzhalterWerte: Record<string, string> = {
          '{{spieler_name}}': selectedSummary?.spieler.name || '',
          '{{rechnungsnummer}}': rechnungsnummer,
          '{{rechnungsdatum}}': formatDateGerman(rechnungsdatum),
          '{{monat}}': monatFormatiert,
          '{{positionen_tabelle}}': positionenTabelle,
          '{{netto}}': `${summen.gesamtNetto.toFixed(2)} €`,
          '{{ust}}': `${summen.gesamtUst.toFixed(2)} €`,
          '{{brutto}}': `${summen.gesamtBrutto.toFixed(2)} €`,
          '{{iban}}': iban,
          '{{trainer_name}}': rechnungsstellerName,
          '{{trainer_adresse}}': rechnungsstellerAdresse,
          '{{trainer_adresse_html}}': rechnungsstellerAdresse.replace(/\n/g, '<br>') + (profile?.steuernummer ? `<br><span style="color: #6B7280; font-size: 10px;">Steuernummer: ${profile.steuernummer}</span>` : '') + (ustIdNr ? `<br><span style="color: #6B7280; font-size: 10px;">USt-IdNr: ${ustIdNr}</span>` : ''),
          '{{steuernummer}}': profile?.steuernummer || '',
          '{{empfaenger_name}}': rechnungsempfaengerName,
          '{{empfaenger_adresse}}': rechnungsempfaengerAdresse,
          '{{empfaenger_adresse_html}}': rechnungsempfaengerAdresse.replace(/\n/g, '<br>'),
          '{{kleinunternehmer_hinweis}}': kleinunternehmer ? '<p style="color: #1E40AF;"><em>Gemäß §19 UStG wird keine Umsatzsteuer berechnet.</em></p>' : '',
          '{{ust_zeile}}': !kleinunternehmer ? `Nettobetrag: ${summen.gesamtNetto.toFixed(2)} €<br>USt (19%): ${summen.gesamtUst.toFixed(2)} €` : '',
          '{{summen_block}}': summenBlock,
          '{{positionen_tabelle_klassisch}}': positionenTabelleKlassisch,
          '{{summen_block_klassisch}}': summenBlockKlassisch,
          '{{spieler_iban}}': maskiereIban(spielerIban),
          '{{spieler_mandatsreferenz}}': spielerMandatsreferenz,
          '{{spieler_unterschriftsdatum}}': spielerUnterschriftsdatum,
        }

        // Wenn benutzerdefinierter PDF-Inhalt vorhanden, diesen verwenden
        let pdfBody: string
        if (customPdfHtml) {
          pdfBody = customPdfHtml
        } else if (selectedPdfVorlage) {
          pdfBody = selectedPdfVorlage.inhalt
          for (const [key, value] of Object.entries(platzhalterWerte)) {
            pdfBody = pdfBody.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value)
          }
        } else {
          // Standard-Layout aus vorschauDaten verwenden
          pdfBody = vorschauDaten.pdfHtml
        }

        // Container erstellen - SICHTBAR für html2canvas
        const container = document.createElement('div')
        container.id = 'pdf-render-container'
        container.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 794px;
          background: white;
          z-index: 99999;
          padding: 40px;
          box-sizing: border-box;
          font-family: 'Times New Roman', Times, serif;
          font-size: 12px;
          line-height: 1.6;
          color: #1E40AF !important;
        `
        container.innerHTML = `
          <style>
            #pdf-render-container,
            #pdf-render-container * {
              color: #1E40AF !important;
              -webkit-text-fill-color: #1E40AF !important;
            }
            #pdf-render-container table,
            #pdf-render-container table *,
            #pdf-render-container td,
            #pdf-render-container th,
            #pdf-render-container tr,
            #pdf-render-container tbody,
            #pdf-render-container tbody *,
            #pdf-render-container tbody tr,
            #pdf-render-container tbody td,
            #pdf-render-container thead,
            #pdf-render-container strong {
              color: #1E40AF !important;
              -webkit-text-fill-color: #1E40AF !important;
              opacity: 1 !important;
            }
            .positionen-tabelle-wrapper,
            .positionen-tabelle-wrapper * {
              color: #1E40AF !important;
              -webkit-text-fill-color: #1E40AF !important;
              opacity: 1 !important;
            }
          </style>
          <div>${pdfBody}</div>
        `
        document.body.appendChild(container)

        // Warten bis gerendert
        await new Promise(resolve => setTimeout(resolve, 300))

        // Mit html2canvas erfassen
        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 794,
          windowWidth: 794,
          onclone: (clonedDoc) => {
            // Force black color on all elements in cloned document
            const clonedContainer = clonedDoc.getElementById('pdf-render-container')
            if (clonedContainer) {
              const allElements = clonedContainer.querySelectorAll('*')
              allElements.forEach((el) => {
                const htmlEl = el as HTMLElement
                htmlEl.style.setProperty('color', '#1E40AF', 'important')
                htmlEl.style.setProperty('-webkit-text-fill-color', '#1E40AF', 'important')
                htmlEl.style.setProperty('opacity', '1', 'important')
              })
              // Extra: Target tbody elements specifically
              const tbodyElements = clonedContainer.querySelectorAll('tbody, tbody *, td, tr')
              tbodyElements.forEach((el) => {
                const htmlEl = el as HTMLElement
                htmlEl.style.setProperty('color', '#1E40AF', 'important')
                htmlEl.style.setProperty('-webkit-text-fill-color', '#1E40AF', 'important')
                htmlEl.style.setProperty('opacity', '1', 'important')
              })
            }
          }
        })

        // Container entfernen
        document.body.removeChild(container)

        // PDF erstellen
        const imgData = canvas.toDataURL('image/jpeg', 0.95)
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = pdf.internal.pageSize.getHeight()
        const imgWidth = canvas.width
        const imgHeight = canvas.height
        const ratio = pdfWidth / imgWidth
        const scaledHeight = imgHeight * ratio

        // Mehrere Seiten wenn nötig (nur wenn Inhalt deutlich größer als eine Seite)
        const pageContentHeight = pdfHeight
        const totalPages = scaledHeight > pageContentHeight + 5 ? Math.ceil(scaledHeight / pageContentHeight) : 1

        for (let page = 0; page < totalPages; page++) {
          if (page > 0) pdf.addPage()
          const yOffset = -page * pageContentHeight
          pdf.addImage(imgData, 'JPEG', 0, yOffset, pdfWidth, scaledHeight)
        }

        pdfBlob = pdf.output('blob')

      } else {
        // ============ OHNE VORLAGE: Direkt mit jsPDF - Professionelles Design ============

        // PDF mit jsPDF direkt erstellen (zuverlässiger als html2canvas)
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      const pageWidth = 210
      const pageHeight = 297
      const margin = 15
      const contentWidth = pageWidth - 2 * margin
      let y = margin

      // Hilfsfunktion für Text mit automatischem Seitenumbruch
      const checkNewPage = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - margin) {
          pdf.addPage()
          y = margin
        }
      }

      // Header: RECHNUNG mit grauem Hintergrund
      pdf.setFillColor(26, 47, 47) // Dark gray #1E40AF
      pdf.rect(0, 0, pageWidth, 25, 'F')
      pdf.setFontSize(24)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(255, 255, 255)
      pdf.text('RECHNUNG', pageWidth / 2, 17, { align: 'center' })
      pdf.setTextColor(0, 0, 0)
      y = 35

      // Rechnungssteller (links) - Card-Style professionell
      pdf.setFillColor(250, 248, 245)
      pdf.rect(margin, y - 3, 85, 28, 'F')
      pdf.setDrawColor(74, 69, 67)
      pdf.setLineWidth(1)
      pdf.line(margin, y - 3, margin, y + 25)

      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(95, 114, 114)
      pdf.text('RECHNUNGSSTELLER', margin + 3, y + 1)
      pdf.setTextColor(0, 0, 0)
      y += 5
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'bold')
      pdf.text(rechnungsstellerName, margin + 3, y)
      y += 4
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      rechnungsstellerAdresse.split('\n').forEach(line => {
        pdf.text(line, margin + 3, y)
        y += 3.5
      })
      if (profile?.steuernummer) {
        pdf.setTextColor(95, 114, 114)
        pdf.setFontSize(8)
        pdf.text(`Steuernr: ${profile?.steuernummer}`, margin + 3, y)
        y += 3.5
      }
      if (ustIdNr) {
        pdf.setTextColor(95, 114, 114)
        pdf.setFontSize(8)
        pdf.text(`USt-IdNr: ${ustIdNr}`, margin + 3, y)
        y += 3.5
      }
      pdf.setTextColor(0, 0, 0)

      // Rechnungsempfänger (rechts oben) - Card-Style professionell
      let yRight = 35
      pdf.setFillColor(250, 248, 245)
      pdf.rect(pageWidth - margin - 85, yRight - 3, 85, 28, 'F')
      pdf.setDrawColor(107, 99, 94) // Gray
      pdf.setLineWidth(1)
      pdf.line(pageWidth - margin - 85, yRight - 3, pageWidth - margin - 85, yRight + 25)

      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(95, 114, 114)
      pdf.text('RECHNUNGSEMPFÄNGER', pageWidth - margin - 82, yRight + 1)
      pdf.setTextColor(0, 0, 0)
      yRight += 5
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'bold')
      pdf.text(rechnungsempfaengerName, pageWidth - margin - 82, yRight)
      yRight += 4
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      rechnungsempfaengerAdresse.split('\n').forEach(line => {
        pdf.text(line, pageWidth - margin - 82, yRight)
        yRight += 3.5
      })

      y = Math.max(y, yRight) + 10

      // Rechnungsdetails - Info-Box
      pdf.setFillColor(250, 248, 245) // Light gray
      pdf.roundedRect(margin, y - 3, contentWidth, 14, 3, 3, 'F')

      const detailWidth = contentWidth / 3
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(95, 114, 114)
      pdf.text('RECHNUNGSNUMMER', margin + 5, y + 1)
      pdf.text('RECHNUNGSDATUM', margin + detailWidth + 5, y + 1)
      pdf.text('LEISTUNGSZEITRAUM', margin + detailWidth * 2 + 5, y + 1)

      pdf.setFontSize(11)
      pdf.setTextColor(0, 0, 0)
      pdf.text(rechnungsnummer, margin + 5, y + 7)
      pdf.text(formatDateGerman(rechnungsdatum), margin + detailWidth + 5, y + 7)
      pdf.text(monatFormatiert, margin + detailWidth * 2 + 5, y + 7)
      y += 18

      // Einleitungstext
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'normal')
      pdf.text('Sehr geehrte Damen und Herren,', margin, y)
      y += 5
      const introLines = pdf.splitTextToSize('für die im Leistungszeitraum erbrachten Trainerstunden erlaube ich mir, folgende Rechnung zu stellen:', contentWidth)
      pdf.text(introLines, margin, y)
      y += introLines.length * 4 + 6

      // Tabelle Header - Professionell grau
      const colWidths = hatMehrereSpieler
        ? [22, 28, 22, 28, 28, 20, kleinunternehmer ? 0 : 16, 20]
        : [25, 32, 25, 35, 22, kleinunternehmer ? 0 : 18, 22]
      const headers = hatMehrereSpieler
        ? ['Datum', 'Zeit', 'Dauer', 'Spieler', 'Tarif', 'Netto', ...(kleinunternehmer ? [] : ['USt']), 'Brutto']
        : ['Datum', 'Zeit', 'Dauer', 'Tarif', 'Netto', ...(kleinunternehmer ? [] : ['USt']), 'Brutto']

      // Tabellen-Header zeichnen mit grauem Hintergrund
      checkNewPage(10)
      pdf.setFillColor(26, 47, 47) // Dark gray
      pdf.roundedRect(margin, y - 4, contentWidth, 8, 2, 2, 'F')
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(255, 255, 255)

      let xPos = margin + 2
      headers.forEach((header, i) => {
        if (colWidths[i] > 0) {
          pdf.text(header.toUpperCase(), xPos, y)
          xPos += colWidths[i]
        }
      })
      y += 6
      pdf.setTextColor(0, 0, 0)

      // Tabellen-Zeilen mit Zebra-Stripes
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)

      rechnungsPositionen.forEach((p, index) => {
        checkNewPage(6)

        // Zebra-Stripe Hintergrund
        if (index % 2 === 0) {
          pdf.setFillColor(250, 248, 245) // Light gray
          pdf.rect(margin, y - 3, contentWidth, 5.5, 'F')
        }

        xPos = margin + 2
        const row = hatMehrereSpieler
          ? [
              p.istMonatlich ? p.datum : formatDateGerman(p.datum),
              p.zeit,
              p.istMonatlich ? 'Monatsbeitrag' : `${p.dauer.toFixed(1)} Std.`,
              p.spielerName.substring(0, 12),
              p.tarifName.substring(0, 12),
              `${p.netto.toFixed(2)} €`,
              ...(kleinunternehmer ? [] : [`${p.ust.toFixed(2)} €`]),
              `${p.brutto.toFixed(2)} €`
            ]
          : [
              p.istMonatlich ? p.datum : formatDateGerman(p.datum),
              p.zeit,
              p.istMonatlich ? 'Monatsbeitrag' : `${p.dauer.toFixed(1)} Std.`,
              p.tarifName.substring(0, 15),
              `${p.netto.toFixed(2)} €`,
              ...(kleinunternehmer ? [] : [`${p.ust.toFixed(2)} €`]),
              `${p.brutto.toFixed(2)} €`
            ]

        // Zeile mit Rahmen
        pdf.setDrawColor(232, 228, 223)
        pdf.line(margin, y + 1, margin + contentWidth, y + 1)

        row.forEach((cell, i) => {
          if (colWidths[i] > 0) {
            pdf.text(cell, xPos, y)
            xPos += colWidths[i]
          }
        })
        y += 5
      })

      // Korrektur falls vorhanden
      if (summen.korrektur !== 0) {
        checkNewPage(8)
        y += 2
        pdf.setFillColor(245, 230, 224)
        pdf.rect(margin, y - 3, contentWidth, 6, 'F')
        pdf.setFont('helvetica', 'italic')
        pdf.setTextColor(summen.korrektur < 0 ? 181 : 199, summen.korrektur < 0 ? 67 : 91, summen.korrektur < 0 ? 50 : 56)
        pdf.text(`Korrektur (${korrekturGrund || 'manuell'}): ${summen.korrektur >= 0 ? '+' : ''}${summen.korrektur.toFixed(2)} €`, margin + 2, y)
        pdf.setTextColor(0, 0, 0)
        y += 5
      }

      y += 6
      checkNewPage(35)

      // Summen-Box - Professionell grau
      pdf.setFillColor(250, 248, 245) // Light gray
      pdf.setDrawColor(45, 41, 38) // Dark gray
      pdf.setLineWidth(1)
      const summenHeight = kleinunternehmer ? 18 : 24
      pdf.roundedRect(margin, y - 3, contentWidth, summenHeight, 3, 3, 'F')
      pdf.line(margin, y - 3, margin, y - 3 + summenHeight)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text('Nettobetrag:', margin + 5, y + 2)
      pdf.text(`${summen.gesamtNetto.toFixed(2)} €`, pageWidth - margin - 5, y + 2, { align: 'right' })
      y += 5

      if (!kleinunternehmer) {
        pdf.text('USt (19%):', margin + 5, y + 2)
        pdf.text(`${summen.gesamtUst.toFixed(2)} €`, pageWidth - margin - 5, y + 2, { align: 'right' })
        y += 5
      }

      pdf.setDrawColor(26, 127, 127)
      pdf.line(margin + 5, y + 1, pageWidth - margin - 5, y + 1)
      y += 4

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.setTextColor(95, 114, 114) // Teal
      pdf.text('Gesamtbetrag:', margin + 5, y + 2)
      pdf.text(`${summen.gesamtBrutto.toFixed(2)} €`, pageWidth - margin - 5, y + 2, { align: 'right' })
      pdf.setTextColor(0, 0, 0)
      y += 12

      // Kleinunternehmer-Hinweis
      if (kleinunternehmer) {
        pdf.setFont('helvetica', 'italic')
        pdf.setFontSize(9)
        pdf.setTextColor(95, 114, 114)
        pdf.text('Gemäß §19 UStG wird keine Umsatzsteuer berechnet.', margin, y)
        pdf.setTextColor(0, 0, 0)
        y += 6
      }

      // Zahlungsinfo-Box - Professionell grau
      checkNewPage(40)
      y += 4
      pdf.setFillColor(250, 248, 245) // Light gray
      pdf.setDrawColor(74, 69, 67) // Dark gray
      pdf.setLineWidth(1)
      pdf.roundedRect(margin, y - 3, contentWidth, 28, 3, 3, 'F')
      pdf.line(margin, y - 3, margin, y + 25)

      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(45, 41, 38) // Dark gray
      pdf.text('ZAHLUNGSINFORMATIONEN', margin + 5, y + 2)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(61, 79, 79)
      pdf.text('Bitte überweisen Sie den Betrag innerhalb von 14 Tagen auf folgendes Konto:', margin + 5, y + 8)

      // IBAN-Box
      pdf.setFillColor(255, 255, 255, 0.6)
      pdf.roundedRect(margin + 5, y + 11, contentWidth - 10, 12, 2, 2, 'F')

      pdf.setTextColor(0, 0, 0)
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'bold')
      pdf.text('IBAN:', margin + 8, y + 16)
      pdf.setFont('courier', 'normal')
      pdf.setTextColor(95, 114, 114)
      pdf.text(iban, margin + 22, y + 16)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(0, 0, 0)
      pdf.text('Kontoinhaber:', margin + 8, y + 21)
      pdf.setFont('helvetica', 'normal')
      pdf.text(rechnungsstellerName, margin + 35, y + 21)
      y += 34

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text('Vielen Dank für Ihr Vertrauen!', margin, y)
      y += 6
      pdf.text('Mit freundlichen Grüßen', margin, y)
      y += 5
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(95, 114, 114)
      pdf.text(rechnungsstellerName, margin, y)
      pdf.setTextColor(0, 0, 0)

      // PDF als Blob
      pdfBlob = pdf.output('blob')
      }

      // PDF zu Base64 konvertieren
      const reader = new FileReader()
      const pdfBase64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1]
          resolve(base64)
        }
        reader.readAsDataURL(pdfBlob)
      })

      // E-Mail-Text - benutzerdefiniert oder Standard
      const defaultEmailText = selectedPdfVorlage
        ? `Sehr geehrte/r ${rechnungsempfaengerName},

anbei erhalten Sie die Rechnung Nr. ${rechnungsnummer} für ${monatFormatiert}.

Gesamtbetrag: ${summen.gesamtBrutto.toFixed(2)} €

Der Betrag wird per SEPA-Lastschrift von Ihrem Konto abgebucht.

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
${rechnungsstellerName}`
        : `Sehr geehrte/r ${rechnungsempfaengerName},

anbei erhalten Sie die Rechnung Nr. ${rechnungsnummer} für ${monatFormatiert}.

Gesamtbetrag: ${summen.gesamtBrutto.toFixed(2)} €

Bitte überweisen Sie den Betrag innerhalb von 14 Tagen auf folgendes Konto:
IBAN: ${iban}
Kontoinhaber: ${rechnungsstellerName}

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
${rechnungsstellerName}`

      // Benutzerdefinierten Text verwenden falls vorhanden
      const emailText = customEmailText || defaultEmailText
      const emailBetreff = customEmailBetreff || `Rechnung ${rechnungsnummer} - ${monatFormatiert}`

      // E-Mail über API senden
      const response = await fetch('/api/send-invoice-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtp: {
            host: profile.smtp_host,
            port: profile.smtp_port || 587,
            secure: profile.smtp_secure ?? true,
            user: profile.smtp_user,
            pass: profile.smtp_pass,
            fromEmail: profile.smtp_from_email || profile.smtp_user,
            fromName: profile.smtp_from_name || `${profile.name} ${profile.nachname || ''}`.trim()
          },
          to: spielerEmail,
          subject: emailBetreff,
          text: emailText,
          pdfBase64,
          pdfFilename: `Rechnung_${rechnungsnummer}.pdf`
        })
      })

      const result = await response.json()

      if (response.ok) {
        // Rechnung in Datenbank speichern
        const trainingIds = rechnungsPositionen.map(p => p.trainingId).filter(Boolean) as string[]
        const alleSpielerIds = [selectedSpielerId, ...verknuepfteSpieler.map(v => v.id)]

        const { error: saveError } = await supabase
          .from('manuelle_rechnungen')
          .insert({
            user_id: userId,
            rechnungsnummer,
            rechnungsdatum,
            monat: selectedMonth,
            empfaenger_name: rechnungsempfaengerName,
            empfaenger_adresse: rechnungsempfaengerAdresse,
            leistungszeitraum: monatFormatiert,
            beschreibung: `Trainingsrechnung für ${alleSpielerIds.length > 1 ? alleSpielerIds.length + ' Spieler' : selectedSummary?.spieler.name}`,
            positionen: rechnungsPositionen.map(p => ({
              beschreibung: `${p.spielerName}: ${p.tarifName} (${p.datum})`,
              menge: 1,
              einzelpreis: p.brutto
            })),
            ust_satz: kleinunternehmer ? 0 : 19,
            netto_gesamt: summen.gesamtNetto,
            ust_betrag: summen.gesamtUst,
            brutto_gesamt: summen.gesamtBrutto,
            zahlungsziel: 14,
            bezahlt: false,
            bar_bezahlt: false,
            training_ids: trainingIds,
            spieler_id: selectedSpielerId
          })

        if (saveError) {
          console.error('Fehler beim Speichern der Rechnung:', saveError)
        }

        alert(`Rechnung erfolgreich an ${spielerEmail} gesendet!`)
        onUpdate() // Daten neu laden damit Rechnung in offenen Posten erscheint
      } else {
        alert('Fehler beim E-Mail-Versand: ' + result.error)
      }
    } catch (err) {
      console.error('E-Mail Fehler:', err)
      const errorMsg = err instanceof Error ? err.message : String(err)
      alert('Fehler beim Erstellen oder Versenden der E-Mail: ' + errorMsg)
    } finally {
      setSendingEmail(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Rechnung erstellen - Schritt {step}/2</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {step === 1 && (
            <>
              <div className="form-group">
                <label>Rechnungsempfänger (Spieler) *</label>
                <select
                  className="form-control"
                  value={selectedSpielerId}
                  onChange={(e) => setSelectedSpielerId(e.target.value)}
                >
                  <option value="">-- Spieler auswählen --</option>
                  {/* Nur Spieler anzeigen die keinen anderen Rechnungsempfänger haben */}
                  {spielerSummary
                    .filter(s => !s.spieler.rechnungs_spieler_id && s.offeneSumme > 0)
                    .map((s) => {
                      // Prüfe ob verknüpfte Spieler existieren
                      const verknuepfte = spieler.filter(sp => sp.rechnungs_spieler_id === s.spieler.id)
                      const verknuepfteNames = verknuepfte.map(v => v.name).join(', ')
                      const offeneTrainings = s.trainings.filter(t => !t.bar_bezahlt).length
                      return (
                        <option key={s.spieler.id} value={s.spieler.id}>
                          {s.spieler.name} - {s.offeneSumme.toFixed(2)} € offen ({offeneTrainings} Trainings)
                          {verknuepfte.length > 0 ? ` [+${verknuepfteNames}]` : ''}
                        </option>
                      )
                    })}
                </select>
              </div>

              {/* Hinweis auf verknüpfte Spieler (Geschwister) */}
              {selectedSpielerId && verknuepfteSummaries.length > 0 && (
                <div style={{ background: 'var(--primary-light)', padding: 12, borderRadius: 'var(--radius)', marginBottom: 16, border: '1px solid var(--primary)' }}>
                  <div style={{ fontWeight: 500, marginBottom: 8, color: 'var(--primary)' }}>
                    Verknüpfte Spieler auf dieser Rechnung:
                  </div>
                  {verknuepfteSummaries.map(vs => (
                    <div key={vs.spieler.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                      <span>{vs.spieler.name}</span>
                      <span>{vs.summary!.offeneSumme.toFixed(2)} € ({vs.summary!.trainings.filter(t => !t.bar_bezahlt).length} Trainings)</span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--primary)', marginTop: 8, paddingTop: 8, fontSize: 12, color: 'var(--gray-600)' }}>
                    Die Trainings dieser Spieler werden automatisch mit auf die Rechnung aufgenommen.
                  </div>
                </div>
              )}

              {selectedSpielerId && rechnungsPositionen.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontWeight: 500, marginBottom: 8, display: 'block' }}>
                    Trainings-Aufstellung ({rechnungsPositionen.length} Einheiten)
                  </label>
                  <div className="table-container" style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)' }}>
                    <table style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Datum</th>
                          <th>Zeit</th>
                          {verknuepfteSummaries.length > 0 && <th>Spieler</th>}
                          <th>Tarif</th>
                          <th style={{ textAlign: 'right' }}>Brutto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rechnungsPositionen.map((p, i) => (
                          <tr key={i} style={p.istMonatlich ? { background: 'var(--primary-light)' } : {}}>
                            <td>{p.istMonatlich ? p.datum : formatDateGerman(p.datum)}</td>
                            <td>{p.zeit}</td>
                            {verknuepfteSummaries.length > 0 && <td>{p.spielerName}</td>}
                            <td>{p.tarifName}{p.istMonatlich && <span style={{ fontSize: 10, marginLeft: 4, color: 'var(--primary)' }}>(mtl.)</span>}</td>
                            <td style={{ textAlign: 'right' }}>{p.brutto.toFixed(2)} €</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ background: 'var(--success-light)', padding: 12, borderRadius: 'var(--radius)', marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>Zwischensumme Netto:</span>
                      <span>{summen.netto.toFixed(2)} €</span>
                    </div>
                    {!kleinunternehmer && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span>Zwischensumme USt:</span>
                        <span>{summen.ust.toFixed(2)} €</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500, fontSize: 14 }}>
                      <span>Zwischensumme Brutto:</span>
                      <span>{summen.brutto.toFixed(2)} €</span>
                    </div>
                    {summen.korrektur !== 0 && (
                      <>
                        <div style={{ borderTop: '1px dashed var(--gray-400)', margin: '8px 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: summen.korrektur < 0 ? 'var(--danger)' : 'var(--success)' }}>
                          <span>Korrektur ({korrekturGrund || 'manuell'}):</span>
                          <span>{summen.korrektur >= 0 ? '+' : ''}{summen.korrektur.toFixed(2)} €</span>
                        </div>
                      </>
                    )}
                    <div style={{ borderTop: '1px solid var(--gray-400)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 16 }}>
                      <span>Gesamtbetrag (brutto):</span>
                      <span>{summen.gesamtBrutto.toFixed(2)} €</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Manuelle Korrektur */}
              {selectedSpielerId && (
                <div style={{ background: 'var(--warning-light)', padding: 12, borderRadius: 'var(--radius)', marginBottom: 16 }}>
                  <label style={{ fontWeight: 500, marginBottom: 8, display: 'block', color: 'var(--warning)' }}>
                    Manuelle Korrektur (optional)
                  </label>
                  <p style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 8 }}>
                    Für Gutschriften (z.B. Regenausfall) einen negativen Betrag eingeben, für Zuschläge einen positiven.
                  </p>
                  <div className="form-row">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 12 }}>Betrag (brutto, €)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={korrekturBetrag}
                        onChange={(e) => setKorrekturBetrag(e.target.value)}
                        placeholder="z.B. -15.00"
                        step="0.01"
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 12 }}>Grund</label>
                      <input
                        type="text"
                        className="form-control"
                        value={korrekturGrund}
                        onChange={(e) => setKorrekturGrund(e.target.value)}
                        placeholder="z.B. Regenausfall 05.12."
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>IBAN</label>
                <input
                  type="text"
                  className="form-control"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Deine Adresse</label>
                <textarea
                  className="form-control"
                  value={adresse}
                  onChange={(e) => {
                    setAdresse(e.target.value)
                    setRechnungsstellerAdresse(e.target.value)
                  }}
                  rows={2}
                />
              </div>
              <div className="form-group">
                <label>USt-IdNr (optional)</label>
                <input
                  type="text"
                  className="form-control"
                  value={ustIdNr}
                  onChange={(e) => setUstIdNr(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="checkbox-group">
                  <input
                    type="checkbox"
                    checked={kleinunternehmer}
                    onChange={(e) => setKleinunternehmer(e.target.checked)}
                  />
                  Kleinunternehmer (§19 UStG) - keine USt ausweisen
                </label>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {/* Vorschau-Tabs */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--gray-200)', paddingBottom: 12 }}>
                <button
                  type="button"
                  className={`btn btn-sm ${previewMode === 'edit' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPreviewMode('edit')}
                  style={{ fontSize: 13 }}
                >
                  Bearbeiten
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${previewMode === 'pdf' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPreviewMode('pdf')}
                  style={{ fontSize: 13 }}
                >
                  PDF-Vorschau
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${previewMode === 'email' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPreviewMode('email')}
                  style={{ fontSize: 13 }}
                >
                  E-Mail-Vorschau
                </button>
              </div>

              {/* PDF-Vorschau */}
              {previewMode === 'pdf' && (
                <div>
                  <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                      Klicke in die Vorschau um Text direkt zu bearbeiten
                    </span>
                    {customPdfHtml && (
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => setCustomPdfHtml('')}
                        style={{ fontSize: 11, padding: '4px 8px' }}
                      >
                        Auf Standard zurücksetzen
                      </button>
                    )}
                  </div>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setCustomPdfHtml(e.currentTarget.innerHTML)}
                    dangerouslySetInnerHTML={{ __html: customPdfHtml || vorschauDaten.pdfHtml }}
                    style={{
                      background: '#fff',
                      border: '1px solid var(--gray-300)',
                      borderRadius: 'var(--radius)',
                      padding: 24,
                      maxHeight: 500,
                      overflowY: 'auto',
                      fontFamily: "'Times New Roman', serif",
                      fontSize: 12,
                      lineHeight: 1.6,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      cursor: 'text',
                      outline: 'none'
                    }}
                  />
                </div>
              )}

              {/* E-Mail-Vorschau */}
              {previewMode === 'email' && (
                <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                  <div style={{ background: 'var(--gray-100)', padding: '12px 16px', borderBottom: '1px solid var(--gray-300)' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 500, color: 'var(--gray-600)', minWidth: 50 }}>An:</span>
                      <span>{selectedSummary?.spieler.kontakt_email || '(keine E-Mail hinterlegt)'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontWeight: 500, color: 'var(--gray-600)', minWidth: 50 }}>Betreff:</span>
                      <input
                        type="text"
                        className="form-control"
                        value={customEmailBetreff || vorschauDaten.emailBetreff}
                        onChange={(e) => setCustomEmailBetreff(e.target.value)}
                        placeholder={vorschauDaten.emailBetreff}
                        style={{ flex: 1, fontSize: 14 }}
                      />
                    </div>
                  </div>
                  <div style={{ padding: 16 }}>
                    <textarea
                      className="form-control"
                      value={customEmailText || vorschauDaten.emailText}
                      onChange={(e) => setCustomEmailText(e.target.value)}
                      placeholder={vorschauDaten.emailText}
                      rows={12}
                      style={{ fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6, resize: 'vertical' }}
                    />
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gray-500)' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => {
                          setCustomEmailText('')
                          setCustomEmailBetreff('')
                        }}
                        style={{ fontSize: 11, padding: '4px 8px' }}
                      >
                        Auf Standard zurücksetzen
                      </button>
                    </div>
                  </div>
                  <div style={{ background: 'var(--gray-100)', padding: '12px 16px', borderTop: '1px solid var(--gray-300)', fontSize: 12, color: 'var(--gray-600)' }}>
                    Anhang: Rechnung_{rechnungsnummer}.pdf
                  </div>
                </div>
              )}

              {/* Bearbeitungs-Formular */}
              {previewMode === 'edit' && (
              <>
              <div className="form-row">
                <div className="form-group">
                  <label>Rechnungssteller</label>
                  <input
                    type="text"
                    className="form-control"
                    value={rechnungsstellerName}
                    onChange={(e) => setRechnungsstellerName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Rechnungsnummer</label>
                  <input
                    type="text"
                    className="form-control"
                    value={rechnungsnummer}
                    onChange={(e) => setRechnungsnummer(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Rechnungssteller Adresse</label>
                <textarea
                  className="form-control"
                  value={rechnungsstellerAdresse}
                  onChange={(e) => setRechnungsstellerAdresse(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Empfänger Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={rechnungsempfaengerName}
                    onChange={(e) => setRechnungsempfaengerName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Rechnungsdatum</label>
                  <input
                    type="date"
                    className="form-control"
                    value={rechnungsdatum}
                    onChange={(e) => setRechnungsdatum(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Empfänger Adresse</label>
                <textarea
                  className="form-control"
                  value={rechnungsempfaengerAdresse}
                  onChange={(e) => setRechnungsempfaengerAdresse(e.target.value)}
                  rows={2}
                />
              </div>

              {/* PDF-Vorlage Auswahl */}
              <div className="form-group" style={{ marginTop: 16 }}>
                <label>PDF-Vorlage</label>
                <select
                  className="form-control"
                  value={selectedPdfVorlageId}
                  onChange={(e) => setSelectedPdfVorlageId(e.target.value)}
                >
                  <option value="">Standard-Vorlage</option>
                  {pdfVorlagen.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.ist_standard ? '(bevorzugt)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ background: 'var(--gray-100)', padding: 16, borderRadius: 'var(--radius)', marginTop: 16 }}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>Rechnungsvorschau:</div>
                <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                  {rechnungsPositionen.length} Positionen im Zeitraum {selectedMonth}
                  {summen.korrektur !== 0 && ` + 1 Korrektur`}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <span>Zwischensumme Netto:</span>
                  <span>{summen.netto.toFixed(2)} €</span>
                </div>
                {!kleinunternehmer && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Zwischensumme USt:</span>
                    <span>{summen.ust.toFixed(2)} €</span>
                  </div>
                )}
                {summen.korrektur !== 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: summen.korrektur < 0 ? 'var(--danger)' : 'var(--success)' }}>
                    <span>Korrektur ({korrekturGrund || 'manuell'}):</span>
                    <span>{summen.korrektur >= 0 ? '+' : ''}{summen.korrektur.toFixed(2)} €</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <span>Nettobetrag gesamt:</span>
                  <strong>{summen.gesamtNetto.toFixed(2)} €</strong>
                </div>
                {!kleinunternehmer && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>USt gesamt:</span>
                    <strong>{summen.gesamtUst.toFixed(2)} €</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, marginTop: 8, borderTop: '1px solid var(--gray-300)', paddingTop: 8 }}>
                  <span>Gesamtbetrag:</span>
                  <strong>{summen.gesamtBrutto.toFixed(2)} €</strong>
                </div>
              </div>
              </>
              )}
            </>
          )}
        </div>
        {/* Option: In Buchhaltung speichern */}
        {step === 2 && (
          <div style={{ padding: '0 16px 16px', borderTop: '1px solid #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 12 }}>
              <input
                type="checkbox"
                checked={alsOffenenPostenSpeichern}
                onChange={e => setAlsOffenenPostenSpeichern(e.target.checked)}
              />
              In Buchhaltung übernehmen (als offener Posten speichern)
            </label>
          </div>
        )}

        <div className="modal-footer">
          {step === 2 && (
            <button className="btn btn-secondary" onClick={() => setStep(1)}>
              Zurück
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          {step === 1 ? (
            <button
              className="btn btn-primary"
              onClick={() => setStep(2)}
              disabled={!selectedSpielerId}
            >
              Weiter
            </button>
          ) : (
            <>
              <button
                className="btn btn-success"
                onClick={sendInvoiceEmail}
                disabled={sendingEmail || !selectedSummary?.spieler.kontakt_email || !profile?.smtp_host}
                title={!profile?.smtp_host ? 'SMTP nicht konfiguriert' : !selectedSummary?.spieler.kontakt_email ? 'Keine E-Mail hinterlegt' : 'PDF-Rechnung per E-Mail senden'}
              >
                {sendingEmail ? 'Sende...' : 'PDF per E-Mail'}
              </button>
              <button className="btn btn-primary" onClick={generatePDF}>
                {alsOffenenPostenSpeichern ? 'Speichern & PDF' : 'PDF erstellen'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ============ MANUELLE RECHNUNG MODAL ============
function ManuelleRechnungModal({
  profile,
  selectedMonth,
  userId,
  onClose,
  onSave
}: {
  profile: TrainerProfile | null
  selectedMonth: string
  userId: string
  onClose: () => void
  onSave: () => void
}) {
  const kleinunternehmer = profile?.kleinunternehmer ?? false

  const [rechnungData, setRechnungData] = useState({
    empfaengerName: '',
    empfaengerAdresse: '',
    rechnungsnummer: generateRechnungsnummer(),
    rechnungsdatum: formatDate(new Date()),
    leistungszeitraum: '',
    beschreibung: '',
    positionen: [{ beschreibung: '', menge: 1, einzelpreis: 0 }] as { beschreibung: string; menge: number; einzelpreis: number }[],
    ustSatz: kleinunternehmer ? 0 : 19,
    zahlungsziel: 14,
    freitext: '',
    alsOffenPostenSpeichern: true,
    email: '' // Email of the recipient
  })

  const [saving, setSaving] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [emailText, setEmailText] = useState('')
  const [editedHtmlContent, setEditedHtmlContent] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  // E-Mail-Text generieren/aktualisieren wenn sich Rechnungsdaten ändern
  const generateEmailText = () => {
    return `Sehr geehrte Damen und Herren,

anbei erhalten Sie die Rechnung Nr. ${rechnungData.rechnungsnummer}.

Gesamtbetrag: ${bruttoGesamt.toFixed(2)} €

Bitte überweisen Sie den Betrag innerhalb von ${rechnungData.zahlungsziel} Tagen.

Mit freundlichen Grüßen
${profile?.name || ''}`
  }

  const addPosition = () => {
    setRechnungData(prev => ({
      ...prev,
      positionen: [...prev.positionen, { beschreibung: '', menge: 1, einzelpreis: 0 }]
    }))
  }

  const removePosition = (index: number) => {
    if (rechnungData.positionen.length > 1) {
      setRechnungData(prev => ({
        ...prev,
        positionen: prev.positionen.filter((_, i) => i !== index)
      }))
    }
  }

  const updatePosition = (index: number, field: string, value: string | number) => {
    setRechnungData(prev => ({
      ...prev,
      positionen: prev.positionen.map((p, i) => i === index ? { ...p, [field]: value } : p)
    }))
  }

  // Positionen sind Brutto-Preise, daraus Netto berechnen
  const bruttoGesamt = rechnungData.positionen.reduce((s, p) => s + (p.menge * p.einzelpreis), 0)
  const nettoGesamt = kleinunternehmer || rechnungData.ustSatz === 0
    ? bruttoGesamt
    : bruttoGesamt / (1 + rechnungData.ustSatz / 100)
  const ustBetrag = bruttoGesamt - nettoGesamt

  const saveRechnung = async () => {
    if (!rechnungData.empfaengerName || rechnungData.positionen.every(p => p.einzelpreis === 0)) {
      alert('Bitte Empfänger und mindestens eine Position mit Preis angeben.')
      return
    }

    setSaving(true)
    try {
      // Speichere in Datenbank
      await supabase.from('manuelle_rechnungen').insert({
        user_id: userId,
        rechnungsnummer: rechnungData.rechnungsnummer,
        rechnungsdatum: rechnungData.rechnungsdatum,
        monat: selectedMonth,
        empfaenger_name: rechnungData.empfaengerName,
        empfaenger_adresse: rechnungData.empfaengerAdresse || null,
        leistungszeitraum: rechnungData.leistungszeitraum || null,
        beschreibung: rechnungData.beschreibung || null,
        positionen: rechnungData.positionen,
        ust_satz: rechnungData.ustSatz,
        netto_gesamt: nettoGesamt,
        ust_betrag: ustBetrag,
        brutto_gesamt: bruttoGesamt,
        zahlungsziel: rechnungData.zahlungsziel,
        freitext: rechnungData.freitext || null,
        bezahlt: false,
        bar_bezahlt: false
      })

      onSave()
    } catch (err) {
      console.error('Fehler beim Speichern:', err)
      alert('Fehler beim Speichern der Rechnung')
    } finally {
      setSaving(false)
    }
  }

  // HTML-Template für PDF generieren - Klassisches Design wie Standard-Rechnungen
  const generatePdfHtml = () => {
    const rechnungsstellerName = `${profile?.name || ''}${profile?.nachname ? ' ' + profile.nachname : ''}`.trim()
    const rechnungsstellerAdresse = profile?.adresse || ''
    const ustIdNr = profile?.ust_id_nr || ''
    const iban = profile?.iban || ''

    // Positionen-Tabelle HTML - mit schwarzem Text für maximale Lesbarkeit
    const positionenHtml = rechnungData.positionen.map((p, idx) => {
      const gesamt = p.menge * p.einzelpreis
      const netto = kleinunternehmer ? gesamt : gesamt / (1 + rechnungData.ustSatz / 100)
      const ust = gesamt - netto
      return `
        <tr style="border-bottom: 1px solid #1E40AF; background: ${idx % 2 === 0 ? '#ffffff' : '#f5f5f5'};">
          <td style="padding: 10px 8px; color: #1E40AF !important; -webkit-text-fill-color: #1E40AF !important;">${idx + 1}</td>
          <td style="padding: 10px 8px; color: #1E40AF !important; -webkit-text-fill-color: #1E40AF !important; font-weight: 500;">${p.beschreibung || '-'}</td>
          <td style="padding: 10px 8px; text-align: right; color: #1E40AF !important; -webkit-text-fill-color: #1E40AF !important;">${p.menge}</td>
          <td style="padding: 10px 8px; text-align: right; color: #1E40AF !important; -webkit-text-fill-color: #1E40AF !important; font-weight: 600;">${netto.toFixed(2)} €</td>
          ${!kleinunternehmer ? `<td style="padding: 10px 8px; text-align: right; color: #1E40AF !important; -webkit-text-fill-color: #1E40AF !important;">${ust.toFixed(2)} €</td>` : ''}
          <td style="padding: 10px 8px; text-align: right; color: #1E40AF !important; -webkit-text-fill-color: #1E40AF !important; font-weight: 700;">${gesamt.toFixed(2)} €</td>
        </tr>
      `
    }).join('')

    const introText = rechnungData.beschreibung
      ? `für ${rechnungData.beschreibung} erlaube ich mir, folgende Rechnung zu stellen:`
      : 'ich erlaube mir, folgende Rechnung zu stellen:'

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Rechnung ${rechnungData.rechnungsnummer}</title>
        <style>
          body {
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            padding: 40px;
            line-height: 1.6;
            font-size: 12px;
            color: #1E40AF;
            background: #ffffff;
          }
          @media print {
            body { padding: 20px; margin: 0; }
            @page { size: A4; margin: 15mm; }
          }
        </style>
      </head>
      <body>
        <!-- Header mit farbigem Balken -->
        <div style="background: #3B82F6; margin: -40px -40px 24px -40px; padding: 24px 40px;">
          <h1 style="text-align: center; margin: 0; font-size: 28px; color: white; font-weight: 700; letter-spacing: 2px;">RECHNUNG</h1>
        </div>

        <!-- Adressbereich -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 24px; gap: 20px;">
          <div style="flex: 1; background: #EFF6FF; padding: 16px; border-left: 3px solid #374151;">
            <div style="font-size: 10px; text-transform: uppercase; color: #6B7280; font-weight: 600; margin-bottom: 8px;">Rechnungssteller</div>
            <div style="font-weight: 600; color: #1E40AF;">${rechnungsstellerName}</div>
            <div style="color: #374151; font-size: 11px; margin-top: 4px;">${rechnungsstellerAdresse.replace(/\n/g, '<br>')}</div>
            ${profile?.steuernummer ? `<div style="color: #6B7280; font-size: 10px; margin-top: 8px;">Steuernummer: ${profile?.steuernummer}</div>` : ''}
            ${ustIdNr ? `<div style="color: #6B7280; font-size: 10px;">USt-IdNr: ${ustIdNr}</div>` : ''}
          </div>
          <div style="flex: 1; background: #EFF6FF; padding: 16px; border-left: 3px solid #6B7280;">
            <div style="font-size: 10px; text-transform: uppercase; color: #6B7280; font-weight: 600; margin-bottom: 8px;">Rechnungsempfänger</div>
            <div style="font-weight: 600; color: #1E40AF;">${rechnungData.empfaengerName}</div>
            <div style="color: #374151; font-size: 11px; margin-top: 4px;">${(rechnungData.empfaengerAdresse || '').replace(/\n/g, '<br>')}</div>
          </div>
        </div>

        <!-- Rechnungsdetails - 3 separate Boxen -->
        <div style="display: flex; gap: 12px; margin-bottom: 24px;">
          <div style="flex: 1; background: #EFF6FF; padding: 12px 16px; text-align: center; border: 1px solid #E8E4DF;">
            <div style="font-size: 10px; text-transform: uppercase; color: #6B7280; font-weight: 600;">Rechnungsnummer</div>
            <div style="font-size: 14px; font-weight: 700; color: #1E40AF; margin-top: 4px;">${rechnungData.rechnungsnummer}</div>
          </div>
          <div style="flex: 1; background: #EFF6FF; padding: 12px 16px; text-align: center; border: 1px solid #E8E4DF;">
            <div style="font-size: 10px; text-transform: uppercase; color: #6B7280; font-weight: 600;">Rechnungsdatum</div>
            <div style="font-size: 14px; font-weight: 700; color: #1E40AF; margin-top: 4px;">${formatDateGerman(rechnungData.rechnungsdatum)}</div>
          </div>
          ${rechnungData.leistungszeitraum ? `
          <div style="flex: 1; background: #EFF6FF; padding: 12px 16px; text-align: center; border: 1px solid #E8E4DF;">
            <div style="font-size: 10px; text-transform: uppercase; color: #6B7280; font-weight: 600;">Leistungszeitraum</div>
            <div style="font-size: 14px; font-weight: 700; color: #1E40AF; margin-top: 4px;">${rechnungData.leistungszeitraum}</div>
          </div>
          ` : ''}
        </div>

        <!-- Anrede -->
        <p style="color: #374151; margin-bottom: 8px;">Sehr geehrte Damen und Herren,</p>
        <p style="color: #374151; margin-bottom: 24px;">${introText}</p>

        <!-- Positionen-Tabelle -->
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; border: 2px solid #1E40AF;">
          <thead>
            <tr style="background: #d1d5db; border-bottom: 2px solid #1E40AF;">
              <th style="padding: 10px 8px; text-align: left; color: #1E40AF !important; -webkit-text-fill-color: #1E40AF !important; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Pos.</th>
              <th style="padding: 10px 8px; text-align: left; color: #1E40AF !important; -webkit-text-fill-color: #1E40AF !important; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Beschreibung</th>
              <th style="padding: 10px 8px; text-align: right; color: #1E40AF !important; -webkit-text-fill-color: #1E40AF !important; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Menge</th>
              <th style="padding: 10px 8px; text-align: right; color: #1E40AF !important; -webkit-text-fill-color: #1E40AF !important; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Netto</th>
              ${!kleinunternehmer ? '<th style="padding: 10px 8px; text-align: right; color: #1E40AF !important; -webkit-text-fill-color: #1E40AF !important; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">USt</th>' : ''}
              <th style="padding: 10px 8px; text-align: right; color: #1E40AF !important; -webkit-text-fill-color: #1E40AF !important; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Brutto</th>
            </tr>
          </thead>
          <tbody>
            ${positionenHtml}
          </tbody>
        </table>

        <!-- Summen-Block -->
        <div style="background: #EFF6FF; border: 1px solid #E8E4DF; padding: 16px; margin-top: 20px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #374151;">
            <span>Nettobetrag:</span>
            <span style="font-family: monospace; color: #1E40AF;">${nettoGesamt.toFixed(2)} €</span>
          </div>
          ${!kleinunternehmer ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #374151;">
            <span>USt (${rechnungData.ustSatz}%):</span>
            <span style="font-family: monospace; color: #1E40AF;">${ustBetrag.toFixed(2)} €</span>
          </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; padding-top: 10px; margin-top: 10px; border-top: 2px solid #1E40AF; font-weight: bold; font-size: 14px; color: #1E40AF;">
            <span>Gesamtbetrag:</span>
            <span style="font-family: monospace; font-size: 16px;">${bruttoGesamt.toFixed(2)} €</span>
          </div>
        </div>

        ${kleinunternehmer ? '<p style="color: #6B7280; font-style: italic; margin-top: 16px; font-size: 11px;">Gemäß §19 UStG wird keine Umsatzsteuer berechnet.</p>' : ''}

        ${rechnungData.freitext ? `<p style="color: #374151; margin-top: 16px;">${rechnungData.freitext}</p>` : ''}

        <!-- Zahlungshinweis -->
        <div style="margin-top: 32px; background: #EFF6FF; padding: 20px; border: 1px solid #E8E4DF; border-left: 3px solid #374151;">
          <div style="font-weight: 600; color: #1E40AF; margin-bottom: 12px;">Zahlungsinformationen</div>
          <div style="display: flex; gap: 24px; color: #374151; font-size: 12px;">
            <div>
              <span style="font-weight: 600; color: #1E40AF;">IBAN:</span> ${iban}<br>
              <span style="font-weight: 600; color: #1E40AF;">Kontoinhaber:</span> ${rechnungsstellerName}
            </div>
            <div style="color: #6B7280;">
              Bitte überweisen Sie den Betrag<br>innerhalb von <strong>${rechnungData.zahlungsziel} Tagen</strong>.
            </div>
          </div>
        </div>

        <!-- Abschluss -->
        <div style="margin-top: 32px; color: #374151;">
          <p>Vielen Dank für Ihr Vertrauen!</p>
          <p style="margin-top: 16px;">Mit freundlichen Grüßen<br><strong style="color: #1E40AF;">${rechnungsstellerName}</strong></p>
        </div>
      </body>
      </html>
    `
  }

  // Holt den finalen HTML-Inhalt (bearbeitet oder generiert)
  const getFinalHtml = () => {
    if (editedHtmlContent) {
      // Wenn bearbeitet, das bearbeitete HTML in ein vollständiges Dokument einbetten
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Rechnung ${rechnungData.rechnungsnummer}</title>
          <style>
            body {
              font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
              padding: 40px;
              line-height: 1.6;
              font-size: 12px;
              color: #1E40AF;
              background: #ffffff;
            }
            @media print {
              body { padding: 20px; margin: 0; }
              @page { size: A4; margin: 15mm; }
            }
          </style>
        </head>
        <body>
          ${editedHtmlContent}
        </body>
        </html>
      `
    }
    return generatePdfHtml()
  }

  const generatePdf = async (returnBase64 = false) => {
    const html = getFinalHtml()

    if (returnBase64) {
      // Für E-Mail-Versand: html2canvas verwenden
      const container = document.createElement('div')
      container.id = 'pdf-render-container'
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 794px;
        background: white;
        z-index: 99999;
        padding: 24px;
        box-sizing: border-box;
        font-family: 'Segoe UI', system-ui, sans-serif;
        font-size: 12px;
        line-height: 1.6;
        color: #1E40AF !important;
      `

      // Body-Inhalt extrahieren
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
      const bodyContent = bodyMatch ? bodyMatch[1] : html

      // Style-Block für schwarze Farben (wie Standard-Rechnungen)
      container.innerHTML = `
        <style>
          #pdf-render-container,
          #pdf-render-container * {
            color: #1E40AF !important;
            -webkit-text-fill-color: #1E40AF !important;
          }
          #pdf-render-container table,
          #pdf-render-container table *,
          #pdf-render-container td,
          #pdf-render-container th,
          #pdf-render-container tr,
          #pdf-render-container tbody,
          #pdf-render-container tbody *,
          #pdf-render-container tbody tr,
          #pdf-render-container tbody td,
          #pdf-render-container thead,
          #pdf-render-container strong {
            color: #1E40AF !important;
            -webkit-text-fill-color: #1E40AF !important;
            opacity: 1 !important;
          }
        </style>
        ${bodyContent}
      `
      document.body.appendChild(container)

      await new Promise(resolve => setTimeout(resolve, 300))

      try {
        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 794,
          windowWidth: 794,
          onclone: (clonedDoc) => {
            // Force black color on all elements (wie Standard-Rechnungen)
            const clonedContainer = clonedDoc.getElementById('pdf-render-container')
            if (clonedContainer) {
              const allElements = clonedContainer.querySelectorAll('*')
              allElements.forEach((el) => {
                const htmlEl = el as HTMLElement
                htmlEl.style.setProperty('color', '#1E40AF', 'important')
                htmlEl.style.setProperty('-webkit-text-fill-color', '#1E40AF', 'important')
                htmlEl.style.setProperty('opacity', '1', 'important')
              })
              // Extra: Target tbody elements specifically
              const tbodyElements = clonedContainer.querySelectorAll('tbody, tbody *, td, tr, th')
              tbodyElements.forEach((el) => {
                const htmlEl = el as HTMLElement
                htmlEl.style.setProperty('color', '#1E40AF', 'important')
                htmlEl.style.setProperty('-webkit-text-fill-color', '#1E40AF', 'important')
                htmlEl.style.setProperty('opacity', '1', 'important')
              })
            }
          }
        })

        document.body.removeChild(container)

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
        // JPEG mit hoher Qualität (wie Standard-Rechnungen)
        const imgData = canvas.toDataURL('image/jpeg', 0.95)
        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = pdf.internal.pageSize.getHeight()
        const imgWidth = canvas.width
        const imgHeight = canvas.height
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
        const imgX = (pdfWidth - imgWidth * ratio) / 2
        const imgY = 0

        pdf.addImage(imgData, 'JPEG', imgX, imgY, imgWidth * ratio, imgHeight * ratio)

        const pdfBlob = pdf.output('blob')
        const reader = new FileReader()
        return new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1]
            resolve(base64)
          }
          reader.readAsDataURL(pdfBlob)
        })
      } catch (err) {
        document.body.removeChild(container)
        throw err
      }
    } else {
      // Für Druck: Fenster öffnen wie bei Standard-Rechnungen
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const printWindow = window.open(url, '_blank')
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print()
          URL.revokeObjectURL(url)
        }
      }
    }
  }

  const generateAndSavePDF = async () => {
    // Zuerst speichern
    if (rechnungData.alsOffenPostenSpeichern) {
      await saveRechnung()
    }
    await generatePdf(false)
    
    if (!rechnungData.alsOffenPostenSpeichern) {
      onClose()
    }
  }

  const sendEmail = async () => {
    if (!rechnungData.email) {
      alert('Bitte eine E-Mail-Adresse angeben.')
      return
    }

    if (!profile?.smtp_host) {
        alert('SMTP-Server ist nicht konfiguriert. Bitte in den Einstellungen vornehmen.')
        return
    }

    setSendingEmail(true)
    try {
      if (rechnungData.alsOffenPostenSpeichern) {
        await saveRechnung()
      }

      const pdfBase64 = await generatePdf(true)

      const emailBetreff = `Rechnung ${rechnungData.rechnungsnummer}`
      const finalEmailText = emailText || generateEmailText()

      const response = await fetch('/api/send-invoice-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtp: {
            host: profile.smtp_host,
            port: profile.smtp_port || 587,
            secure: profile.smtp_secure ?? true,
            user: profile.smtp_user,
            pass: profile.smtp_pass,
            fromEmail: profile.smtp_from_email || profile.smtp_user,
            fromName: profile.smtp_from_name || `${profile.name} ${profile.nachname || ''}`.trim()
          },
          to: rechnungData.email,
          subject: emailBetreff,
          text: finalEmailText,
          pdfBase64,
          pdfFilename: `Rechnung_${rechnungData.rechnungsnummer}.pdf`
        })
      })

      const result = await response.json()

      if (response.ok) {
        alert(`Rechnung erfolgreich an ${rechnungData.email} gesendet!`)
        onClose()
      } else {
        alert('Fehler beim E-Mail-Versand: ' + result.error)
      }
    } catch (err) {
      console.error('Fehler:', err)
      alert('Fehler beim Senden der E-Mail')
    } finally {
      setSendingEmail(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-header">
          <h2>Sonstige Rechnung erstellen</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Rechnungsnummer *</label>
            <input
              type="text"
              className="form-control"
              value={rechnungData.rechnungsnummer}
              onChange={e => setRechnungData(prev => ({ ...prev, rechnungsnummer: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Rechnungsdatum *</label>
            <input
              type="date"
              className="form-control"
              value={rechnungData.rechnungsdatum}
              onChange={e => setRechnungData(prev => ({ ...prev, rechnungsdatum: e.target.value }))}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Empfänger Name *</label>
            <input
              type="text"
              className="form-control"
              value={rechnungData.empfaengerName}
              onChange={e => setRechnungData(prev => ({ ...prev, empfaengerName: e.target.value }))}
              placeholder="Name des Rechnungsempfängers"
            />
          </div>
          <div className="form-group">
            <label>Leistungszeitraum</label>
            <input
              type="text"
              className="form-control"
              value={rechnungData.leistungszeitraum}
              onChange={e => setRechnungData(prev => ({ ...prev, leistungszeitraum: e.target.value }))}
              placeholder="z.B. Januar 2025"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Empfänger Adresse</label>
          <textarea
            className="form-control"
            value={rechnungData.empfaengerAdresse}
            onChange={e => setRechnungData(prev => ({ ...prev, empfaengerAdresse: e.target.value }))}
            rows={2}
            placeholder="Straße, PLZ Ort"
          />
        </div>

        <div className="form-group">
            <label>Empfänger E-Mail (für Versand)</label>
            <input
              type="email"
              className="form-control"
              value={rechnungData.email}
              onChange={e => setRechnungData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="email@beispiel.de"
            />
        </div>

        <div className="form-group">
          <label>Rechnungsbeschreibung</label>
          <input
            type="text"
            className="form-control"
            value={rechnungData.beschreibung}
            onChange={e => setRechnungData(prev => ({ ...prev, beschreibung: e.target.value }))}
            placeholder="z.B. Vermietung Tennisplatz"
          />
        </div>

        <h4 style={{ margin: '24px 0 12px' }}>Positionen</h4>
        {rechnungData.positionen.map((pos, index) => (
          <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 3, marginBottom: 0 }}>
              {index === 0 && <label>Beschreibung</label>}
              <input
                type="text"
                className="form-control"
                value={pos.beschreibung}
                onChange={e => updatePosition(index, 'beschreibung', e.target.value)}
                placeholder="Leistungsbeschreibung"
              />
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              {index === 0 && <label>Menge</label>}
              <input
                type="number"
                className="form-control"
                value={pos.menge}
                onChange={e => updatePosition(index, 'menge', parseFloat(e.target.value) || 0)}
                min="0"
                step="0.5"
              />
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              {index === 0 && <label>Brutto (EUR)</label>}
              <input
                type="number"
                className="form-control"
                value={pos.einzelpreis}
                onChange={e => updatePosition(index, 'einzelpreis', parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
              />
            </div>
            <button
              className="btn btn-sm"
              style={{ background: 'var(--danger)', color: 'white' }}
              onClick={() => removePosition(index)}
              disabled={rechnungData.positionen.length <= 1}
            >
              x
            </button>
          </div>
        ))}
        <button className="btn btn-secondary" onClick={addPosition} style={{ marginTop: 8 }}>
          + Position hinzufügen
        </button>

        <div className="form-row" style={{ marginTop: 24 }}>
          {!kleinunternehmer && (
            <div className="form-group">
              <label>USt-Satz (%)</label>
              <select
                className="form-control"
                value={rechnungData.ustSatz}
                onChange={e => setRechnungData(prev => ({ ...prev, ustSatz: parseInt(e.target.value) }))}
              >
                <option value={19}>19%</option>
                <option value={7}>7%</option>
                <option value={0}>0%</option>
              </select>
            </div>
          )}
          <div className="form-group">
            <label>Zahlungsziel (Tage)</label>
            <input
              type="number"
              className="form-control"
              value={rechnungData.zahlungsziel}
              onChange={e => setRechnungData(prev => ({ ...prev, zahlungsziel: parseInt(e.target.value) || 14 }))}
              min="1"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Freitext (optional)</label>
          <textarea
            className="form-control"
            value={rechnungData.freitext}
            onChange={e => setRechnungData(prev => ({ ...prev, freitext: e.target.value }))}
            rows={2}
            placeholder="Zusätzlicher Text auf der Rechnung..."
          />
        </div>

        {/* Zusammenfassung */}
        <div style={{ background: 'var(--gray-100)', padding: 16, borderRadius: 'var(--radius)', marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>
            <span>Bruttobetrag:</span>
            <span>{bruttoGesamt.toFixed(2)} EUR</span>
          </div>
          {!kleinunternehmer && rechnungData.ustSatz > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'var(--gray-600)', fontSize: 14 }}>
                <span>darin enth. USt ({rechnungData.ustSatz}%):</span>
                <span>{ustBetrag.toFixed(2)} EUR</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--gray-600)', fontSize: 14 }}>
                <span>Nettobetrag:</span>
                <span>{nettoGesamt.toFixed(2)} EUR</span>
              </div>
            </>
          )}
        </div>

        {/* Option: Als offener Posten speichern */}
        <div className="form-group" style={{ marginTop: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={rechnungData.alsOffenPostenSpeichern}
              onChange={e => setRechnungData(prev => ({ ...prev, alsOffenPostenSpeichern: e.target.checked }))}
            />
            Als offenen Posten speichern (erscheint in der Abrechnung)
          </label>
        </div>

        {/* Vorschau Button */}
        <div style={{ marginTop: 16 }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              if (!emailText) setEmailText(generateEmailText())
              if (!showPreview && !editedHtmlContent) {
                // Beim ersten Öffnen: HTML initialisieren
                setEditedHtmlContent(generatePdfHtml().replace(/<html>|<\/html>|<head>[\s\S]*?<\/head>|<body[^>]*>|<\/body>/gi, ''))
              }
              setShowPreview(!showPreview)
            }}
            style={{ width: '100%' }}
          >
            {showPreview ? 'Vorschau ausblenden' : 'Vorschau anzeigen'}
          </button>
        </div>

        {/* Vorschau-Bereich */}
        {showPreview && (
          <div style={{ marginTop: 16, border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            {/* E-Mail-Text bearbeitbar */}
            <div style={{ padding: 16, borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14 }}>E-Mail-Text (bearbeitbar)</h4>
              <textarea
                className="form-control"
                value={emailText || generateEmailText()}
                onChange={e => setEmailText(e.target.value)}
                rows={8}
                style={{ fontFamily: 'monospace', fontSize: 13 }}
              />
            </div>

            {/* Rechnungs-Vorschau (bearbeitbar) */}
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: 14 }}>Rechnungs-Vorschau (bearbeitbar)</h4>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => {
                    setEditedHtmlContent(generatePdfHtml().replace(/<html>|<\/html>|<head>[\s\S]*?<\/head>|<body[^>]*>|<\/body>/gi, ''))
                    if (previewRef.current) {
                      previewRef.current.innerHTML = generatePdfHtml().replace(/<html>|<\/html>|<head>[\s\S]*?<\/head>|<body[^>]*>|<\/body>/gi, '')
                    }
                  }}
                  title="Vorschau mit aktuellen Formulardaten neu generieren"
                >
                  ↻ Neu generieren
                </button>
              </div>
              <div
                ref={previewRef}
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => {
                  setEditedHtmlContent(e.currentTarget.innerHTML)
                }}
                style={{
                  background: 'white',
                  border: '1px solid var(--gray-200)',
                  borderRadius: 4,
                  padding: 20,
                  fontSize: 11,
                  maxHeight: 400,
                  overflow: 'auto',
                  cursor: 'text',
                  outline: 'none'
                }}
                dangerouslySetInnerHTML={{ __html: editedHtmlContent || generatePdfHtml().replace(/<html>|<\/html>|<head>[\s\S]*?<\/head>|<body[^>]*>|<\/body>/gi, '') }}
              />
              <p style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 8, marginBottom: 0 }}>
                Klicken Sie in die Vorschau, um Text direkt zu bearbeiten. Änderungen werden beim PDF-Export übernommen.
              </p>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <button
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={onClose}
          >
            Abbrechen
          </button>

          <button
              className="btn btn-success"
              style={{ flex: 1 }}
              onClick={sendEmail}
              disabled={saving || sendingEmail || !rechnungData.empfaengerName || rechnungData.positionen.every(p => p.einzelpreis === 0)}
          >
              {sendingEmail ? 'Sende...' : 'Speichern & Email'}
          </button>

          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={generateAndSavePDF}
            disabled={saving || sendingEmail || !rechnungData.empfaengerName || rechnungData.positionen.every(p => p.einzelpreis === 0)}
          >
            {rechnungData.alsOffenPostenSpeichern ? 'Speichern & PDF' : 'PDF erstellen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ ABRECHNUNG TRAINER VIEW ============
function AbrechnungTrainerView({
  trainings,
  trainer,
}: {
  trainings: Training[]
  trainer: Trainer[]
  onUpdate: () => void
  userId: string
}) {
  const [selectedMonth, setSelectedMonth] = useState(getMonthString(new Date()))

  const trainerSummary = useMemo(() => {
    const monthTrainings = trainings.filter((t) => {
      const tMonth = t.datum.substring(0, 7)
      return tMonth === selectedMonth && t.status === 'durchgefuehrt'
    })

    return trainer.map((tr) => {
      // Filter trainings for this trainer
      const trainerTrainings = monthTrainings.filter((t) => t.trainer_id === tr.id)
      
      // Calculate total hours
      const totalStunden = trainerTrainings.reduce((sum, t) => {
        return sum + calculateDuration(t.uhrzeit_von, t.uhrzeit_bis)
      }, 0)

      const summe = totalStunden * tr.stundensatz

      return {
        trainer: tr,
        trainings: trainerTrainings,
        stunden: totalStunden,
        summe
      }
    })
  }, [trainings, trainer, selectedMonth])

  const totalStats = useMemo(() => {
    const totalStunden = trainerSummary.reduce((sum, s) => sum + s.stunden, 0)
    const totalSumme = trainerSummary.reduce((sum, s) => sum + s.summe, 0)
    return { totalStunden, totalSumme }
  }, [trainerSummary])

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Gesamtstunden</div>
          <div className="stat-value">{totalStats.totalStunden.toFixed(1)} h</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Gesamtkosten</div>
          <div className="stat-value">{totalStats.totalSumme.toFixed(2)} €</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Trainer-Abrechnung</h3>
          <input
            type="month"
            className="form-control"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ width: 'auto' }}
          />
        </div>

        {/* Desktop Table */}
        <div className="table-container desktop-table">
          <table>
            <thead>
              <tr>
                <th>Trainer</th>
                <th>Stundensatz</th>
                <th>Trainings</th>
                <th>Stunden</th>
                <th>Summe</th>
              </tr>
            </thead>
            <tbody>
              {trainerSummary.map((item) => (
                <tr key={item.trainer.id}>
                  <td>{item.trainer.name}</td>
                  <td>{item.trainer.stundensatz} €/h</td>
                  <td>{item.trainings.length}</td>
                  <td>{item.stunden.toFixed(1)} h</td>
                  <td><strong>{item.summe.toFixed(2)} €</strong></td>
                </tr>
              ))}
              {trainerSummary.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-state">
                    Keine Trainer vorhanden
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 'bold', background: 'var(--gray-100)' }}>
                <td colSpan={3}>Gesamt</td>
                <td>{totalStats.totalStunden.toFixed(1)} h</td>
                <td>{totalStats.totalSumme.toFixed(2)} €</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile Card List */}
        <div className="mobile-card-list">
          {trainerSummary.map((item) => (
            <div key={item.trainer.id} className="mobile-card">
              <div className="mobile-card-header">
                <div className="mobile-card-title">{item.trainer.name}</div>
                <div className="mobile-card-subtitle">{item.trainer.stundensatz} €/h</div>
              </div>
              <div className="mobile-card-body">
                <div className="mobile-card-row">
                  <span className="mobile-card-label">Trainings</span>
                  <span className="mobile-card-value">{item.trainings.length}</span>
                </div>
                <div className="mobile-card-row">
                  <span className="mobile-card-label">Stunden</span>
                  <span className="mobile-card-value">{item.stunden.toFixed(1)} h</span>
                </div>
                <div className="mobile-card-row">
                  <span className="mobile-card-label">Summe</span>
                  <span className="mobile-card-value" style={{ fontWeight: 600 }}>
                    {item.summe.toFixed(2)} €
                  </span>
                </div>
              </div>
            </div>
          ))}
          {trainerSummary.length === 0 && (
            <div className="empty-state">Keine Trainer vorhanden</div>
          )}
          {/* Mobile Total Card */}
          {trainerSummary.length > 0 && (
            <div className="mobile-card" style={{ background: 'var(--gray-100)' }}>
              <div className="mobile-card-header">
                <div className="mobile-card-title">Gesamt</div>
              </div>
              <div className="mobile-card-body">
                <div className="mobile-card-row">
                  <span className="mobile-card-label">Stunden</span>
                  <span className="mobile-card-value" style={{ fontWeight: 600 }}>
                    {totalStats.totalStunden.toFixed(1)} h
                  </span>
                </div>
                <div className="mobile-card-row">
                  <span className="mobile-card-label">Summe</span>
                  <span className="mobile-card-value" style={{ fontWeight: 600 }}>
                    {totalStats.totalSumme.toFixed(2)} €
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>
          <strong>Hinweis:</strong> Um Trainings einem Trainer zuzuordnen, müssen Sie bei der Trainingserfassung den Trainer auswählen.
        </p>
      </div>
    </div>
  )
}

// ============ PLANUNG VIEW ============
function PlanungView({
  planungSheets,
  onUpdate,
  userId
}: {
  planungSheets: PlanungSheet[]
  trainings: Training[]
  spieler: Spieler[]
  onUpdate: () => void
  userId: string
}) {
  const [activeSheetId, setActiveSheetId] = useState<string | null>(
    planungSheets.find((s) => s.is_active)?.id || planungSheets[0]?.id || null
  )
  const [editingCell, setEditingCell] = useState<{ zeit: string; tag: number } | null>(null)
  const [cellValue, setCellValue] = useState('')

  const activeSheet = planungSheets.find((s) => s.id === activeSheetId)

  const defaultData: PlanungData = {
    zeitslots: ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
    tage: {}
  }

  const sheetData = activeSheet?.data || defaultData

  const createNewSheet = async () => {
    const name = prompt('Name für neuen Plan:')
    if (!name) return

    const { data } = await supabase.from('planung_sheets').insert({
      user_id: userId,
      name,
      data: defaultData,
      is_active: false
    }).select().single()

    if (data) {
      onUpdate()
      setActiveSheetId(data.id)
    }
  }

  const deleteSheet = async (id: string) => {
    if (planungSheets.length <= 1) {
      alert('Der letzte Plan kann nicht gelöscht werden')
      return
    }
    const confirmed = await showConfirm('Plan löschen', 'Plan wirklich löschen?')
    if (!confirmed) return

    await supabase.from('planung_sheets').delete().eq('id', id)
    onUpdate()
  }

  const updateCell = async (zeit: string, tag: number, value: string) => {
    if (!activeSheet) return

    const newData = { ...sheetData }
    if (!newData.tage[tag]) newData.tage[tag] = {}
    newData.tage[tag][zeit] = value.split('\n')

    await supabase
      .from('planung_sheets')
      .update({ data: newData })
      .eq('id', activeSheet.id)

    onUpdate()
  }

  const getCellContent = (zeit: string, tag: number): string[] => {
    return sheetData.tage?.[tag]?.[zeit] || []
  }

  const handleCellClick = (zeit: string, tag: number) => {
    setEditingCell({ zeit, tag })
    setCellValue(getCellContent(zeit, tag).join('\n'))
  }

  const handleCellSave = () => {
    if (editingCell) {
      updateCell(editingCell.zeit, editingCell.tag, cellValue)
      setEditingCell(null)
    }
  }

  if (planungSheets.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <p>Noch keine Pläne erstellt</p>
          <button className="btn btn-primary" onClick={createNewSheet} style={{ marginTop: 16 }}>
            + Ersten Plan erstellen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="sheet-tabs">
        {planungSheets.map((sheet) => (
          <div
            key={sheet.id}
            className={`sheet-tab ${sheet.id === activeSheetId ? 'active' : ''}`}
            onClick={() => setActiveSheetId(sheet.id)}
          >
            <span>{sheet.name}</span>
            {planungSheets.length > 1 && (
              <button
                className="sheet-tab-delete"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteSheet(sheet.id)
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button className="sheet-tab" onClick={createNewSheet}>
          + Neu
        </button>
      </div>

      <div className="card">
        <div className="swipe-hint mobile-only"></div>
        <div className="planung-scroll-container">
          <div className="planung-grid">
            {/* Header */}
            <div className="planung-cell planung-header">Zeit</div>
            {WOCHENTAGE.map((tag) => (
              <div key={tag} className="planung-cell planung-header">{tag}</div>
            ))}

          {/* Rows */}
          {sheetData.zeitslots.map((zeit) => (
            <>
              <div key={`time-${zeit}`} className="planung-cell planung-time">{zeit}</div>
              {WOCHENTAGE.map((_, tagIndex) => {
                const content = getCellContent(zeit, tagIndex)
                const isEditing = editingCell?.zeit === zeit && editingCell?.tag === tagIndex

                return (
                  <div
                    key={`cell-${zeit}-${tagIndex}`}
                    className="planung-cell planung-content"
                    onClick={() => handleCellClick(zeit, tagIndex)}
                  >
                    {isEditing ? (
                      <textarea
                        autoFocus
                        value={cellValue}
                        onChange={(e) => setCellValue(e.target.value)}
                        onBlur={handleCellSave}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingCell(null)
                        }}
                        style={{
                          width: '100%',
                          height: '100%',
                          border: 'none',
                          resize: 'none',
                          fontSize: 12
                        }}
                      />
                    ) : (
                      content.map((line, i) => (
                        <div key={i}>• {line}</div>
                      ))
                    )}
                  </div>
                )
              })}
            </>
          ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ WEITERES VIEW ============
function WeiteresView({
  profile,
  notizen,
  pdfVorlagen,
  onUpdate,
  userId,
  onNavigate
}: {
  profile: TrainerProfile | null
  notizen: Notiz[]
  pdfVorlagen: PdfVorlage[]
  onUpdate: () => void
  userId: string
  onNavigate: (tab: Tab) => void
}) {
  const [activeSubTab, setActiveSubTab] = useState<'profil' | 'notizen' | 'pdf-vorlagen'>('profil')
  const [showNotizModal, setShowNotizModal] = useState(false)
  const [editingNotiz, setEditingNotiz] = useState<Notiz | null>(null)
  const [showPdfVorlageModal, setShowPdfVorlageModal] = useState(false)
  const [editingPdfVorlage, setEditingPdfVorlage] = useState<PdfVorlage | null>(null)
  const [showRechtlichesModal, setShowRechtlichesModal] = useState<'impressum' | 'datenschutz' | null>(null)

  // Profile form
  const [name, setName] = useState(profile?.name || '')
  const [nachname, setNachname] = useState(profile?.nachname || '')
  const [adresse, setAdresse] = useState(profile?.adresse || '')
  const [iban, setIban] = useState(profile?.iban || '')
  const [ustIdNr, setUstIdNr] = useState(profile?.ust_id_nr || '')
  const [kleinunternehmer, setKleinunternehmer] = useState(profile?.kleinunternehmer || false)
  const [finanzamt, setFinanzamt] = useState(profile?.finanzamt || '')
  const [steuernummer, setSteuernummer] = useState(profile?.steuernummer || '')
  const [notiz, setNotiz] = useState(profile?.notiz || '')
  const [saving, setSaving] = useState(false)

  // SMTP Einstellungen
  const [smtpHost, setSmtpHost] = useState(profile?.smtp_host || '')
  const [smtpPort, setSmtpPort] = useState(profile?.smtp_port || 587)
  const [smtpUser, setSmtpUser] = useState(profile?.smtp_user || '')
  const [smtpPass, setSmtpPass] = useState(profile?.smtp_pass || '')
  const [smtpFromEmail, setSmtpFromEmail] = useState(profile?.smtp_from_email || '')
  const [smtpFromName, setSmtpFromName] = useState(profile?.smtp_from_name || '')
  const [smtpSecure, setSmtpSecure] = useState(profile?.smtp_secure ?? true)
  const [testingSmtp, setTestingSmtp] = useState(false)

  const testSmtpConnection = async () => {
    if (!smtpHost || !smtpUser || !smtpPass) {
      alert('Bitte fülle zuerst Host, Benutzer und Passwort aus.')
      return
    }
    setTestingSmtp(true)
    try {
      const response = await fetch('/api/send-invoice-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtp: {
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            user: smtpUser,
            pass: smtpPass,
            fromEmail: smtpFromEmail || smtpUser,
            fromName: smtpFromName || name
          },
          to: smtpFromEmail || smtpUser,
          subject: 'SMTP Test - Tennis Trainer Planner',
          text: 'Dies ist eine Test-E-Mail. Wenn du diese E-Mail erhältst, funktioniert deine SMTP-Konfiguration!'
        })
      })
      const result = await response.json()
      if (response.ok) {
        alert('Test-E-Mail erfolgreich gesendet! Prüfe deinen Posteingang.')
      } else {
        alert('Fehler: ' + result.error)
      }
    } catch (err) {
      console.error('SMTP Test Fehler:', err)
      alert('Verbindungsfehler beim Test')
    } finally {
      setTestingSmtp(false)
    }
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      const data = {
        name,
        nachname: nachname || null,
        adresse: adresse || null,
        iban: iban || null,
        ust_id_nr: ustIdNr || null,
        kleinunternehmer,
        finanzamt: finanzamt || null,
        steuernummer: steuernummer || null,
        notiz: notiz || null,
        smtp_host: smtpHost || null,
        smtp_port: smtpPort || 587,
        smtp_user: smtpUser || null,
        smtp_pass: smtpPass || null,
        smtp_from_email: smtpFromEmail || null,
        smtp_from_name: smtpFromName || null,
        smtp_secure: smtpSecure,
        updated_at: new Date().toISOString()
      }

      if (profile) {
        await supabase.from('trainer_profiles').update(data).eq('id', profile.id)
      } else {
        await supabase.from('trainer_profiles').insert({ ...data, user_id: userId })
      }

      onUpdate()
      alert('Profil gespeichert!')
    } catch (err) {
      console.error('Error saving profile:', err)
      alert('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Quick Links für Mobile */}
      <div className="quick-links-grid">
        <button className="quick-link-card" onClick={() => onNavigate('formulare')}>
          <span className="quick-link-icon">📝</span>
          <span className="quick-link-label">Formulare</span>
        </button>
        <button className="quick-link-card" onClick={() => onNavigate('planung')}>
          <span className="quick-link-icon">📋</span>
          <span className="quick-link-label">Planung</span>
        </button>
        <button className="quick-link-card" onClick={() => onNavigate('abrechnung-trainer')}>
          <span className="quick-link-icon">👨‍🏫</span>
          <span className="quick-link-label">Trainer-Abr.</span>
        </button>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeSubTab === 'profil' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('profil')}
        >
          Mein Profil
        </button>
        <button
          className={`tab ${activeSubTab === 'notizen' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('notizen')}
        >
          Notizen ({notizen.length})
        </button>
        <button
          className={`tab ${activeSubTab === 'pdf-vorlagen' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('pdf-vorlagen')}
        >
          PDF-Vorlagen ({pdfVorlagen.length})
        </button>
      </div>

      {activeSubTab === 'profil' && (
        <div className="card">
          <div className="card-header">
            <h3>Mein Profil</h3>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Nachname</label>
              <input
                type="text"
                className="form-control"
                value={nachname}
                onChange={(e) => setNachname(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Adresse (für Rechnungen)</label>
            <textarea
              className="form-control"
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              rows={3}
              placeholder="Straße, PLZ Ort"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>IBAN</label>
              <input
                type="text"
                className="form-control"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                placeholder="DE..."
              />
            </div>
            <div className="form-group">
              <label>USt-IdNr (optional)</label>
              <input
                type="text"
                className="form-control"
                value={ustIdNr}
                onChange={(e) => setUstIdNr(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <label className="checkbox-group" style={{ marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={kleinunternehmer}
                onChange={(e) => setKleinunternehmer(e.target.checked)}
              />
              Kleinunternehmer (§19 UStG)
            </label>
          </div>

          {!kleinunternehmer && (
            <>
              <h4 style={{ margin: '24px 0 12px', color: 'var(--gray-700)' }}>USt-Voranmeldung</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Finanzamt</label>
                  <input
                    type="text"
                    className="form-control"
                    value={finanzamt}
                    onChange={(e) => setFinanzamt(e.target.value)}
                    placeholder="z.B. Finanzamt Potsdam"
                  />
                </div>
                <div className="form-group">
                  <label>Steuernummer</label>
                  <input
                    type="text"
                    className="form-control"
                    value={steuernummer}
                    onChange={(e) => setSteuernummer(e.target.value)}
                    placeholder="z.B. 3046023501421"
                  />
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label>Eigene Notiz</label>
            <textarea
              className="form-control"
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              rows={3}
              placeholder="Persönliche Notizen..."
            />
          </div>

          <h4 style={{ margin: '24px 0 12px', color: 'var(--gray-700)' }}>E-Mail-Versand (SMTP)</h4>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
            Konfiguriere deinen SMTP-Server um Rechnungen direkt per E-Mail versenden zu können.
          </p>

          <div className="form-row">
            <div className="form-group">
              <label>SMTP-Server</label>
              <input
                type="text"
                className="form-control"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="z.B. smtp.gmail.com"
              />
            </div>
            <div className="form-group" style={{ maxWidth: 120 }}>
              <label>Port</label>
              <input
                type="number"
                className="form-control"
                value={smtpPort}
                onChange={(e) => setSmtpPort(parseInt(e.target.value) || 587)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Benutzername</label>
              <input
                type="text"
                className="form-control"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="E-Mail oder Benutzername"
              />
            </div>
            <div className="form-group">
              <label>Passwort</label>
              <input
                type="password"
                className="form-control"
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                placeholder="SMTP-Passwort"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Absender E-Mail</label>
              <input
                type="email"
                className="form-control"
                value={smtpFromEmail}
                onChange={(e) => setSmtpFromEmail(e.target.value)}
                placeholder="deine@email.de"
              />
            </div>
            <div className="form-group">
              <label>Absender Name</label>
              <input
                type="text"
                className="form-control"
                value={smtpFromName}
                onChange={(e) => setSmtpFromName(e.target.value)}
                placeholder="z.B. Max Mustermann Tennis"
              />
            </div>
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <label className="checkbox-group" style={{ marginBottom: 0 }}>
              <input
                type="checkbox"
                checked={smtpSecure}
                onChange={(e) => setSmtpSecure(e.target.checked)}
              />
              SSL/TLS verwenden
            </label>
            <button
              className="btn btn-secondary btn-sm"
              onClick={testSmtpConnection}
              disabled={testingSmtp || !smtpHost}
            >
              {testingSmtp ? 'Teste...' : 'Verbindung testen'}
            </button>
          </div>

          <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
            {saving ? 'Speichere...' : 'Profil speichern'}
          </button>
        </div>
      )}

      {activeSubTab === 'notizen' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowNotizModal(true)}>
              + Neue Notiz
            </button>
          </div>

          {notizen.length === 0 ? (
            <div className="card">
              <div className="empty-state">Noch keine Notizen erstellt</div>
            </div>
          ) : (
            notizen.map((n) => (
              <div key={n.id} className="note-card">
                <div className="note-card-header">
                  <span className="note-title">{n.titel}</span>
                  <span className="note-date">{formatDateGerman(n.erstellt_am)}</span>
                </div>
                {n.inhalt && <div className="note-content">{n.inhalt}</div>}
                <div className="note-actions">
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      setEditingNotiz(n)
                      setShowNotizModal(true)
                    }}
                  >
                    Bearbeiten
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showNotizModal && (
        <NotizModal
          notiz={editingNotiz}
          userId={userId}
          onClose={() => {
            setShowNotizModal(false)
            setEditingNotiz(null)
          }}
          onSave={() => {
            setShowNotizModal(false)
            setEditingNotiz(null)
            onUpdate()
          }}
        />
      )}

      {activeSubTab === 'pdf-vorlagen' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowPdfVorlageModal(true)}>
              + Neue PDF-Vorlage
            </button>
          </div>

          {/* Standard PDF-Vorlage (immer sichtbar) */}
          <div className="card" style={{ marginBottom: 12, border: '2px solid var(--success)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong>Standard PDF-Vorlage</strong>
                <span style={{ fontSize: 10, background: 'var(--success)', color: 'white', padding: '2px 6px', borderRadius: 4 }}>
                  System
                </span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
              Das integrierte PDF-Layout mit professioneller Tabelle, Rechnungssteller/-empfänger,
              allen Positionen und Summen. Diese Vorlage wird verwendet, wenn keine eigene ausgewählt ist.
            </div>
          </div>

          {/* Eigene PDF-Vorlagen */}
          {pdfVorlagen.length > 0 && (
            <div style={{ marginTop: 16, marginBottom: 8, fontWeight: 500, color: 'var(--gray-600)' }}>
              Eigene PDF-Vorlagen:
            </div>
          )}
          {pdfVorlagen.map((v) => (
            <div key={v.id} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong>{v.name}</strong>
                  {v.ist_standard && (
                    <span style={{ fontSize: 10, background: 'var(--primary)', color: 'white', padding: '2px 6px', borderRadius: 4 }}>
                      Bevorzugt
                    </span>
                  )}
                </div>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => {
                    setEditingPdfVorlage(v)
                    setShowPdfVorlageModal(true)
                  }}
                >
                  Bearbeiten
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4, whiteSpace: 'pre-wrap', maxHeight: 100, overflow: 'hidden', fontFamily: 'monospace' }}>
                {v.inhalt.substring(0, 300)}{v.inhalt.length > 300 ? '...' : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {showPdfVorlageModal && (
        <PdfVorlageModal
          vorlage={editingPdfVorlage}
          vorlagen={pdfVorlagen}
          userId={userId}
          onClose={() => {
            setShowPdfVorlageModal(false)
            setEditingPdfVorlage(null)
          }}
          onSave={() => {
            setShowPdfVorlageModal(false)
            setEditingPdfVorlage(null)
            onUpdate()
          }}
        />
      )}

      {/* Rechtliches Section */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h3>Rechtliches</h3>
        </div>
        <p style={{ color: 'var(--gray-600)', marginBottom: 16, fontSize: 14 }}>
          Impressum und Datenschutzerklärung für deine öffentlichen Formulare
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => setShowRechtlichesModal('impressum')}>
            📋 Impressum anzeigen
          </button>
          <button className="btn" onClick={() => setShowRechtlichesModal('datenschutz')}>
            🔒 Datenschutz anzeigen
          </button>
        </div>
      </div>

      {/* Rechtliches Modal */}
      {showRechtlichesModal && (
        <div className="modal-overlay" onClick={() => setShowRechtlichesModal(null)}>
          <div className="modal modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{showRechtlichesModal === 'impressum' ? 'Impressum' : 'Datenschutzerklärung'}</h3>
              <button className="modal-close" onClick={() => setShowRechtlichesModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflow: 'auto' }}>
              {showRechtlichesModal === 'impressum' ? (
                <div className="rechtliches-content">
                  <h4>Angaben gemäß § 5 TMG</h4>
                  <p>
                    <strong>{profile?.name || '[Name]'} {profile?.nachname || ''}</strong><br />
                    {profile?.adresse ? profile.adresse.split('\n').map((line, i) => <span key={i}>{line}<br /></span>) : '[Adresse]'}
                  </p>

                  <h4>Kontakt</h4>
                  <p>E-Mail: [Ihre E-Mail-Adresse]</p>

                  {profile?.steuernummer && (
                    <>
                      <h4>Steuernummer</h4>
                      <p>{profile?.steuernummer}</p>
                    </>
                  )}

                  {profile?.ust_id_nr && (
                    <>
                      <h4>Umsatzsteuer-ID</h4>
                      <p>Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz: {profile.ust_id_nr}</p>
                    </>
                  )}

                  <h4>Verantwortlich für den Inhalt</h4>
                  <p>{profile?.name || '[Name]'} {profile?.nachname || ''}</p>

                  <div style={{ marginTop: 24, padding: 16, background: 'var(--warning-light)', borderRadius: 8 }}>
                    <strong>Hinweis:</strong> Bitte ergänze die fehlenden Angaben (E-Mail, ggf. Telefon) in deinem Impressum.
                    Die Daten werden automatisch aus deinem Profil übernommen.
                  </div>
                </div>
              ) : (
                <div className="rechtliches-content">
                  <h4>1. Datenschutz auf einen Blick</h4>
                  <p><strong>Allgemeine Hinweise</strong></p>
                  <p>
                    Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen
                    Daten passiert, wenn Sie diese Website nutzen. Personenbezogene Daten sind alle Daten, mit denen
                    Sie persönlich identifiziert werden können.
                  </p>

                  <h4>2. Verantwortliche Stelle</h4>
                  <p>
                    <strong>{profile?.name || '[Name]'} {profile?.nachname || ''}</strong><br />
                    {profile?.adresse ? profile.adresse.split('\n').map((line, i) => <span key={i}>{line}<br /></span>) : '[Adresse]'}
                  </p>

                  <h4>3. Datenerfassung bei Formular-Anmeldungen</h4>
                  <p><strong>Welche Daten werden erfasst?</strong></p>
                  <p>
                    Bei der Nutzung unserer Anmeldeformulare werden die von Ihnen eingegebenen Daten erfasst.
                    Dies können sein: Name, E-Mail-Adresse, Telefonnummer und weitere von Ihnen angegebene Informationen.
                  </p>
                  <p><strong>Wofür werden die Daten genutzt?</strong></p>
                  <p>
                    Die Daten werden ausschließlich zur Bearbeitung Ihrer Anmeldung und zur Kommunikation
                    bezüglich der Veranstaltung/des Trainings verwendet.
                  </p>
                  <p><strong>Rechtsgrundlage</strong></p>
                  <p>
                    Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)
                    sowie Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).
                  </p>

                  <h4>4. Hosting</h4>
                  <p>
                    Diese Website wird bei externen Dienstleistern gehostet (Vercel, Supabase).
                    Die personenbezogenen Daten, die auf dieser Website erfasst werden, werden auf den
                    Servern dieser Anbieter gespeichert.
                  </p>

                  <h4>5. Ihre Rechte</h4>
                  <p>Sie haben jederzeit das Recht:</p>
                  <ul style={{ marginLeft: 20, marginBottom: 16 }}>
                    <li>Auskunft über Ihre gespeicherten Daten zu erhalten</li>
                    <li>Berichtigung unrichtiger Daten zu verlangen</li>
                    <li>Löschung Ihrer Daten zu verlangen</li>
                    <li>Die Einschränkung der Verarbeitung zu verlangen</li>
                    <li>Der Verarbeitung zu widersprechen</li>
                    <li>Ihre Daten in einem übertragbaren Format zu erhalten</li>
                  </ul>

                  <h4>6. Cookies</h4>
                  <p>
                    Diese Website verwendet nur technisch notwendige Cookies für die Authentifizierung.
                    Es werden keine Tracking- oder Analyse-Cookies verwendet.
                  </p>

                  <div style={{ marginTop: 24, padding: 16, background: 'var(--warning-light)', borderRadius: 8 }}>
                    <strong>Hinweis:</strong> Dies ist eine Vorlage. Bitte prüfe und passe den Text an deine
                    spezifischen Anforderungen an. Bei Unsicherheit konsultiere einen Rechtsanwalt.
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowRechtlichesModal(null)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ PDF VORLAGE MODAL ============
function PdfVorlageModal({
  vorlage,
  vorlagen,
  userId,
  onClose,
  onSave
}: {
  vorlage: PdfVorlage | null
  vorlagen: PdfVorlage[]
  userId: string
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState(vorlage?.name || '')
  const [inhalt, setInhalt] = useState(vorlage?.inhalt || getDefaultPdfVorlage())
  const [istStandard, setIstStandard] = useState(vorlage?.ist_standard || vorlagen.length === 0)
  const [saving, setSaving] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [showAiHelper, setShowAiHelper] = useState(!vorlage) // Bei neuer Vorlage standardmäßig anzeigen

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Name ist erforderlich')
      return
    }

    setSaving(true)
    try {
      // Wenn diese Vorlage Standard wird, andere auf nicht-Standard setzen
      if (istStandard) {
        await supabase.from('pdf_vorlagen')
          .update({ ist_standard: false })
          .eq('user_id', userId)
      }

      if (vorlage) {
        await supabase.from('pdf_vorlagen').update({
          name: name.trim(),
          inhalt: inhalt,
          ist_standard: istStandard
        }).eq('id', vorlage.id)
      } else {
        await supabase.from('pdf_vorlagen').insert({
          user_id: userId,
          name: name.trim(),
          inhalt: inhalt,
          ist_standard: istStandard
        })
      }
      onSave()
    } catch (err) {
      console.error('Error saving pdf vorlage:', err)
      alert('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!vorlage) return
    const confirmed = await showConfirm('PDF-Vorlage löschen', 'PDF-Vorlage wirklich löschen?')
    if (!confirmed) return

    await supabase.from('pdf_vorlagen').delete().eq('id', vorlage.id)
    onSave()
  }

  const insertPlatzhalter = (key: string) => {
    setInhalt(prev => prev + key)
  }

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) {
      alert('Bitte beschreibe, wie die Vorlage aussehen soll')
      return
    }

    setAiGenerating(true)
    try {
      const { data, error } = await supabase.functions.invoke('generate-pdf-vorlage', {
        body: {
          prompt: aiPrompt,
          currentVorlage: inhalt !== getDefaultPdfVorlage() ? inhalt : null
        }
      })

      if (error) throw error
      if (!data.success) throw new Error(data.error || 'Unbekannter Fehler')

      setInhalt(data.html)
      setShowAiHelper(false)
    } catch (err) {
      console.error('Error generating vorlage:', err)
      alert('Fehler bei der KI-Generierung: ' + (err instanceof Error ? err.message : 'Unbekannt'))
    } finally {
      setAiGenerating(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900 }}>
        <div className="modal-header">
          <h3>{vorlage ? 'PDF-Vorlage bearbeiten' : 'Neue PDF-Vorlage'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Name der Vorlage *</label>
            <input
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Standard-Rechnung, Vereinsrechnung, etc."
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={istStandard}
                onChange={(e) => setIstStandard(e.target.checked)}
              />
              Als Standard-Vorlage verwenden
            </label>
          </div>

          {/* KI-Assistent */}
          <div className="form-group">
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8
            }}>
              <label style={{ margin: 0, fontWeight: 600 }}>
                KI-Assistent
              </label>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowAiHelper(!showAiHelper)}
              >
                {showAiHelper ? 'Ausblenden' : 'Einblenden'}
              </button>
            </div>

            {showAiHelper && (
              <div style={{
                background: 'var(--primary-light)',
                borderRadius: 8,
                padding: 16,
                marginBottom: 16
              }}>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--gray-700)' }}>
                  Beschreibe in eigenen Worten, wie deine Rechnung aussehen soll. Die KI erstellt dann den HTML-Code für dich.
                </p>
                <textarea
                  className="form-control"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={3}
                  placeholder="z.B.: Erstelle eine moderne, minimalistische Rechnung mit Logo-Bereich oben links, Rechnungsdetails rechts, und einem freundlichen Abschlusstext. Die Tabelle soll abgerundete Ecken haben."
                  style={{ marginBottom: 12 }}
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={generateWithAI}
                    disabled={aiGenerating || !aiPrompt.trim()}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    {aiGenerating ? (
                      <>
                        <span className="spinner" style={{ width: 16, height: 16 }} />
                        Generiere...
                      </>
                    ) : (
                      <>
                        <span>🤖</span>
                        Vorlage generieren
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setAiPrompt('Erstelle eine professionelle, klassische Rechnung mit klarer Struktur')}
                  >
                    Klassisch
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setAiPrompt('Erstelle eine moderne, minimalistische Rechnung mit viel Weißraum und klaren Linien')}
                  >
                    Modern
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setAiPrompt('Erstelle eine kompakte Rechnung die wenig Platz braucht und alle wichtigen Infos enthält')}
                  >
                    Kompakt
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Platzhalter */}
          <div className="form-group">
            <label>Platzhalter einfügen:</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {PDF_PLATZHALTER.map(p => (
                <button
                  key={p.key}
                  type="button"
                  className="btn btn-sm"
                  style={{ fontSize: 10, padding: '2px 6px' }}
                  onClick={() => insertPlatzhalter(p.key)}
                  title={p.beschreibung}
                >
                  {p.key}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>HTML-Inhalt *</label>
            <textarea
              className="form-control"
              value={inhalt}
              onChange={(e) => setInhalt(e.target.value)}
              rows={16}
              style={{ fontFamily: 'monospace', fontSize: 11 }}
              placeholder="HTML für das PDF-Layout..."
            />
            <small style={{ color: 'var(--gray-500)', marginTop: 4, display: 'block' }}>
              Die Vorlage wird mit CSS-Styling versehen. Nutze {'{{positionen_tabelle}}'} für die Positions-Tabelle und {'{{summen_block}}'} für den Summenbereich.
            </small>
          </div>
        </div>
        <div className="modal-footer">
          {vorlage && (
            <button className="btn btn-danger" onClick={handleDelete}>
              Löschen
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Speichere...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Standard PDF-Vorlage mit schönem Layout (identisch zur System-Vorlage)
function getDefaultPdfVorlage(): string {
  return `<h1>RECHNUNG</h1>

<div class="flex">
  <div class="section">
    <strong>Rechnungssteller:</strong><br>
    {{trainer_name}}<br>
    {{trainer_adresse_html}}<br>
    Steuernummer: {{steuernummer}}
  </div>
  <div class="section" style="text-align: right;">
    <strong>Rechnungsempfänger:</strong><br>
    {{empfaenger_name}}<br>
    {{empfaenger_adresse_html}}
  </div>
</div>

<div class="section">
  <strong>Rechnungsnummer:</strong> {{rechnungsnummer}}<br>
  <strong>Rechnungsdatum:</strong> {{rechnungsdatum}}<br>
  <strong>Leistungszeitraum:</strong> {{monat}}
</div>

<p>Sehr geehrte Damen und Herren,</p>
<p>für die im Leistungszeitraum erbrachten Trainerstunden erlaube ich mir, folgende Rechnung zu stellen:</p>

{{positionen_tabelle}}

{{summen_block}}

{{kleinunternehmer_hinweis}}

<div class="footer">
  <p>Bitte überweisen Sie den Betrag innerhalb von 14 Tagen auf folgendes Konto:</p>
  <p><strong>IBAN:</strong> {{iban}}<br>
  <strong>Kontoinhaber:</strong> {{trainer_name}}</p>
  <p>Vielen Dank für die Zusammenarbeit.</p>
  <p>Mit freundlichen Grüßen<br>{{trainer_name}}</p>
</div>`
}

// ============ NOTIZ MODAL ============
function NotizModal({
  notiz,
  userId,
  onClose,
  onSave
}: {
  notiz: Notiz | null
  userId: string
  onClose: () => void
  onSave: () => void
}) {
  const [titel, setTitel] = useState(notiz?.titel || '')
  const [inhalt, setInhalt] = useState(notiz?.inhalt || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!titel.trim()) {
      alert('Titel ist erforderlich')
      return
    }

    setSaving(true)
    try {
      if (notiz) {
        await supabase.from('notizen').update({
          titel: titel.trim(),
          inhalt: inhalt || null,
          aktualisiert_am: new Date().toISOString()
        }).eq('id', notiz.id)
      } else {
        await supabase.from('notizen').insert({
          user_id: userId,
          titel: titel.trim(),
          inhalt: inhalt || null
        })
      }
      onSave()
    } catch (err) {
      console.error('Error saving notiz:', err)
      alert('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!notiz) return
    const confirmed = await showConfirm('Notiz löschen', 'Notiz wirklich löschen?')
    if (!confirmed) return

    await supabase.from('notizen').delete().eq('id', notiz.id)
    onSave()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{notiz ? 'Notiz bearbeiten' : 'Neue Notiz'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Titel *</label>
            <input
              type="text"
              className="form-control"
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="Titel der Notiz"
            />
          </div>
          <div className="form-group">
            <label>Inhalt</label>
            <textarea
              className="form-control"
              value={inhalt}
              onChange={(e) => setInhalt(e.target.value)}
              rows={6}
              placeholder="Notiz-Inhalt..."
            />
          </div>
        </div>
        <div className="modal-footer">
          {notiz && (
            <button className="btn btn-danger" onClick={handleDelete}>
              Löschen
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Speichere...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ PUBLIC FORMULAR VIEW (öffentlich ohne Login) ============
function PublicFormularView({ formularId }: { formularId: string }) {
  const [formular, setFormular] = useState<Formular | null>(null)
  const [trainerProfile, setTrainerProfile] = useState<TrainerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState<Record<string, string | boolean | number>>({})
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [showLegal, setShowLegal] = useState<'impressum' | 'datenschutz' | null>(null)

  useEffect(() => {
    loadFormular()
  }, [formularId])

  const loadFormular = async () => {
    try {
      const { data, error } = await supabase
        .from('formulare')
        .select('*')
        .eq('id', formularId)
        .eq('ist_aktiv', true)
        .single()

      if (error || !data) {
        setError('Formular nicht gefunden oder nicht mehr aktiv.')
        setLoading(false)
        return
      }

      // Prüfe Anmeldeschluss
      if (data.anmeldeschluss && new Date(data.anmeldeschluss) < new Date()) {
        setError('Der Anmeldeschluss für dieses Event ist bereits vorbei.')
        setLoading(false)
        return
      }

      // Prüfe max Anmeldungen
      if (data.max_anmeldungen) {
        const { count } = await supabase
          .from('formular_anmeldungen')
          .select('*', { count: 'exact', head: true })
          .eq('formular_id', formularId)

        if (count && count >= data.max_anmeldungen) {
          setError('Die maximale Teilnehmerzahl ist bereits erreicht.')
          setLoading(false)
          return
        }
      }

      setFormular(data)

      // Lade Trainer-Profil für Impressum/Datenschutz
      const { data: profileData } = await supabase
        .from('trainer_profiles')
        .select('*')
        .eq('user_id', data.user_id)
        .single()

      if (profileData) {
        setTrainerProfile(profileData)
      }

      // Initialisiere formData mit leeren Werten
      const initial: Record<string, string | boolean | number> = {}
      data.felder.forEach((f: FormularFeld) => {
        initial[f.id] = f.typ === 'checkbox' ? false : ''
      })
      setFormData(initial)
    } catch (err) {
      setError('Ein Fehler ist aufgetreten.')
    } finally {
      setLoading(false)
    }
  }

  const validate = (): boolean => {
    if (!formular) return false
    const errors: Record<string, string> = {}

    formular.felder.forEach((feld) => {
      if (feld.pflichtfeld) {
        const value = formData[feld.id]
        if (value === '' || value === undefined || value === null) {
          errors[feld.id] = 'Dieses Feld ist erforderlich'
        }
      }

      // Email-Validierung
      if (feld.typ === 'email' && formData[feld.id]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(formData[feld.id] as string)) {
          errors[feld.id] = 'Bitte geben Sie eine gültige E-Mail-Adresse ein'
        }
      }
    })

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('formular_anmeldungen')
        .insert({
          formular_id: formularId,
          daten: formData,
          gelesen: false,
          email_versendet: false
        })

      if (error) throw error

      setSubmitted(true)
    } catch (err) {
      setError('Ein Fehler ist beim Absenden aufgetreten. Bitte versuchen Sie es erneut.')
    } finally {
      setSubmitting(false)
    }
  }

  const renderField = (feld: FormularFeld) => {
    const error = validationErrors[feld.id]

    switch (feld.typ) {
      case 'text':
      case 'email':
      case 'telefon':
        return (
          <input
            type={feld.typ === 'email' ? 'email' : feld.typ === 'telefon' ? 'tel' : 'text'}
            value={formData[feld.id] as string || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, [feld.id]: e.target.value }))}
            placeholder={feld.placeholder || ''}
            className={error ? 'input-error' : ''}
          />
        )
      case 'number':
        return (
          <input
            type="number"
            value={formData[feld.id] as number || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, [feld.id]: e.target.value }))}
            placeholder={feld.placeholder || ''}
            className={error ? 'input-error' : ''}
          />
        )
      case 'textarea':
        return (
          <textarea
            value={formData[feld.id] as string || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, [feld.id]: e.target.value }))}
            placeholder={feld.placeholder || ''}
            rows={4}
            className={error ? 'input-error' : ''}
          />
        )
      case 'dropdown':
        return (
          <select
            value={formData[feld.id] as string || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, [feld.id]: e.target.value }))}
            className={error ? 'input-error' : ''}
          >
            <option value="">Bitte wählen...</option>
            {feld.optionen?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )
      case 'checkbox':
        return (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={formData[feld.id] as boolean || false}
              onChange={(e) => setFormData(prev => ({ ...prev, [feld.id]: e.target.checked }))}
            />
            <span>{feld.label}</span>
          </label>
        )
      case 'datum':
        return (
          <input
            type="date"
            value={formData[feld.id] as string || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, [feld.id]: e.target.value }))}
            className={error ? 'input-error' : ''}
          />
        )
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="public-form-container">
        <div className="public-form-card">
          <div className="loading-spinner">Laden...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="public-form-container">
        <div className="public-form-card">
          <div className="public-form-error">
            <span className="error-icon">⚠️</span>
            <h2>Fehler</h2>
            <p>{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="public-form-container">
        <div className="public-form-card">
          <div className="public-form-success">
            <span className="success-icon">✓</span>
            <h2>Vielen Dank!</h2>
            <p>Ihre Anmeldung wurde erfolgreich übermittelt.</p>
            {formular?.event_datum && (
              <p className="event-info">
                Wir freuen uns auf Sie am {formatDateGerman(formular.event_datum)}
                {formular.event_ort && ` in ${formular.event_ort}`}!
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="public-form-container">
      <div className="public-form-card">
        <div className="public-form-header">
          <div className="public-form-logo">
            <TennisLogo size={48} />
          </div>
          <h1>{formular?.titel}</h1>
          {formular?.beschreibung && <p className="form-description">{formular.beschreibung}</p>}
          {(formular?.event_datum || formular?.event_ort || formular?.preis || formular?.absagefrist) && (
            <div className="event-details">
              {formular.event_datum && (
                <span className="event-date">📅 {formatDateGerman(formular.event_datum)}{formular.event_uhrzeit_von && ` ${formular.event_uhrzeit_von}${formular.event_uhrzeit_bis ? ` - ${formular.event_uhrzeit_bis}` : ''} Uhr`}</span>
              )}
              {formular.event_ort && (
                <span className="event-location">📍 {formular.event_ort}</span>
              )}
              {formular.preis && (
                <span className="event-price">💰 {formular.preis}</span>
              )}
              {formular.absagefrist && (
                <span className="event-deadline">⏰ Absage: {formular.absagefrist}</span>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="public-form">
          {formular?.felder.map((feld) => (
            <div key={feld.id} className="form-group">
              {feld.typ !== 'checkbox' && (
                <label>
                  {feld.label}
                  {feld.pflichtfeld && <span className="required">*</span>}
                </label>
              )}
              {renderField(feld)}
              {validationErrors[feld.id] && (
                <span className="field-error">{validationErrors[feld.id]}</span>
              )}
            </div>
          ))}

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Wird gesendet...' : 'Anmeldung absenden'}
          </button>
        </form>

        {/* Footer mit Impressum/Datenschutz */}
        <div className="public-form-footer">
          <button onClick={() => setShowLegal('impressum')}>Impressum</button>
          <span>|</span>
          <button onClick={() => setShowLegal('datenschutz')}>Datenschutz</button>
        </div>
      </div>

      {/* Legal Modal */}
      {showLegal && (
        <div className="modal-overlay" onClick={() => setShowLegal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>{showLegal === 'impressum' ? 'Impressum' : 'Datenschutzerklärung'}</h3>
              <button className="modal-close" onClick={() => setShowLegal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflow: 'auto' }}>
              {showLegal === 'impressum' ? (
                <div className="rechtliches-content">
                  <h4>Angaben gemäß § 5 TMG</h4>
                  <p>
                    <strong>{trainerProfile?.name || ''} {trainerProfile?.nachname || ''}</strong><br />
                    {trainerProfile?.adresse ? trainerProfile.adresse.split('\n').map((line, i) => <span key={i}>{line}<br /></span>) : ''}
                  </p>
                  {trainerProfile?.steuernummer && (
                    <>
                      <h4>Steuernummer</h4>
                      <p>{trainerProfile.steuernummer}</p>
                    </>
                  )}
                  {trainerProfile?.ust_id_nr && (
                    <>
                      <h4>Umsatzsteuer-ID</h4>
                      <p>{trainerProfile.ust_id_nr}</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="rechtliches-content">
                  <h4>Datenschutz</h4>
                  <p>
                    <strong>Verantwortlich:</strong><br />
                    {trainerProfile?.name || ''} {trainerProfile?.nachname || ''}<br />
                    {trainerProfile?.adresse ? trainerProfile.adresse.split('\n').map((line, i) => <span key={i}>{line}<br /></span>) : ''}
                  </p>
                  <h4>Datenerfassung</h4>
                  <p>
                    Die von Ihnen eingegebenen Daten werden zur Bearbeitung Ihrer Anmeldung verwendet.
                    Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
                  </p>
                  <h4>Ihre Rechte</h4>
                  <p>
                    Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der
                    Verarbeitung Ihrer Daten.
                  </p>
                  <h4>Cookies</h4>
                  <p>
                    Diese Seite verwendet nur technisch notwendige Cookies.
                  </p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowLegal(null)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ FORMULARE VIEW (Admin-Bereich) ============
function FormulareView({
  formulare,
  anmeldungen,
  onUpdate,
  userId
}: {
  formulare: Formular[]
  anmeldungen: FormularAnmeldung[]
  onUpdate: () => void
  userId: string
}) {
  const [activeSubTab, setActiveSubTab] = useState<'liste' | 'anmeldungen'>('liste')
  const [showFormularModal, setShowFormularModal] = useState(false)
  const [editingFormular, setEditingFormular] = useState<Formular | null>(null)
  const [selectedFormular, setSelectedFormular] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Anmeldungen pro Formular zählen
  const getAnmeldungenCount = (formularId: string) => {
    return anmeldungen.filter(a => a.formular_id === formularId).length
  }

  const getUngeleseneCount = (formularId: string) => {
    return anmeldungen.filter(a => a.formular_id === formularId && !a.gelesen).length
  }

  const copyLink = async (formularId: string) => {
    const url = `${window.location.origin}/anmeldung/${formularId}`
    await navigator.clipboard.writeText(url)
    setCopiedId(formularId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDelete = async (formular: Formular) => {
    const confirmed = await showConfirm(
      'Formular löschen',
      `Möchten Sie das Formular "${formular.titel}" wirklich löschen? Alle zugehörigen Anmeldungen werden ebenfalls gelöscht.`
    )
    if (!confirmed) return

    await supabase.from('formulare').delete().eq('id', formular.id)
    onUpdate()
  }

  const toggleAktiv = async (formular: Formular) => {
    await supabase
      .from('formulare')
      .update({ ist_aktiv: !formular.ist_aktiv })
      .eq('id', formular.id)
    onUpdate()
  }

  const markAsRead = async (anmeldungId: string) => {
    await supabase
      .from('formular_anmeldungen')
      .update({ gelesen: true })
      .eq('id', anmeldungId)
    onUpdate()
  }

  const markAllAsRead = async (formularId: string) => {
    await supabase
      .from('formular_anmeldungen')
      .update({ gelesen: true })
      .eq('formular_id', formularId)
    onUpdate()
  }

  const deleteAnmeldung = async (anmeldung: FormularAnmeldung) => {
    const confirmed = await showConfirm(
      'Anmeldung löschen',
      'Möchten Sie diese Anmeldung wirklich löschen?'
    )
    if (!confirmed) return

    await supabase.from('formular_anmeldungen').delete().eq('id', anmeldung.id)
    onUpdate()
  }

  const selectedAnmeldungen = selectedFormular
    ? anmeldungen.filter(a => a.formular_id === selectedFormular).sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    : []

  return (
    <div className="formulare-view">
      <div className="view-header">
        <h2>📝 Anmeldeformulare</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingFormular(null)
            setShowFormularModal(true)
          }}
        >
          + Neues Formular
        </button>
      </div>

      <div className="sub-tabs">
        <button
          className={`sub-tab ${activeSubTab === 'liste' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('liste')}
        >
          Formulare
        </button>
        <button
          className={`sub-tab ${activeSubTab === 'anmeldungen' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('anmeldungen')}
        >
          Anmeldungen
          {anmeldungen.filter(a => !a.gelesen && formulare.some(f => f.id === a.formular_id)).length > 0 && (
            <span className="badge">{anmeldungen.filter(a => !a.gelesen && formulare.some(f => f.id === a.formular_id)).length}</span>
          )}
        </button>
      </div>

      {activeSubTab === 'liste' && (
        <div className="formulare-liste">
          {formulare.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📝</span>
              <h3>Noch keine Formulare</h3>
              <p>Erstellen Sie Ihr erstes Anmeldeformular für Events.</p>
            </div>
          ) : (
            <div className="formular-cards">
              {formulare.map(formular => (
                <div key={formular.id} className={`formular-card ${!formular.ist_aktiv ? 'inactive' : ''}`}>
                  <div className="formular-card-header">
                    <h3>{formular.titel}</h3>
                    <div className="formular-status">
                      <span className={`status-badge ${formular.ist_aktiv ? 'active' : 'inactive'}`}>
                        {formular.ist_aktiv ? 'Aktiv' : 'Inaktiv'}
                      </span>
                      {getUngeleseneCount(formular.id) > 0 && (
                        <span className="unread-badge">{getUngeleseneCount(formular.id)} neu</span>
                      )}
                    </div>
                  </div>

                  {formular.beschreibung && (
                    <p className="formular-description">{formular.beschreibung}</p>
                  )}

                  <div className="formular-meta">
                    {formular.event_datum && (
                      <span>📅 {formatDateGerman(formular.event_datum)}{formular.event_uhrzeit_von && `, ${formular.event_uhrzeit_von}${formular.event_uhrzeit_bis ? ` - ${formular.event_uhrzeit_bis}` : ''} Uhr`}</span>
                    )}
                    {formular.event_ort && (
                      <span>📍 {formular.event_ort}</span>
                    )}
                    {formular.preis && (
                      <span>💰 {formular.preis}</span>
                    )}
                    {formular.absagefrist && (
                      <span>⏰ {formular.absagefrist}</span>
                    )}
                    <span>📋 {getAnmeldungenCount(formular.id)} Anmeldungen</span>
                    {formular.max_anmeldungen && (
                      <span>👥 Max. {formular.max_anmeldungen}</span>
                    )}
                  </div>

                  <div className="formular-actions">
                    <button
                      className="btn btn-sm"
                      onClick={() => copyLink(formular.id)}
                      title="Link kopieren"
                    >
                      {copiedId === formular.id ? '✓ Kopiert!' : '🔗 Link kopieren'}
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        setSelectedFormular(formular.id)
                        setActiveSubTab('anmeldungen')
                      }}
                    >
                      📋 Anmeldungen
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => toggleAktiv(formular)}
                    >
                      {formular.ist_aktiv ? '⏸️ Deaktivieren' : '▶️ Aktivieren'}
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        setEditingFormular(formular)
                        setShowFormularModal(true)
                      }}
                    >
                      ✏️ Bearbeiten
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(formular)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'anmeldungen' && (
        <div className="anmeldungen-view">
          <div className="formular-select">
            <label>Formular auswählen:</label>
            <select
              value={selectedFormular || ''}
              onChange={(e) => setSelectedFormular(e.target.value || null)}
            >
              <option value="">Alle Formulare</option>
              {formulare.map(f => (
                <option key={f.id} value={f.id}>
                  {f.titel} ({getAnmeldungenCount(f.id)} Anmeldungen)
                </option>
              ))}
            </select>
            {selectedFormular && selectedAnmeldungen.some(a => !a.gelesen) && (
              <button
                className="btn btn-sm"
                onClick={() => markAllAsRead(selectedFormular)}
              >
                Alle als gelesen markieren
              </button>
            )}
          </div>

          {(selectedFormular ? selectedAnmeldungen : anmeldungen).length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📭</span>
              <h3>Keine Anmeldungen</h3>
              <p>Für dieses Formular liegen noch keine Anmeldungen vor.</p>
            </div>
          ) : (
            <div className="anmeldungen-liste">
              {(selectedFormular ? selectedAnmeldungen : anmeldungen
                .filter(a => formulare.some(f => f.id === a.formular_id))
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              ).map(anmeldung => {
                const formular = formulare.find(f => f.id === anmeldung.formular_id)
                return (
                  <div key={anmeldung.id} className={`anmeldung-card ${!anmeldung.gelesen ? 'unread' : ''}`}>
                    <div className="anmeldung-header">
                      <div className="anmeldung-info">
                        {!selectedFormular && formular && (
                          <span className="formular-name">{formular.titel}</span>
                        )}
                        <span className="anmeldung-date">
                          {new Date(anmeldung.created_at).toLocaleString('de-DE')}
                        </span>
                        {!anmeldung.gelesen && <span className="new-badge">Neu</span>}
                      </div>
                      <div className="anmeldung-actions">
                        {!anmeldung.gelesen && (
                          <button
                            className="btn btn-sm"
                            onClick={() => markAsRead(anmeldung.id)}
                          >
                            ✓ Gelesen
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => deleteAnmeldung(anmeldung)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div className="anmeldung-daten">
                      {formular?.felder.map(feld => {
                        const value = anmeldung.daten[feld.id]
                        if (value === undefined || value === '' || value === false) return null
                        return (
                          <div key={feld.id} className="datum-row">
                            <span className="datum-label">{feld.label}:</span>
                            <span className="datum-value">
                              {feld.typ === 'checkbox' ? (value ? 'Ja' : 'Nein') : String(value)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {showFormularModal && (
        <FormularModal
          formular={editingFormular}
          userId={userId}
          onClose={() => {
            setShowFormularModal(false)
            setEditingFormular(null)
          }}
          onSave={() => {
            setShowFormularModal(false)
            setEditingFormular(null)
            onUpdate()
          }}
        />
      )}
    </div>
  )
}

// ============ FORMULAR MODAL (Erstellen/Bearbeiten) ============
function FormularModal({
  formular,
  userId,
  onClose,
  onSave
}: {
  formular: Formular | null
  userId: string
  onClose: () => void
  onSave: () => void
}) {
  const [titel, setTitel] = useState(formular?.titel || '')
  const [beschreibung, setBeschreibung] = useState(formular?.beschreibung || '')
  const [felder, setFelder] = useState<FormularFeld[]>(formular?.felder || [])
  const [istAktiv, setIstAktiv] = useState(formular?.ist_aktiv ?? true)
  const [eventDatum, setEventDatum] = useState(formular?.event_datum || '')
  const [eventUhrzeitVon, setEventUhrzeitVon] = useState(formular?.event_uhrzeit_von || '')
  const [eventUhrzeitBis, setEventUhrzeitBis] = useState(formular?.event_uhrzeit_bis || '')
  const [eventOrt, setEventOrt] = useState(formular?.event_ort || '')
  const [maxAnmeldungen, setMaxAnmeldungen] = useState(formular?.max_anmeldungen?.toString() || '')
  const [anmeldeschluss, setAnmeldeschluss] = useState(formular?.anmeldeschluss?.split('T')[0] || '')
  const [preis, setPreis] = useState(formular?.preis || '')
  const [absagefrist, setAbsagefrist] = useState(formular?.absagefrist || '')
  const [saving, setSaving] = useState(false)

  const addFeld = (typ: FormularFeld['typ']) => {
    const newFeld: FormularFeld = {
      id: crypto.randomUUID(),
      typ,
      label: '',
      pflichtfeld: false,
      optionen: typ === 'dropdown' ? ['Option 1'] : undefined
    }
    setFelder([...felder, newFeld])
  }

  const updateFeld = (id: string, updates: Partial<FormularFeld>) => {
    setFelder(felder.map(f => f.id === id ? { ...f, ...updates } : f))
  }

  const moveFeld = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= felder.length) return
    const newFelder = [...felder]
    const temp = newFelder[index]
    newFelder[index] = newFelder[newIndex]
    newFelder[newIndex] = temp
    setFelder(newFelder)
  }

  const removeFeld = (id: string) => {
    setFelder(felder.filter(f => f.id !== id))
  }

  const addOption = (feldId: string) => {
    setFelder(felder.map(f => {
      if (f.id === feldId && f.optionen) {
        return { ...f, optionen: [...f.optionen, `Option ${f.optionen.length + 1}`] }
      }
      return f
    }))
  }

  const updateOption = (feldId: string, optIndex: number, value: string) => {
    setFelder(felder.map(f => {
      if (f.id === feldId && f.optionen) {
        const newOptionen = [...f.optionen]
        newOptionen[optIndex] = value
        return { ...f, optionen: newOptionen }
      }
      return f
    }))
  }

  const removeOption = (feldId: string, optIndex: number) => {
    setFelder(felder.map(f => {
      if (f.id === feldId && f.optionen && f.optionen.length > 1) {
        return { ...f, optionen: f.optionen.filter((_, i) => i !== optIndex) }
      }
      return f
    }))
  }

  const handleSave = async () => {
    if (!titel.trim()) {
      alert('Bitte geben Sie einen Titel ein.')
      return
    }
    if (felder.length === 0) {
      alert('Bitte fügen Sie mindestens ein Feld hinzu.')
      return
    }
    if (felder.some(f => !f.label.trim())) {
      alert('Bitte füllen Sie alle Feld-Labels aus.')
      return
    }

    setSaving(true)
    const data = {
      user_id: userId,
      titel: titel.trim(),
      beschreibung: beschreibung.trim() || null,
      felder,
      ist_aktiv: istAktiv,
      event_datum: eventDatum || null,
      event_uhrzeit_von: eventUhrzeitVon || null,
      event_uhrzeit_bis: eventUhrzeitBis || null,
      event_ort: eventOrt.trim() || null,
      max_anmeldungen: maxAnmeldungen ? parseInt(maxAnmeldungen) : null,
      anmeldeschluss: anmeldeschluss ? new Date(anmeldeschluss).toISOString() : null,
      preis: preis.trim() || null,
      absagefrist: absagefrist.trim() || null
    }

    try {
      if (formular) {
        await supabase.from('formulare').update(data).eq('id', formular.id)
      } else {
        await supabase.from('formulare').insert(data)
      }
      onSave()
    } catch (err) {
      console.error('Error saving formular:', err)
      alert('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const feldTypen: { typ: FormularFeld['typ']; label: string; icon: string }[] = [
    { typ: 'text', label: 'Text', icon: '📝' },
    { typ: 'email', label: 'E-Mail', icon: '📧' },
    { typ: 'telefon', label: 'Telefon', icon: '📞' },
    { typ: 'number', label: 'Zahl', icon: '🔢' },
    { typ: 'datum', label: 'Datum', icon: '📅' },
    { typ: 'dropdown', label: 'Auswahl', icon: '📋' },
    { typ: 'textarea', label: 'Textbereich', icon: '📄' },
    { typ: 'checkbox', label: 'Checkbox', icon: '☑️' }
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{formular ? 'Formular bearbeiten' : 'Neues Formular erstellen'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-section">
            <h4>Grundeinstellungen</h4>
            <div className="form-group">
              <label>Titel *</label>
              <input
                type="text"
                value={titel}
                onChange={e => setTitel(e.target.value)}
                placeholder="z.B. Anmeldung Sommercamp 2025"
              />
            </div>
            <div className="form-group">
              <label>Beschreibung</label>
              <textarea
                value={beschreibung}
                onChange={e => setBeschreibung(e.target.value)}
                placeholder="Optionale Beschreibung des Events..."
                rows={3}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Event-Datum</label>
                <input
                  type="date"
                  value={eventDatum}
                  onChange={e => setEventDatum(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Uhrzeit von</label>
                <input
                  type="time"
                  value={eventUhrzeitVon}
                  onChange={e => setEventUhrzeitVon(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Uhrzeit bis</label>
                <input
                  type="time"
                  value={eventUhrzeitBis}
                  onChange={e => setEventUhrzeitBis(e.target.value)}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Event-Ort</label>
              <input
                type="text"
                value={eventOrt}
                onChange={e => setEventOrt(e.target.value)}
                placeholder="z.B. Tennisclub Musterstadt"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Max. Anmeldungen</label>
                <input
                  type="number"
                  value={maxAnmeldungen}
                  onChange={e => setMaxAnmeldungen(e.target.value)}
                  placeholder="Unbegrenzt"
                  min="1"
                />
              </div>
              <div className="form-group">
                <label>Anmeldeschluss</label>
                <input
                  type="date"
                  value={anmeldeschluss}
                  onChange={e => setAnmeldeschluss(e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Preis</label>
                <input
                  type="text"
                  value={preis}
                  onChange={e => setPreis(e.target.value)}
                  placeholder="z.B. 25€ pro Person"
                />
              </div>
              <div className="form-group">
                <label>Absagefrist</label>
                <input
                  type="text"
                  value={absagefrist}
                  onChange={e => setAbsagefrist(e.target.value)}
                  placeholder="z.B. bis 3 Tage vorher"
                />
              </div>
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={istAktiv}
                  onChange={e => setIstAktiv(e.target.checked)}
                />
                <span>Formular ist aktiv (kann ausgefüllt werden)</span>
              </label>
            </div>
          </div>

          <div className="form-section">
            <h4>Formularfelder</h4>
            <div className="feld-typen">
              {feldTypen.map(ft => (
                <button
                  key={ft.typ}
                  className="btn btn-sm"
                  onClick={() => addFeld(ft.typ)}
                  type="button"
                >
                  {ft.icon} {ft.label}
                </button>
              ))}
            </div>

            <div className="felder-liste">
              {felder.length === 0 ? (
                <div className="empty-felder">
                  Klicken Sie oben auf einen Feldtyp, um Felder hinzuzufügen.
                </div>
              ) : (
                felder.map((feld, index) => (
                  <div key={feld.id} className="feld-editor">
                    <div className="feld-header">
                      <span className="feld-typ">
                        {feldTypen.find(ft => ft.typ === feld.typ)?.icon} {feldTypen.find(ft => ft.typ === feld.typ)?.label}
                      </span>
                      <div className="feld-controls">
                        <button
                          className="btn-icon"
                          onClick={() => moveFeld(index, 'up')}
                          disabled={index === 0}
                          title="Nach oben"
                        >
                          ↑
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => moveFeld(index, 'down')}
                          disabled={index === felder.length - 1}
                          title="Nach unten"
                        >
                          ↓
                        </button>
                        <button
                          className="btn-icon btn-danger"
                          onClick={() => removeFeld(feld.id)}
                          title="Entfernen"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <div className="feld-body">
                      <div className="form-group">
                        <label>Bezeichnung *</label>
                        <input
                          type="text"
                          value={feld.label}
                          onChange={e => updateFeld(feld.id, { label: e.target.value })}
                          placeholder={`z.B. ${feld.typ === 'email' ? 'E-Mail-Adresse' : feld.typ === 'telefon' ? 'Telefonnummer' : 'Vorname'}`}
                        />
                      </div>
                      {feld.typ !== 'checkbox' && (
                        <div className="form-group">
                          <label>Platzhalter</label>
                          <input
                            type="text"
                            value={feld.placeholder || ''}
                            onChange={e => updateFeld(feld.id, { placeholder: e.target.value })}
                            placeholder="Optionaler Platzhaltertext"
                          />
                        </div>
                      )}
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={feld.pflichtfeld}
                          onChange={e => updateFeld(feld.id, { pflichtfeld: e.target.checked })}
                        />
                        <span>Pflichtfeld</span>
                      </label>

                      {feld.typ === 'dropdown' && (
                        <div className="dropdown-optionen">
                          <label>Auswahloptionen:</label>
                          {feld.optionen?.map((opt, optIndex) => (
                            <div key={optIndex} className="option-row">
                              <input
                                type="text"
                                value={opt}
                                onChange={e => updateOption(feld.id, optIndex, e.target.value)}
                              />
                              <button
                                className="btn-icon btn-danger"
                                onClick={() => removeOption(feld.id, optIndex)}
                                disabled={feld.optionen!.length <= 1}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <button
                            className="btn btn-sm"
                            onClick={() => addOption(feld.id)}
                            type="button"
                          >
                            + Option hinzufügen
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Speichere...' : formular ? 'Speichern' : 'Formular erstellen'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
