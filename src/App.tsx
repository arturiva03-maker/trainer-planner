import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from './supabaseClient'
import { searchLexofficeContacts, createLexofficeInvoice } from './lexoffice'
import type { LexofficeContact, LexofficeLineItem } from './lexoffice'
import type { User, Session } from '@supabase/supabase-js'
import type {
  TrainerProfile,
  Spieler,
  Tarif,
  Training,
  Trainer,
  MonthlyAdjustment,
  Tab,
  SpielerTrainingPayment
} from './types'

// Pauschalpreis-Abrechnung-Whitelist. Leeres Array = alle Trainer; sonst nur die gelisteten E-Mails.
const POOL_ALLOWED_EMAILS: readonly string[] = ['zlatanpalazov60@gmail.com']
const isPoolAllowed = (email?: string | null) =>
  POOL_ALLOWED_EMAILS.length === 0 || (!!email && POOL_ALLOWED_EMAILS.includes(email.toLowerCase()))

// Lexoffice-Rechnungen: jeder Trainer mit eigenem Lexoffice-Konto. Muss zur
// LEXOFFICE_KEY_ENV-Map in api/lexoffice.js passen (dort liegt pro E-Mail der
// zugehoerige API-Key).
const LEXOFFICE_ALLOWED_EMAILS: readonly string[] = ['arturiva03@gmail.com', 'zlatanpalazov60@gmail.com']
const isLexofficeAllowed = (email?: string | null) =>
  !!email && LEXOFFICE_ALLOWED_EMAILS.includes(email.toLowerCase())

// Supabase liefert pro Request max. 1000 Zeilen. Diese Hilfsfunktion holt ALLE
// Zeilen seitenweise. Die uebergebene Query MUSS stabil sortiert sein (.order),
// sonst koennen Seiten Zeilen doppeln/auslassen.
async function fetchAllRows<T>(
  buildPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const pageSize = 1000
  const all: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await buildPage(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}
import {
  formatDate,
  formatDateGerman,
  formatWeekdayGerman,
  formatTime,
  getWeekDates,
  getMonthString,
  calculateDuration,
  calculateSpielerPreisForTraining,
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
    <ellipse cx="26" cy="22" rx="18" ry="20" stroke="#6366F1" strokeWidth="3" fill="none"/>
    {/* Racket strings horizontal */}
    <line x1="10" y1="16" x2="42" y2="16" stroke="#6366F1" strokeWidth="1.5" opacity="0.6"/>
    <line x1="9" y1="22" x2="43" y2="22" stroke="#6366F1" strokeWidth="1.5" opacity="0.6"/>
    <line x1="10" y1="28" x2="42" y2="28" stroke="#6366F1" strokeWidth="1.5" opacity="0.6"/>
    {/* Racket strings vertical */}
    <line x1="18" y1="4" x2="18" y2="40" stroke="#6366F1" strokeWidth="1.5" opacity="0.6"/>
    <line x1="26" y1="2" x2="26" y2="42" stroke="#6366F1" strokeWidth="1.5" opacity="0.6"/>
    <line x1="34" y1="4" x2="34" y2="40" stroke="#6366F1" strokeWidth="1.5" opacity="0.6"/>
    {/* Racket handle */}
    <rect x="22" y="40" width="8" height="20" rx="2" fill="#6366F1"/>
    <rect x="22" y="44" width="8" height="3" fill="#4F46E5"/>
    <rect x="22" y="50" width="8" height="3" fill="#4F46E5"/>
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
      { icon: '📊', title: 'Abrechnungsmodelle', desc: 'Pro Training oder monatliche Pauschalen' },
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
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    confirmText: string
    variant: 'danger' | 'warning' | 'primary'
  }>({ isOpen: false, title: '', message: '', confirmText: 'Löschen', variant: 'danger' })

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
  const [dataLoading, setDataLoading] = useState(true)

  // Persistenter Navigation-State (wird nicht bei Daten-Refresh zurückgesetzt)
  const [kalenderDate, setKalenderDate] = useState(new Date())

  // Load all data
  useEffect(() => {
    loadAllData()
  }, [user.id])

  const loadAllData = async () => {
    // Kein setDataLoading(true) hier: Sonst wuerde bei jedem Refresh die aktuelle
    // View (z.B. Abrechnung mit gewaehltem Monat/Filter/Detail-Modal) unmounted
    // und alle internen States zurueckgesetzt. Initial ist dataLoading bereits true.
    try {
      const [
        profileRes,
        spielerRes,
        tarifeRes,
        trainerRes,
        adjustmentsRes,
        // trainings und payments koennen >1000 Zeilen haben -> seitenweise laden
        trainingsAll,
        spielerPaymentsAll
      ] = await Promise.all([
        supabase.from('trainer_profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('spieler').select('*').eq('user_id', user.id).order('name'),
        supabase.from('tarife').select('*').eq('user_id', user.id).order('name'),
        supabase.from('trainer').select('*').eq('user_id', user.id).order('name'),
        supabase.from('monthly_adjustments').select('*').eq('user_id', user.id),
        fetchAllRows<Training>((from, to) =>
          supabase.from('trainings').select('*').eq('user_id', user.id)
            .order('datum', { ascending: false }).order('id').range(from, to)
        ),
        fetchAllRows<SpielerTrainingPayment>((from, to) =>
          supabase.from('spieler_training_payments').select('*').eq('user_id', user.id)
            .order('id').range(from, to)
        )
      ])

      if (profileRes.data) setProfile(profileRes.data)
      if (spielerRes.data) setSpieler(spielerRes.data)
      if (tarifeRes.data) setTarife(tarifeRes.data)
      setTrainings(trainingsAll)
      if (trainerRes.data) setTrainer(trainerRes.data)
      if (adjustmentsRes.data) setAdjustments(adjustmentsRes.data)
      setSpielerPayments(spielerPaymentsAll)
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

  const poolEnabled = isPoolAllowed(user.email)
  const lexofficeEnabled = isLexofficeAllowed(user.email)

  const baseTabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'kalender', label: 'Kalender', icon: '📅' },
    { id: 'verwaltung', label: 'Verwaltung', icon: '👥' },
    { id: 'abrechnung', label: 'Abrechnung', icon: '💰' },
    { id: 'platzgebuehr', label: 'Platzgebühr', icon: '🎾' },
  ]

  const tabs: { id: Tab; label: string; icon: string }[] = [...baseTabs]
  if (trainer.length > 0) tabs.push({ id: 'abrechnung-trainer', label: 'Abr. Trainer', icon: '👨‍🏫' })

  const mobileNavTabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'kalender', label: 'Kalender', icon: '📅' },
    { id: 'verwaltung', label: 'Verwalten', icon: '👥' },
    { id: 'abrechnung', label: 'Rechnung', icon: '💰' },
    { id: 'platzgebuehr', label: 'Platz', icon: '🎾' },
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
                poolEnabled={poolEnabled}
              />
            )}
            {activeTab === 'verwaltung' && (
              <VerwaltungView
                spieler={spieler}
                tarife={tarife}
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
                onUpdate={loadAllData}
                onNavigateToTraining={handleNavigateToTraining}
                userId={user.id}
                lexofficeEnabled={lexofficeEnabled}
              />
            )}
            {activeTab === 'platzgebuehr' && (
              <PlatzgebuehrView
                trainings={trainings}
                spieler={spieler}
                onUpdate={loadAllData}
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
  onDateChange,
  poolEnabled
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
  poolEnabled: boolean
}) {
  const [viewMode, setViewMode] = useState<'week' | 'day'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'week'
  )
  const [editingTraining, setEditingTraining] = useState<Training | null>(null)
  const [selectedTrainingIds, setSelectedTrainingIds] = useState<Set<string>>(new Set())
  const [tooltip, setTooltip] = useState<{ training: Training, x: number, y: number } | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressFiredRef = useRef(false)
  const longPressStartRef = useRef<{ x: number, y: number } | null>(null)
  const isTouchDeviceRef = useRef(
    typeof window !== 'undefined' && (
      'ontouchstart' in window ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
      window.matchMedia('(hover: none)').matches ||
      window.matchMedia('(pointer: coarse)').matches
    )
  )
  // Drag wird erst nach einer echten Maus-Interaktion aktiviert.
  // Damit kann auf Touch-Geraeten kein HTML5-Drag durch Long-Press ausgeloest werden.
  const [dragEnabled, setDragEnabled] = useState(false)
  useEffect(() => {
    if (isTouchDeviceRef.current) return
    const enable = () => setDragEnabled(true)
    window.addEventListener('mousemove', enable, { once: true })
    window.addEventListener('mousedown', enable, { once: true })
    return () => {
      window.removeEventListener('mousemove', enable)
      window.removeEventListener('mousedown', enable)
    }
  }, [])

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

  const hasIndividualTariffs = (training: Training): boolean => {
    if (!training.spieler_tarife) return false
    return Object.values(training.spieler_tarife).some(o => !!o.tarif_id || o.custom_preis != null)
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
    // Long-Press hat Tooltip geöffnet — Klick unterdrücken
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false
      return
    }
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

  // Hover (Desktop) — Tooltip öffnen
  const handleTrainingMouseEnter = (e: React.MouseEvent, training: Training) => {
    if (isTouchDeviceRef.current) return
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const x = Math.min(rect.right + 8, window.innerWidth - 280)
    const y = Math.min(rect.top, window.innerHeight - 240)
    setTooltip({ training, x, y })
  }

  const handleTrainingMouseLeave = () => {
    if (isTouchDeviceRef.current) return
    setTooltip(null)
  }

  // Long-Press (Mobile) — Tooltip öffnen
  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleTrainingTouchStart = (e: React.TouchEvent, training: Training) => {
    longPressFiredRef.current = false
    const touch = e.touches[0]
    longPressStartRef.current = { x: touch.clientX, y: touch.clientY }
    const x = Math.min(touch.clientX, window.innerWidth - 280)
    const y = Math.min(touch.clientY, window.innerHeight - 240)
    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true
      setTooltip({ training, x, y })
    }, 500)
  }

  const handleTrainingTouchEnd = () => {
    cancelLongPress()
    longPressStartRef.current = null
  }

  const handleTrainingTouchMove = (e: React.TouchEvent) => {
    if (!longPressStartRef.current || !longPressTimerRef.current) return
    const touch = e.touches[0]
    const dx = touch.clientX - longPressStartRef.current.x
    const dy = touch.clientY - longPressStartRef.current.y
    if (Math.hypot(dx, dy) > 10) {
      cancelLongPress()
    }
  }

  // Tooltip dismiss bei Tap außerhalb (mobile) oder Scroll
  useEffect(() => {
    if (!tooltip) return
    const dismiss = () => setTooltip(null)
    const timer = window.setTimeout(() => {
      window.addEventListener('touchstart', dismiss)
      window.addEventListener('scroll', dismiss, true)
    }, 100)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('touchstart', dismiss)
      window.removeEventListener('scroll', dismiss, true)
    }
  }, [tooltip])

  // Drag & Drop — Training verschieben
  const handleTrainingDragStart = (e: React.DragEvent, training: Training) => {
    e.dataTransfer.setData('text/plain', training.id)
    e.dataTransfer.effectAllowed = 'move'
    setTooltip(null)
  }

  const handleCellDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes('text/plain')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    e.currentTarget.classList.add('drag-over')
  }

  const handleCellDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('drag-over')
  }

  const handleCellDrop = async (e: React.DragEvent<HTMLDivElement>, date: Date, time: string) => {
    e.preventDefault()
    e.currentTarget.classList.remove('drag-over')
    const trainingId = e.dataTransfer.getData('text/plain')
    if (!trainingId) return
    const training = trainings.find(t => t.id === trainingId)
    if (!training) return

    const [newH] = time.split(':').map(Number)
    const [oldStartH, oldStartM] = training.uhrzeit_von.split(':').map(Number)
    const [oldEndH, oldEndM] = training.uhrzeit_bis.split(':').map(Number)
    const durationMin = (oldEndH * 60 + oldEndM) - (oldStartH * 60 + oldStartM)

    const newStart = `${String(newH).padStart(2, '0')}:${String(oldStartM).padStart(2, '0')}`
    const newEndTotalMin = newH * 60 + oldStartM + durationMin
    if (newEndTotalMin >= 24 * 60) return // würde über Mitternacht laufen
    const newEndH = Math.floor(newEndTotalMin / 60)
    const newEndM = newEndTotalMin % 60
    const newEnd = `${String(newEndH).padStart(2, '0')}:${String(newEndM).padStart(2, '0')}`

    const newDate = formatDate(date)
    if (newDate === training.datum && newStart === training.uhrzeit_von) return

    preserveScroll()
    await supabase.from('trainings').update({
      datum: newDate,
      uhrzeit_von: newStart,
      uhrzeit_bis: newEnd
    }).eq('id', training.id)
    onUpdate()
  }

  // Alle ausgewählten Trainings als durchgeführt markieren
  const handleMarkSelectedAsDurchgefuehrt = async () => {
    preserveScroll()
    const selectedTrainings = trainings.filter(t => selectedTrainingIds.has(t.id))

    for (const training of selectedTrainings) {
      // 50%-Status nicht ueberschreiben
      if (training.status === 'durchgefuehrt' || training.status === 'durchgefuehrt_halb') continue
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
  const [addTrainingPreset, setAddTrainingPreset] = useState<{ date: string, von: string, bis: string } | null>(null)

  const handleCellClick = (e: React.MouseEvent<HTMLDivElement>, date: Date, time: string) => {
    // Nur bei Klick auf leere Zelle (nicht auf Training-Block)
    if (e.target !== e.currentTarget) return
    const [h] = time.split(':').map(Number)
    const von = `${String(h).padStart(2, '0')}:00`
    const bis = `${String(h + 1).padStart(2, '0')}:00`
    setAddTrainingPreset({ date: formatDate(date), von, bis })
    setShowAddTraining(true)
  }

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
                    <div
                      key={`cell-${dayIndex}-${time}`}
                      className="calendar-day-cell"
                      onClick={(e) => handleCellClick(e, date, time)}
                      onDragOver={handleCellDragOver}
                      onDragLeave={handleCellDragLeave}
                      onDrop={(e) => handleCellDrop(e, date, time)}
                    >
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
                            draggable={dragEnabled && !isTouchDeviceRef.current}
                            onDragStart={(e) => handleTrainingDragStart(e, training)}
                            onClick={(e) => handleTrainingClick(e, training)}
                            onDoubleClick={() => handleDoubleClick(training)}
                            onMouseEnter={(e) => handleTrainingMouseEnter(e, training)}
                            onMouseLeave={handleTrainingMouseLeave}
                            onTouchStart={(e) => handleTrainingTouchStart(e, training)}
                            onTouchEnd={handleTrainingTouchEnd}
                            onTouchMove={handleTrainingTouchMove}
                            onTouchCancel={handleTrainingTouchEnd}
                          >
                            {hasIndividualTariffs(training) && (
                              <span className="training-indiv-marker" title="Individuelle Tarife">★</span>
                            )}
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

      {/* Training Info Tooltip (Hover Desktop / Long-Press Mobile) */}
      {tooltip && (() => {
        const t = tooltip.training
        const tarifName = getTarifName(t.tarif_id)
        const customPreis = t.custom_preis_pro_stunde
        const statusLabel =
          t.status === 'geplant' ? 'Geplant' :
          t.status === 'durchgefuehrt' ? 'Durchgeführt' :
          t.status === 'durchgefuehrt_halb' ? 'Durchgeführt – 50%' :
          'Abgesagt'
        const renderSpielerRow = (spielerId: string, isEntfernt: boolean) => {
          const sp = spieler.find(s => s.id === spielerId)
          if (!sp) return null
          const indiv = t.spieler_tarife?.[spielerId]
          const indivTarif = indiv?.tarif_id ? tarife.find(ta => ta.id === indiv.tarif_id) : null
          const indivCustom = indiv?.custom_preis
          const hasIndiv = !!indivTarif || indivCustom != null
          return (
            <div
              key={spielerId}
              style={isEntfernt ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}
            >
              • {sp.name}
              {hasIndiv && (
                <span className="tooltip-indiv-badge">
                  {indivTarif ? indivTarif.name : `${indivCustom} €/h`}
                </span>
              )}
            </div>
          )
        }
        return (
          <div
            className="training-tooltip"
            style={{ left: tooltip.x, top: tooltip.y }}
            onClick={() => setTooltip(null)}
          >
            {t.name && <div className="tooltip-title">{t.name}</div>}
            <div className="tooltip-row">
              <strong>{formatTime(t.uhrzeit_von)} – {formatTime(t.uhrzeit_bis)}</strong>
            </div>
            {tarifName && (
              <div className="tooltip-row">
                Tarif: {tarifName}
                {customPreis != null && <span style={{ marginLeft: 4 }}>({customPreis} €/h custom)</span>}
              </div>
            )}
            {!tarifName && customPreis != null && (
              <div className="tooltip-row">Preis: {customPreis} €/h</div>
            )}
            <div className="tooltip-row">
              Status: <span className={`status-badge ${t.status}`}>{statusLabel}</span>
            </div>
            {(t.spieler_ids.length > 0 || (t.entfernte_spieler || []).length > 0) && (
              <div className="tooltip-row">
                <div style={{ fontWeight: 600, marginBottom: 2 }}>Spieler:</div>
                {t.spieler_ids.map(id => renderSpielerRow(id, false))}
                {(t.entfernte_spieler || []).map(es => renderSpielerRow(es.spieler_id, true))}
              </div>
            )}
            {t.notiz && (
              <div className="tooltip-row" style={{ fontStyle: 'italic', opacity: 0.85 }}>
                {t.notiz}
              </div>
            )}
          </div>
        )
      })()}

      {/* Edit Training Modal */}
      {editingTraining && (
        <TrainingModal
          training={editingTraining}
          spieler={spieler}
          tarife={tarife}
          userId={userId}
          poolEnabled={poolEnabled}
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
          poolEnabled={poolEnabled}
          initialDate={addTrainingPreset?.date || formatDate(currentDate)}
          initialUhrzeitVon={addTrainingPreset?.von}
          initialUhrzeitBis={addTrainingPreset?.bis}
          onClose={() => {
            setShowAddTraining(false)
            setAddTrainingPreset(null)
          }}
          onSave={() => {
            setShowAddTraining(false)
            setAddTrainingPreset(null)
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
  initialUhrzeitVon,
  initialUhrzeitBis,
  poolEnabled,
  onClose,
  onSave
}: {
  training?: Training
  spieler: Spieler[]
  tarife: Tarif[]
  userId: string
  initialDate?: string
  initialUhrzeitVon?: string
  initialUhrzeitBis?: string
  poolEnabled: boolean
  onClose: () => void
  onSave: () => void
}) {
  const [datum, setDatum] = useState(training?.datum || initialDate || formatDate(new Date()))
  const [uhrzeitVon, setUhrzeitVon] = useState(training?.uhrzeit_von || initialUhrzeitVon || '09:00')
  const [uhrzeitBis, setUhrzeitBis] = useState(training?.uhrzeit_bis || initialUhrzeitBis || '10:00')
  const [selectedSpieler, setSelectedSpieler] = useState<string[]>(training?.spieler_ids || [])
  const [entfernteSpieler, setEntfernteSpieler] = useState<{spieler_id: string, muss_bezahlen: boolean, entfernt_am: string}[]>(training?.entfernte_spieler || [])
  const [tarifId, setTarifId] = useState(training?.tarif_id || '')
  const [status, setStatus] = useState<Training['status']>(training?.status || 'geplant')
  const [notiz, setNotiz] = useState(training?.notiz || '')
  const [trainingName, setTrainingName] = useState(training?.name || '')
  const [barBezahlt, setBarBezahlt] = useState(training?.bar_bezahlt || false)
  const [customPreis, setCustomPreis] = useState(training?.custom_preis_pro_stunde?.toString() || '')
  // Individuelle Tarife pro Spieler (Gruppentraining)
  const [individuelleTarife, setIndividuelleTarife] = useState<boolean>(
    !!training?.spieler_tarife && Object.keys(training.spieler_tarife).length > 0
  )
  const [spielerTarifeMap, setSpielerTarifeMap] = useState<Record<string, { tarif_id: string, custom_preis: string }>>(() => {
    const initial: Record<string, { tarif_id: string, custom_preis: string }> = {}
    if (training?.spieler_tarife) {
      Object.entries(training.spieler_tarife).forEach(([sid, ov]) => {
        initial[sid] = {
          tarif_id: ov.tarif_id || '',
          custom_preis: ov.custom_preis != null ? String(ov.custom_preis) : ''
        }
      })
    }
    return initial
  })
  // Pool-Modus: Pauschalpreis pro Spieler/Einheit (Tarif/Dauer egal).
  // Einheiten pro Spieler werden im spieler_tarife-JSON unter "einheiten" abgelegt.
  const [poolMode, setPoolMode] = useState<boolean>(!!training?.ist_pool)
  const [poolPauschale, setPoolPauschale] = useState<string>(
    training?.pool_pauschalpreis_pro_einheit != null
      ? String(training.pool_pauschalpreis_pro_einheit)
      : ''
  )
  const [poolEinheitenMap, setPoolEinheitenMap] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    if (training?.spieler_tarife) {
      Object.entries(training.spieler_tarife).forEach(([sid, ov]) => {
        if (ov?.einheiten != null) initial[sid] = String(ov.einheiten)
      })
    }
    return initial
  })
  // Einmalige Platzgebuehr nur fuer dieses Training (Spieler ohne globales Label)
  const [platzgebuehrSpieler, setPlatzgebuehrSpieler] = useState<string[]>(
    training?.platzgebuehr_spieler_ids || []
  )
  // Ausnahme nur fuer dieses Training: gelabelte Spieler, die hier KEINE
  // Platzgebuehr zahlen sollen.
  const [platzgebuehrAusnahme, setPlatzgebuehrAusnahme] = useState<string[]>(
    training?.platzgebuehr_ausnahme_ids || []
  )
  const [wiederholen, setWiederholen] = useState(false)
  // Zeitraum 1: heute bis vor Sommerferien Berlin 2026 (endet 08.07.2026)
  // Zeitraum 2: nach Sommerferien (ab 23.08.2026) bis vor Herbstferien (endet 18.10.2026)
  const [wiederholenZeitraum1Bis, setWiederholenZeitraum1Bis] = useState('2026-07-12')
  const [wiederholenZeitraum2Von, setWiederholenZeitraum2Von] = useState('2026-08-24')
  const [wiederholenZeitraum2Bis, setWiederholenZeitraum2Bis] = useState('2026-09-30')
  const [serienAktion, setSerienAktion] = useState<'einzeln' | 'nachfolgende'>('einzeln')
  const [saving, setSaving] = useState(false)
  const [spielerSuche, setSpielerSuche] = useState('')

  // Sicherstellen, dass jeder ausgewaehlte Spieler einen Eintrag in der Map hat,
  // sobald der Modus "individuelle Tarife" aktiv ist.
  useEffect(() => {
    if (!individuelleTarife) return
    setSpielerTarifeMap(prev => {
      const next = { ...prev }
      let changed = false
      selectedSpieler.forEach(sid => {
        if (!next[sid]) {
          next[sid] = { tarif_id: tarifId || '', custom_preis: '' }
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [individuelleTarife, selectedSpieler, tarifId])

  // State für Bezahl-Abfrage bei Spieler-Entfernung
  const [removeDialog, setRemoveDialog] = useState<{spielerId: string, spielerName: string} | null>(null)

  // State für Bezahl-Abfrage bei Löschen/Absagen
  const [cancelDialog, setCancelDialog] = useState<{type: 'delete' | 'cancel', previousStatus?: Training['status']} | null>(null)

  // Prüfen ob Training Teil einer Serie ist
  const istSerie = training?.serie_id != null

  // Abrechnungsart ermitteln
  const selectedTarif = tarife.find(t => t.id === tarifId)
  const abrechnungsart = selectedTarif?.abrechnung || 'proTraining'

  // Prüft ob Bezahl-Abfrage nötig ist (nur bei proTraining mit Spielern)
  const brauchtBezahlAbfrage = training &&
    abrechnungsart === 'proTraining' &&
    selectedSpieler.length > 0

  const toggleSpieler = async (id: string) => {
    const isRemoving = selectedSpieler.includes(id)

    // Nur bei existierendem Training und relevanter Abrechnungsart nachfragen
    if (isRemoving && training && abrechnungsart === 'proTraining') {
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

    if (!poolMode && !individuelleTarife && !tarifId && !customPreis) {
      alert('Bitte einen Tarif auswählen oder einen individuellen Preis eingeben')
      return
    }

    // Pool-Modus: Pauschalpreis erforderlich
    let poolPauschaleNum: number | null = null
    if (poolMode) {
      poolPauschaleNum = parseFloat(poolPauschale.replace(',', '.'))
      if (isNaN(poolPauschaleNum) || poolPauschaleNum < 0) {
        alert('Bitte einen gültigen Pool-Pauschalpreis pro Einheit eingeben')
        return
      }
    }

    // Bei individuellen Tarifen: pro Spieler muss mind. Tarif oder Preis gesetzt sein
    if (!poolMode && individuelleTarife) {
      for (const sid of selectedSpieler) {
        const entry = spielerTarifeMap[sid]
        if (!entry || (!entry.tarif_id && !entry.custom_preis)) {
          const sp = spieler.find(s => s.id === sid)
          alert(`Bitte Tarif oder individuellen Preis fuer ${sp?.name || 'Spieler'} angeben`)
          return
        }
      }
    }

    // spieler_tarife JSON fuer DB aufbauen
    let spielerTarifeJson: Record<string, { tarif_id: string | null, custom_preis: number | null, einheiten?: number }> | null = null
    if (poolMode && selectedSpieler.length > 0) {
      // Im Pool-Modus speichern wir nur einheiten pro Spieler
      spielerTarifeJson = {}
      selectedSpieler.forEach(sid => {
        const raw = poolEinheitenMap[sid]
        const val = raw ? parseFloat(raw.replace(',', '.')) : 1
        spielerTarifeJson![sid] = {
          tarif_id: null,
          custom_preis: null,
          einheiten: !isNaN(val) && val > 0 ? val : 1
        }
      })
    } else if (individuelleTarife && selectedSpieler.length > 0) {
      spielerTarifeJson = {}
      selectedSpieler.forEach(sid => {
        const entry = spielerTarifeMap[sid]
        if (!entry) return
        spielerTarifeJson![sid] = {
          tarif_id: entry.tarif_id || null,
          custom_preis: entry.custom_preis ? parseFloat(entry.custom_preis) : null
        }
      })
    }

    setSaving(true)
    try {
      const trainingData: Record<string, unknown> = {
        user_id: userId,
        datum,
        uhrzeit_von: uhrzeitVon,
        uhrzeit_bis: uhrzeitBis,
        spieler_ids: selectedSpieler,
        entfernte_spieler: entfernteSpieler.length > 0 ? entfernteSpieler : null,
        tarif_id: poolMode ? null : (tarifId || null),
        status,
        notiz: notiz || null,
        name: trainingName || null,
        bar_bezahlt: barBezahlt,
        custom_preis_pro_stunde: poolMode ? null : (customPreis ? parseFloat(customPreis) : null),
        ist_pool: poolMode,
        pool_pauschalpreis_pro_einheit: poolMode ? poolPauschaleNum : null
      }
      // spieler_tarife nur senden wenn wirklich gesetzt (Spalte muss in DB existieren,
      // sonst schlaegt das Speichern fehl. Migration 20260411_spieler_tarife.sql).
      if (spielerTarifeJson) {
        trainingData.spieler_tarife = spielerTarifeJson
      } else if (training?.spieler_tarife) {
        // Wenn Training bereits individuelle Tarife hatte und jetzt deaktiviert wird: auf null setzen
        trainingData.spieler_tarife = null
      }

      // Einmalige Platzgebuehr: nur die noch ausgewaehlten Spieler behalten.
      // Spalte muss in DB existieren (Migration 20260619_platzgebuehr.sql),
      // daher nur senden wenn gesetzt oder vorher gesetzt war.
      const platzgebuehrIds = platzgebuehrSpieler.filter((id) => selectedSpieler.includes(id))
      if (platzgebuehrIds.length > 0) {
        trainingData.platzgebuehr_spieler_ids = platzgebuehrIds
      } else if (training?.platzgebuehr_spieler_ids && training.platzgebuehr_spieler_ids.length > 0) {
        trainingData.platzgebuehr_spieler_ids = null
      }

      // Ausnahme: gelabelte Spieler, die hier ausnahmsweise keine Platzgebuehr
      // zahlen. Spalte muss in DB existieren (Migration 20260627_platzgebuehr_ausnahme.sql).
      const ausnahmeIds = platzgebuehrAusnahme.filter((id) => selectedSpieler.includes(id))
      if (ausnahmeIds.length > 0) {
        trainingData.platzgebuehr_ausnahme_ids = ausnahmeIds
      } else if (training?.platzgebuehr_ausnahme_ids && training.platzgebuehr_ausnahme_ids.length > 0) {
        trainingData.platzgebuehr_ausnahme_ids = null
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
          const { error: updateError } = await supabase.from('trainings').update(trainingData).eq('id', training.id)
          if (updateError) throw updateError

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
      } else if (wiederholen && (wiederholenZeitraum1Bis || wiederholenZeitraum2Bis)) {
        // Create series of trainings across two periods (before and after Sommerferien)
        const serieId = crypto.randomUUID()
        const trainingsToCreate: typeof trainingData[] = []

        const addWeeklyDates = (startDate: Date, endDateStr: string) => {
          const endDate = new Date(endDateStr)
          let current = new Date(startDate)
          while (current <= endDate) {
            trainingsToCreate.push({
              ...trainingData,
              datum: formatDate(current),
              serie_id: serieId
            })
            current.setDate(current.getDate() + 7)
          }
        }

        // Zeitraum 1: vom Training-Datum bis vor Sommerferien
        if (wiederholenZeitraum1Bis) {
          addWeeklyDates(new Date(datum), wiederholenZeitraum1Bis)
        }

        // Zeitraum 2: nach Sommerferien bis vor Herbstferien
        if (wiederholenZeitraum2Von && wiederholenZeitraum2Bis) {
          // Ersten Termin ab Zeitraum2Von finden, der auf den gleichen Wochentag fällt
          const startDayOfWeek = new Date(datum).getDay()
          let zeitraum2Start = new Date(wiederholenZeitraum2Von)
          while (zeitraum2Start.getDay() !== startDayOfWeek) {
            zeitraum2Start.setDate(zeitraum2Start.getDate() + 1)
          }
          addWeeklyDates(zeitraum2Start, wiederholenZeitraum2Bis)
        }

        await supabase.from('trainings').insert(trainingsToCreate)
      } else {
        await supabase.from('trainings').insert(trainingData)
      }

      onSave()
    } catch (err) {
      console.error('Error saving training:', err)
      const msg = (err as { message?: string })?.message
      alert('Fehler beim Speichern' + (msg ? `: ${msg}` : ''))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!training) return

    // Bei proTraining erst Bezahl-Abfrage zeigen
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

          {selectedSpieler.length > 0 && (
            <div className="form-group">
              <label>🎾 Platzgebühr (einmalig für dieses Training)</label>
              <small style={{ color: 'var(--gray-500)', fontSize: 12, display: 'block', marginBottom: 8 }}>
                {PLATZGEBUEHR_PRO_STUNDE},00 € pro Stunde. Spieler mit Label zahlen in der Sommersaison
                automatisch – Haken hier entfernen, um die Platzgebühr ausnahmsweise nur für dieses
                Training wegzunehmen. Spieler ohne Label können einzeln nur für dieses Training aktiviert werden.
              </small>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {selectedSpieler.map((sid) => {
                  const sp = spieler.find((s) => s.id === sid)
                  if (!sp) return null
                  const dauer = Math.max(calculateDuration(uhrzeitVon, uhrzeitBis), 0) *
                    (status === 'durchgefuehrt_halb' ? 0.5 : 1)
                  const betrag = dauer * PLATZGEBUEHR_PRO_STUNDE
                  if (sp.platzgebuehr) {
                    // Spieler mit globalem Label: zahlt in der Sommersaison
                    // automatisch. Haekchen kann fuer dieses eine Training
                    // entfernt werden (Ausnahme), dann faellt die Platzgebuehr weg.
                    const ausgenommen = platzgebuehrAusnahme.includes(sid)
                    return (
                      <label key={sid} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
                        borderRadius: 8, cursor: 'pointer',
                        background: ausgenommen ? 'var(--gray-50)' : 'rgba(16,185,129,0.08)'
                      }}>
                        <input
                          type="checkbox"
                          checked={!ausgenommen}
                          onChange={(e) => {
                            setPlatzgebuehrAusnahme((prev) =>
                              e.target.checked ? prev.filter((x) => x !== sid) : [...prev, sid]
                            )
                          }}
                          style={{ width: 18, height: 18 }}
                        />
                        <span style={{ fontWeight: ausgenommen ? 400 : 500, textDecoration: ausgenommen ? 'line-through' : 'none' }}>{sp.name}</span>
                        {ausgenommen ? (
                          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--gray-500)', fontWeight: 600 }}>
                            ausgenommen
                          </span>
                        ) : (
                          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
                            Label · automatisch {betrag > 0 ? `(${betrag.toFixed(2)} €)` : ''}
                          </span>
                        )}
                      </label>
                    )
                  }
                  const aktiv = platzgebuehrSpieler.includes(sid)
                  return (
                    <label key={sid} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
                      borderRadius: 8, cursor: 'pointer',
                      background: aktiv ? 'rgba(16,185,129,0.08)' : 'var(--gray-50)'
                    }}>
                      <input
                        type="checkbox"
                        checked={aktiv}
                        onChange={(e) => {
                          setPlatzgebuehrSpieler((prev) =>
                            e.target.checked ? [...prev, sid] : prev.filter((x) => x !== sid)
                          )
                        }}
                        style={{ width: 18, height: 18 }}
                      />
                      <span style={{ fontWeight: aktiv ? 600 : 400 }}>{sp.name}</span>
                      {aktiv && betrag > 0 && (
                        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
                          {betrag.toFixed(2)} €
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {poolEnabled && (
            <div className="form-group">
              <label className="checkbox-group">
                <input
                  type="checkbox"
                  checked={poolMode}
                  onChange={(e) => setPoolMode(e.target.checked)}
                />
                Pauschalpreis-Abrechnung (Pauschale pro Spieler × Einheiten)
              </label>
              <small style={{ color: 'var(--gray-500)', fontSize: 12, display: 'block' }}>
                Tarif/Stundenpreis werden ignoriert. Spieler, die mehrfach teilnehmen, bekommen mehr Einheiten.
              </small>
            </div>
          )}

          {poolMode && (
            <div className="form-group">
              <label>Pauschalpreis pro Spieler / Einheit (€) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                value={poolPauschale}
                onChange={(e) => setPoolPauschale(e.target.value)}
                placeholder="z.B. 30"
              />
            </div>
          )}

          {!poolMode && (
            <div className="form-row">
              <div className="form-group">
                <label>Tarif</label>
                <select
                  className="form-control"
                  value={tarifId}
                  onChange={(e) => setTarifId(e.target.value)}
                >
                  <option value="">-- Individuell --</option>
                  {tarife
                    .filter((t) => !t.archiviert || t.id === tarifId)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.preis_pro_stunde} €/h){t.archiviert ? ' · archiviert' : ''}
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
                  <option value="durchgefuehrt_halb">Durchgeführt – 50% (z.B. Regen)</option>
                  <option value="abgesagt">Abgesagt</option>
                </select>
              </div>
            </div>
          )}

          {poolMode && (
            <div className="form-group">
              <label>Status</label>
              <select
                className="form-control"
                value={status}
                onChange={(e) => handleStatusChange(e.target.value as Training['status'])}
              >
                <option value="geplant">Geplant</option>
                <option value="durchgefuehrt">Durchgeführt</option>
                <option value="durchgefuehrt_halb">Durchgeführt – 50% (z.B. Regen)</option>
                <option value="abgesagt">Abgesagt</option>
              </select>
            </div>
          )}

          {!poolMode && !tarifId && !individuelleTarife && (
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

          {!poolMode && selectedSpieler.length >= 2 && (
            <div className="form-group">
              <label className="checkbox-group">
                <input
                  type="checkbox"
                  checked={individuelleTarife}
                  onChange={(e) => setIndividuelleTarife(e.target.checked)}
                />
                Unterschiedliche Tarife pro Spieler
              </label>
            </div>
          )}

          {poolMode && selectedSpieler.length > 0 && (
            <div className="form-group">
              <label>Einheiten pro Spieler</label>
              <small style={{ color: 'var(--gray-500)', fontSize: 12, display: 'block', marginBottom: 8 }}>
                Default 1. Wer mehrfach pro Termin teilnimmt, zahlt entsprechend mehr.
              </small>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectedSpieler.map(sid => {
                  const sp = spieler.find(s => s.id === sid)
                  const raw = poolEinheitenMap[sid] ?? '1'
                  const einheitenNum = parseFloat(raw.replace(',', '.')) || 1
                  const pauschaleNum = parseFloat(poolPauschale.replace(',', '.')) || 0
                  const preis = einheitenNum * pauschaleNum
                  return (
                    <div
                      key={sid}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 10px',
                        background: 'var(--gray-50)',
                        borderRadius: 'var(--radius)'
                      }}
                    >
                      <div style={{ flex: 1, fontWeight: 500 }}>{sp?.name || 'Spieler'}</div>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        className="form-control"
                        style={{ width: 80, padding: '4px 6px', textAlign: 'right' }}
                        value={raw}
                        onChange={(e) =>
                          setPoolEinheitenMap(prev => ({ ...prev, [sid]: e.target.value }))
                        }
                      />
                      <div style={{ minWidth: 90, textAlign: 'right', fontSize: 13, color: 'var(--gray-600)' }}>
                        = {preis.toFixed(2)} €
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {!poolMode && individuelleTarife && selectedSpieler.length > 0 && (
            <div className="form-group">
              <label>Tarife pro Spieler</label>
              <small style={{ color: 'var(--gray-500)', fontSize: 12, display: 'block', marginBottom: 8 }}>
                Jeder Spieler zahlt seinen eigenen Betrag (nicht geteilt).
              </small>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedSpieler.map(sid => {
                  const sp = spieler.find(s => s.id === sid)
                  const entry = spielerTarifeMap[sid] || { tarif_id: '', custom_preis: '' }
                  return (
                    <div
                      key={sid}
                      style={{
                        padding: 10,
                        background: 'var(--gray-50)',
                        borderRadius: 'var(--radius)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>{sp?.name || 'Spieler'}</div>
                      <select
                        className="form-control"
                        value={entry.tarif_id}
                        onChange={(e) => {
                          const v = e.target.value
                          setSpielerTarifeMap(prev => ({
                            ...prev,
                            [sid]: { ...entry, tarif_id: v, custom_preis: v ? '' : entry.custom_preis }
                          }))
                        }}
                      >
                        <option value="">-- Individuell --</option>
                        {tarife
                          .filter(t => !t.archiviert || t.id === entry.tarif_id)
                          .map(t => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.preis_pro_stunde} €/h){t.archiviert ? ' · archiviert' : ''}
                            </option>
                          ))}
                      </select>
                      {!entry.tarif_id && (
                        <input
                          type="number"
                          className="form-control"
                          value={entry.custom_preis}
                          placeholder="Individueller Preis pro Stunde (€)"
                          onChange={(e) => {
                            const v = e.target.value
                            setSpielerTarifeMap(prev => ({
                              ...prev,
                              [sid]: { ...entry, custom_preis: v }
                            }))
                          }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
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
                <>
                  <div className="form-group">
                    <label style={{ fontWeight: 600, marginBottom: 4 }}>
                      Zeitraum 1 – bis vor Sommerferien
                    </label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ whiteSpace: 'nowrap', fontSize: 13, color: '#666' }}>von {datum}</span>
                      <span style={{ color: '#666' }}>bis</span>
                      <input
                        type="date"
                        className="form-control"
                        value={wiederholenZeitraum1Bis}
                        onChange={(e) => setWiederholenZeitraum1Bis(e.target.value)}
                        min={datum}
                        style={{ flex: 1 }}
                      />
                    </div>
                    <small style={{ color: '#888' }}>Sommerferien Berlin 2026: 09.07. – 22.08.</small>
                  </div>

                  <div className="form-group">
                    <label style={{ fontWeight: 600, marginBottom: 4 }}>
                      Zeitraum 2 – nach Sommerferien bis vor Herbstferien
                    </label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="date"
                        className="form-control"
                        value={wiederholenZeitraum2Von}
                        onChange={(e) => setWiederholenZeitraum2Von(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <span style={{ color: '#666' }}>bis</span>
                      <input
                        type="date"
                        className="form-control"
                        value={wiederholenZeitraum2Bis}
                        onChange={(e) => setWiederholenZeitraum2Bis(e.target.value)}
                        style={{ flex: 1 }}
                      />
                    </div>
                    <small style={{ color: '#888' }}>Herbstferien Berlin 2026: 19.10. – 31.10.</small>
                  </div>
                </>
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
  onUpdate,
  userId
}: {
  spieler: Spieler[]
  tarife: Tarif[]
  onUpdate: () => void
  userId: string
}) {
  const [activeSubTab, setActiveSubTab] = useState<'spieler' | 'tarife'>('spieler')
  const [showSpielerModal, setShowSpielerModal] = useState(false)
  const [showTarifModal, setShowTarifModal] = useState(false)
  const [editingSpieler, setEditingSpieler] = useState<Spieler | null>(null)
  const [editingTarif, setEditingTarif] = useState<Tarif | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showArchivierteTarife, setShowArchivierteTarife] = useState(false)

  const filteredSpieler = useMemo(() => {
    if (!searchTerm) return spieler
    const term = searchTerm.toLowerCase()
    return spieler.filter((s) => s.name.toLowerCase().includes(term))
  }, [spieler, searchTerm])

  const aktiveTarife = useMemo(() => tarife.filter((t) => !t.archiviert), [tarife])
  const archivierteTarife = useMemo(() => tarife.filter((t) => t.archiviert), [tarife])

  // Tarif direkt (ent-)archivieren ohne Modal.
  const toggleTarifArchiviert = async (t: Tarif) => {
    await supabase.from('tarife').update({ archiviert: !t.archiviert }).eq('id', t.id)
    onUpdate()
  }

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
          Tarife ({aktiveTarife.length})
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
              placeholder="Suche nach Name..."
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
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredSpieler.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
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
                    <td colSpan={2} className="empty-state">
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
                {aktiveTarife.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.preis_pro_stunde} €</td>
                    <td>
                      {t.abrechnung === 'proTraining' ? 'Pro Training' : 'Monatlich'}
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
                {aktiveTarife.length === 0 && (
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
            {aktiveTarife.map((t) => (
              <div key={t.id} className="mobile-card">
                <div className="mobile-card-header">
                  <div className="mobile-card-title">{t.name}</div>
                  <div className="mobile-card-subtitle">{t.preis_pro_stunde} €/h</div>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Abrechnung</span>
                    <span className="mobile-card-value">
                      {t.abrechnung === 'proTraining' ? 'Pro Training' : 'Monatlich'}
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
            {aktiveTarife.length === 0 && (
              <div className="empty-state">Keine Tarife angelegt</div>
            )}
          </div>

          {/* Archivierte Tarife */}
          {archivierteTarife.length > 0 && (
            <div style={{ marginTop: 20, borderTop: '1px solid var(--gray-200)', paddingTop: 16 }}>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setShowArchivierteTarife((v) => !v)}
              >
                {showArchivierteTarife ? '▾' : '▸'} Archivierte Tarife ({archivierteTarife.length})
              </button>
              {showArchivierteTarife && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <small style={{ color: 'var(--gray-500)', fontSize: 12 }}>
                    Archivierte Tarife bleiben gespeichert – alte Trainings und Abrechnungen behalten
                    ihren Preis. Sie erscheinen nur nicht mehr in der Auswahl bei neuen Trainings.
                  </small>
                  {archivierteTarife.map((t) => (
                    <div key={t.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                      borderRadius: 8, background: 'var(--gray-50)'
                    }}>
                      <span style={{ fontWeight: 500, color: 'var(--gray-600)' }}>{t.name}</span>
                      <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                        {t.preis_pro_stunde} €/h · {t.abrechnung === 'proTraining' ? 'Pro Training' : 'Monatlich'}
                      </span>
                      <button
                        className="btn btn-sm btn-primary"
                        style={{ marginLeft: 'auto' }}
                        onClick={() => toggleTarifArchiviert(t)}
                      >
                        Wieder aktivieren
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Spieler Modal */}
      {showSpielerModal && (
        <SpielerModal
          spieler={editingSpieler}
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
    </div>
  )
}

// ============ SPIELER MODAL ============
function SpielerModal({
  spieler,
  userId,
  onClose,
  onSave
}: {
  spieler: Spieler | null
  userId: string
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState(spieler?.name || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Name ist erforderlich')
      return
    }

    setSaving(true)
    try {
      const data = { user_id: userId, name: name.trim() }

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
              autoFocus
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
  const [saving, setSaving] = useState(false)
  const istArchiviert = !!tarif?.archiviert

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
        beschreibung: beschreibung || null
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

  // Soft-Delete: archivieren statt loeschen, damit alte Trainings/Abrechnungen,
  // die diesen Tarif verwenden, weiterhin korrekt berechnet werden. Reversibel.
  const handleArchivieren = async () => {
    if (!tarif) return
    if (!istArchiviert) {
      const confirmed = await showConfirm(
        'Tarif archivieren',
        'Tarif archivieren? Er verschwindet aus der Auswahl bei neuen Trainings. Alte Trainings und Abrechnungen bleiben unveraendert. Du kannst ihn jederzeit wieder aktivieren.'
      )
      if (!confirmed) return
    }
    setSaving(true)
    try {
      await supabase.from('tarife').update({ archiviert: !istArchiviert }).eq('id', tarif.id)
      onSave()
    } catch (err) {
      console.error('Error archiving tarif:', err)
      alert('Fehler beim Archivieren')
    } finally {
      setSaving(false)
    }
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
            <label>Preis pro Stunde (€) *</label>
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
          <div className="form-group">
            <label>Abrechnungsart</label>
            <select
              className="form-control"
              value={abrechnung}
              onChange={(e) => setAbrechnung(e.target.value as Tarif['abrechnung'])}
            >
              <option value="proTraining">Pro Training</option>
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
            <button className="btn btn-secondary" onClick={handleArchivieren} disabled={saving}>
              {istArchiviert ? 'Wieder aktivieren' : 'Archivieren'}
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
// ============ LEXOFFICE RECHNUNG MODAL ============
// Verknuepft den Spieler mit einem Lexoffice-Kontakt (Rechnungsempfaenger,
// i.d.R. das Elternteil) und legt eine Rechnung mit den uebergebenen Positionen
// an. Versand passiert danach in Lexoffice selbst (die API kann nicht mailen) –
// wir oeffnen den Permalink.
function LexofficeRechnungModal({
  spieler,
  lineItems,
  monthStr,
  shippingStart,
  shippingEnd,
  onClose,
  onSaved,
  onInvoiced
}: {
  spieler: Spieler
  lineItems: LexofficeLineItem[]
  monthStr: string
  shippingStart: string
  shippingEnd: string
  onClose: () => void
  onSaved: () => void
  onInvoiced: () => void | Promise<void>
}) {
  const [contactId, setContactId] = useState<string | null>(spieler.lexoffice_contact_id ?? null)
  const [contactName, setContactName] = useState<string | null>(spieler.lexoffice_contact_name ?? null)
  const [query, setQuery] = useState(spieler.name.trim().split(/\s+/).pop() || spieler.name)
  const [results, setResults] = useState<LexofficeContact[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  const [taxRate, setTaxRate] = useState(19)
  const [finalize, setFinalize] = useState(false)
  const [creating, setCreating] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; permalink?: string; error?: string } | null>(null)

  const total = lineItems.reduce((s, li) => s + li.amount * (li.quantity ?? 1), 0)

  // "2026-05" -> "Mai 2026" fuer den Einleitungstext
  const monthLabel = (() => {
    const names = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
    const [y, m] = monthStr.split('-').map(Number)
    return names[m - 1] ? `${names[m - 1]} ${y}` : monthStr
  })()
  const introductionText = `Für das Tennistraining im ${monthLabel} stelle ich Ihnen vereinbarungsgemäß folgende Leistungen in Rechnung:`
  const [intro, setIntro] = useState(introductionText)

  const doSearch = async () => {
    setSearching(true); setSearchError(null)
    const r = await searchLexofficeContacts(query)
    setSearching(false)
    if (!r.ok) { setSearchError(r.error || 'Suche fehlgeschlagen.'); return }
    setResults(r.contacts || [])
  }

  // Beim Oeffnen den verknuepften Empfaenger IMMER frisch aus der DB laden.
  // Der uebergebene spieler-Snapshot kann je nach Reload-Timing veraltet sein –
  // daher war der Empfaenger "mal vorausgewaehlt, mal nicht". Die DB ist die
  // verlaessliche Quelle. Nur wenn wirklich keiner hinterlegt ist, automatisch
  // nach dem Nachnamen suchen.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('spieler')
        .select('lexoffice_contact_id, lexoffice_contact_name')
        .eq('id', spieler.id)
        .maybeSingle()
      if (cancelled) return
      if (data?.lexoffice_contact_id) {
        setContactId(data.lexoffice_contact_id)
        setContactName(data.lexoffice_contact_name ?? null)
      } else if (!spieler.lexoffice_contact_id) {
        doSearch()
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const linkContact = async (c: LexofficeContact) => {
    setLinking(true)
    // .select() zurueckholen: eine erfolgreiche Query, die aber 0 Zeilen aendert
    // (z.B. RLS/Berechtigung in der geteilten DB), wuerde sonst faelschlich als
    // gespeichert gelten – und der Empfaenger waere naechsten Monat wieder weg.
    const { data, error } = await supabase
      .from('spieler')
      .update({ lexoffice_contact_id: c.id, lexoffice_contact_name: c.name })
      .eq('id', spieler.id)
      .select('id')
    setLinking(false)
    if (error) { setSearchError('Speichern fehlgeschlagen: ' + error.message); return }
    if (!data || data.length === 0) {
      setSearchError('Rechnungsempfänger konnte nicht dauerhaft gespeichert werden (keine Berechtigung?).')
      return
    }
    setContactId(c.id); setContactName(c.name); setResults(null)
    onSaved()
  }

  const unlink = async () => {
    setLinking(true)
    await supabase.from('spieler')
      .update({ lexoffice_contact_id: null, lexoffice_contact_name: null })
      .eq('id', spieler.id)
    setLinking(false)
    setContactId(null); setContactName(null)
    onSaved(); doSearch()
  }

  const create = async () => {
    if (!contactId) return
    setCreating(true); setResult(null)
    // Tab schon JETZT (waehrend des Klicks) oeffnen, sonst blockiert Safari/Mac
    // das spaetere Oeffnen nach dem await als Popup. Nach Erfolg leiten wir den
    // leeren Tab auf den Lexoffice-Permalink um, sonst schliessen wir ihn wieder.
    const win = window.open('', '_blank')
    const r = await createLexofficeInvoice({
      contactId,
      lineItems,
      finalize,
      taxType: 'gross',
      taxRatePercentage: taxRate,
      shippingStart,
      shippingEnd,
      title: 'Rechnung',
      introduction: intro
    })
    setCreating(false)
    setResult(r)
    if (r.ok) {
      if (r.permalink && win) win.location.href = r.permalink
      else if (win) win.close()
      // Rechnung erstellt -> berechnete (offene) Trainings auf "ausstehend"
      try { await onInvoiced() } catch { /* nicht blockierend */ }
      // Fertig: Modal schliessen und zurueck zur Abrechnung. Die neue Rechnung
      // ist bereits im Lexoffice-Tab geoeffnet.
      onClose()
    } else if (win) {
      win.close()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Lexoffice-Rechnung – {spieler.name}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {/* Empfaenger */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 600, fontSize: 14 }}>Rechnungsempfänger (Lexoffice-Kontakt)</label>
            {contactId ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <span style={{ padding: '6px 10px', background: 'var(--gray-100)', borderRadius: 6 }}>✓ {contactName}</span>
                <button className="btn btn-secondary" disabled={linking} onClick={unlink}>ändern</button>
              </div>
            ) : (
              <div style={{ marginTop: 6 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') doSearch() }}
                    placeholder="Nachname suchen…"
                    style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid var(--gray-300)' }}
                  />
                  <button className="btn btn-secondary" disabled={searching} onClick={doSearch}>
                    {searching ? '…' : 'Suchen'}
                  </button>
                </div>
                {searchError && <div style={{ color: 'var(--danger, #c00)', fontSize: 13, marginTop: 6 }}>{searchError}</div>}
                {results && results.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 6 }}>
                    Kein Kontakt gefunden. In Lexoffice anlegen, dann erneut suchen.
                  </div>
                )}
                {results && results.length > 0 && (
                  <div style={{ marginTop: 8, display: 'grid', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                    {results.map(c => (
                      <button
                        key={c.id}
                        className="btn btn-secondary"
                        disabled={linking}
                        onClick={() => linkContact(c)}
                        style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                      >
                        <span>
                          <strong>{c.name}</strong>
                          <span style={{ display: 'block', fontSize: 12, color: 'var(--gray-600)' }}>
                            {c.address ? `${c.address.street}, ${c.address.zip} ${c.address.city}` : (c.email || 'keine Adresse')}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Einleitungstext */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 600, fontSize: 14 }}>Einleitungstext</label>
            <textarea
              value={intro}
              onChange={e => setIntro(e.target.value)}
              rows={2}
              style={{ width: '100%', marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>

          {/* Positionen */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 600, fontSize: 14 }}>Positionen ({lineItems.length})</label>
            {lineItems.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 6 }}>
                Keine offenen Trainings in diesem Monat – nichts zu berechnen.
              </div>
            ) : (
              <div style={{ marginTop: 6, fontSize: 13 }}>
                {lineItems.map((li, i) => {
                  const qty = li.quantity ?? 1
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--gray-100)' }}>
                      <span>{li.name} <span style={{ color: 'var(--gray-600)' }}>({qty} × {li.amount.toFixed(2)} €)</span></span>
                      <span>{(li.amount * qty).toFixed(2)} €</span>
                    </div>
                  )
                })}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, fontWeight: 700 }}>
                  <span>Gesamt (brutto)</span>
                  <span>{total.toFixed(2)} €</span>
                </div>
              </div>
            )}
          </div>

          {/* Steuer + Modus */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 14 }}>
              USt %:{' '}
              <input
                type="number"
                value={taxRate}
                onChange={e => setTaxRate(Number(e.target.value))}
                style={{ width: 64, padding: 6, borderRadius: 6, border: '1px solid var(--gray-300)' }}
              />
            </label>
            <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={finalize} onChange={e => setFinalize(e.target.checked)} />
              direkt finalisieren (sonst Entwurf)
            </label>
          </div>

          {result && (
            <div style={{ marginTop: 14, padding: 10, borderRadius: 6, background: result.ok ? 'var(--gray-100)' : '#fde8e8' }}>
              {result.ok
                ? <>✓ Rechnung {finalize ? 'angelegt' : 'als Entwurf angelegt'}. {result.permalink && <a href={result.permalink} target="_blank" rel="noreferrer">In Lexoffice öffnen</a>}</>
                : <>Fehler: {result.error}</>}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button
            className="btn btn-primary"
            disabled={!contactId || lineItems.length === 0 || creating}
            onClick={create}
          >
            {creating ? 'Wird angelegt…' : (finalize ? 'Rechnung anlegen' : 'Entwurf in Lexoffice anlegen')}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  )
}

// ============ PLATZGEBÜHR (Sommersaison Mai–September) ============
// Erwachsene Spieler mit dem Label `platzgebuehr` zahlen pro gegebener
// Trainingsstunde eine Platzgebuehr. Halb durchgefuehrte Trainings zaehlen
// als halbe Stunden. Berechnung pro gelabeltem Spieler pro Stunde.
const PLATZGEBUEHR_PRO_STUNDE = 5
const SOMMER_MONATE = [5, 6, 7, 8, 9] // Mai bis September
const MONATSNAMEN: Record<number, string> = {
  1: 'Januar', 2: 'Februar', 3: 'März', 4: 'April', 5: 'Mai', 6: 'Juni',
  7: 'Juli', 8: 'August', 9: 'September', 10: 'Oktober', 11: 'November', 12: 'Dezember'
}

function PlatzgebuehrView({
  trainings,
  spieler,
  onUpdate
}: {
  trainings: Training[]
  spieler: Spieler[]
  onUpdate: () => void
}) {
  const currentYear = new Date().getFullYear()
  const [jahr, setJahr] = useState<number>(currentYear)
  const [selectedSpielerId, setSelectedSpielerId] = useState<string>('')
  const [showVerwaltung, setShowVerwaltung] = useState(false)
  const [verwaltungSuche, setVerwaltungSuche] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  // Auswahl der Jahre: alle Jahre mit Sommer-Trainings + aktuelles Jahr
  const verfuegbareJahre = useMemo(() => {
    const set = new Set<number>([currentYear])
    trainings.forEach((t) => {
      const [y, m] = t.datum.split('-').map(Number)
      if (SOMMER_MONATE.includes(m)) set.add(y)
    })
    return Array.from(set).sort((a, b) => b - a)
  }, [trainings, currentYear])

  const platzSpielerIds = useMemo(
    () => new Set(spieler.filter((s) => s.platzgebuehr).map((s) => s.id)),
    [spieler]
  )

  // Eine Zeile pro gelabeltem Spieler pro Training in der Sommersaison.
  type PlatzRow = {
    training: Training
    spieler: Spieler
    monat: number
    stunden: number
    betrag: number
    einmalig: boolean // einmalige Platzgebuehr (ohne globales Label)
  }
  const rows = useMemo<PlatzRow[]>(() => {
    const result: PlatzRow[] = []
    trainings.forEach((t) => {
      const [y, m] = t.datum.split('-').map(Number)
      if (y !== jahr) return
      if (t.status !== 'durchgefuehrt' && t.status !== 'durchgefuehrt_halb') return
      const halbFaktor = t.status === 'durchgefuehrt_halb' ? 0.5 : 1
      const dauer = calculateDuration(t.uhrzeit_von, t.uhrzeit_bis)
      const stunden = Math.max(dauer, 0) * halbFaktor
      if (stunden <= 0) return
      const einmaligIds = Array.isArray(t.platzgebuehr_spieler_ids) ? t.platzgebuehr_spieler_ids : []
      const ausnahmeIds = Array.isArray(t.platzgebuehr_ausnahme_ids) ? t.platzgebuehr_ausnahme_ids : []
      t.spieler_ids.forEach((sid) => {
        // Gelabelte Spieler nur in der Sommersaison; einmalige Platzgebuehr
        // gilt unabhaengig vom Monat (explizit am Training gesetzt).
        // Ausnahme: gelabelter Spieler, der fuer dieses Training befreit wurde.
        const istLabelSommer = platzSpielerIds.has(sid) && SOMMER_MONATE.includes(m) && !ausnahmeIds.includes(sid)
        const istEinmalig = einmaligIds.includes(sid)
        if (!istLabelSommer && !istEinmalig) return
        const sp = spieler.find((s) => s.id === sid)
        if (!sp) return
        result.push({
          training: t,
          spieler: sp,
          monat: m,
          stunden,
          betrag: stunden * PLATZGEBUEHR_PRO_STUNDE,
          einmalig: !istLabelSommer && istEinmalig
        })
      })
    })
    // chronologisch sortieren
    result.sort((a, b) => {
      const d = a.training.datum.localeCompare(b.training.datum)
      if (d !== 0) return d
      return a.training.uhrzeit_von.localeCompare(b.training.uhrzeit_von)
    })
    return result
  }, [trainings, jahr, platzSpielerIds, spieler])

  // Summen pro Monat: immer alle 5 Sommermonate (auch mit 0) + zusaetzliche
  // Monate, falls dort einmalige Platzgebuehren ausserhalb der Saison anfallen.
  const monatsSummen = useMemo(() => {
    const monate = Array.from(new Set([...SOMMER_MONATE, ...rows.map((r) => r.monat)]))
      .sort((a, b) => a - b)
    return monate.map((m) => {
      const mRows = rows.filter((r) => r.monat === m)
      return {
        monat: m,
        stunden: mRows.reduce((s, r) => s + r.stunden, 0),
        betrag: mRows.reduce((s, r) => s + r.betrag, 0),
        anzahl: mRows.length
      }
    })
  }, [rows])

  // Summen pro Spieler
  const spielerSummen = useMemo(() => {
    const map = new Map<string, { spieler: Spieler; stunden: number; betrag: number; anzahl: number }>()
    rows.forEach((r) => {
      const cur = map.get(r.spieler.id) || { spieler: r.spieler, stunden: 0, betrag: 0, anzahl: 0 }
      cur.stunden += r.stunden
      cur.betrag += r.betrag
      cur.anzahl += 1
      map.set(r.spieler.id, cur)
    })
    return Array.from(map.values()).sort((a, b) => b.betrag - a.betrag)
  }, [rows])

  const gesamtBetrag = rows.reduce((s, r) => s + r.betrag, 0)
  const gesamtStunden = rows.reduce((s, r) => s + r.stunden, 0)

  // Detailzeilen ggf. nach gewaehltem Spieler filtern
  const detailRows = selectedSpielerId
    ? rows.filter((r) => r.spieler.id === selectedSpielerId)
    : rows

  const fmtStd = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 })

  const togglePlatzgebuehr = async (sp: Spieler) => {
    setSavingId(sp.id)
    const { error } = await supabase
      .from('spieler')
      .update({ platzgebuehr: !sp.platzgebuehr })
      .eq('id', sp.id)
    if (error) {
      console.error('Platzgebuehr-Label speichern fehlgeschlagen:', error)
      alert('Speichern fehlgeschlagen: ' + error.message)
    }
    setSavingId(null)
    onUpdate()
  }

  const gefilterteVerwaltung = spieler
    .filter((s) => s.name.toLowerCase().includes(verwaltungSuche.toLowerCase()))
    .sort((a, b) => {
      // Gelabelte zuerst, dann alphabetisch
      if (!!a.platzgebuehr !== !!b.platzgebuehr) return a.platzgebuehr ? -1 : 1
      return a.name.localeCompare(b.name)
    })

  return (
    <div>
      <div className="view-header" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>🎾 Platzgebühr</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--gray-600)', fontSize: 14 }}>
          Sommersaison 1. Mai – 30. September · {PLATZGEBUEHR_PRO_STUNDE},00 € pro Trainingsstunde
        </p>
      </div>

      {/* Stat-Kacheln */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Platzgebühr gesamt {jahr}</div>
          <div className="stat-value" style={{ color: '#1E293B' }}>{gesamtBetrag.toFixed(2)} €</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Stunden gesamt</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{fmtStd(gesamtStunden)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Spieler mit Platzgebühr</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{spielerSummen.length}</div>
        </div>
      </div>

      {/* Jahr-Auswahl + Verwaltung-Button */}
      <div className="card">
        <div className="card-header">
          <div className="card-header-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              className="form-control"
              value={jahr}
              onChange={(e) => { setJahr(Number(e.target.value)); setSelectedSpielerId('') }}
              style={{ width: 'auto', minWidth: 120 }}
            >
              {verfuegbareJahre.map((y) => (
                <option key={y} value={y}>Saison {y}</option>
              ))}
            </select>
            {selectedSpielerId && (
              <button className="btn btn-sm btn-secondary" onClick={() => setSelectedSpielerId('')}>
                Filter aufheben ✕
              </button>
            )}
            <button
              className="btn btn-sm btn-secondary"
              style={{ marginLeft: 'auto' }}
              onClick={() => setShowVerwaltung((v) => !v)}
            >
              {showVerwaltung ? 'Spieler-Labels ausblenden' : 'Spieler-Labels verwalten'}
            </button>
          </div>
        </div>

        {/* Verwaltung: wer zahlt Platzgebühr (schreibt direkt auf Supabase) */}
        {showVerwaltung && (
          <div style={{ padding: 16, borderTop: '1px solid var(--gray-200)' }}>
            <p style={{ margin: '0 0 12px', color: 'var(--gray-600)', fontSize: 13 }}>
              Markierte Spieler zahlen in der Sommersaison Platzgebühr. Änderungen werden
              sofort gespeichert.
            </p>
            <input
              type="text"
              className="form-control"
              placeholder="Spieler suchen..."
              value={verwaltungSuche}
              onChange={(e) => setVerwaltungSuche(e.target.value)}
              style={{ marginBottom: 12, maxWidth: 280 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflowY: 'auto' }}>
              {gefilterteVerwaltung.map((sp) => (
                <label
                  key={sp.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                    borderRadius: 8, cursor: 'pointer',
                    background: sp.platzgebuehr ? 'rgba(16,185,129,0.08)' : 'var(--gray-50)',
                    opacity: savingId === sp.id ? 0.5 : 1
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!sp.platzgebuehr}
                    disabled={savingId === sp.id}
                    onChange={() => togglePlatzgebuehr(sp)}
                    style={{ width: 18, height: 18 }}
                  />
                  <span style={{ fontWeight: sp.platzgebuehr ? 600 : 400 }}>{sp.name}</span>
                  {sp.platzgebuehr && (
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
                      Platzgebühr
                    </span>
                  )}
                </label>
              ))}
              {gefilterteVerwaltung.length === 0 && (
                <div className="empty-state">Kein Spieler gefunden</div>
              )}
            </div>
          </div>
        )}
      </div>

      {platzSpielerIds.size === 0 && rows.length === 0 ? (
        <div className="card" style={{ padding: 24 }}>
          <div className="empty-state">
            Noch kein Spieler für Platzgebühr markiert.<br />
            Über „Spieler-Labels verwalten" die erwachsenen Spieler markieren –
            oder im Training eine einmalige Platzgebühr setzen.
          </div>
        </div>
      ) : (
        <>
          {/* Monatsübersicht */}
          <div className="card">
            <div className="card-header"><h3 style={{ margin: 0 }}>Pro Monat</h3></div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Monat</th>
                    <th style={{ textAlign: 'right' }}>Stunden</th>
                    <th style={{ textAlign: 'right' }}>Einheiten</th>
                    <th style={{ textAlign: 'right' }}>Platzgebühr</th>
                  </tr>
                </thead>
                <tbody>
                  {monatsSummen.map((m) => (
                    <tr key={m.monat}>
                      <td style={{ fontWeight: 500 }}>{MONATSNAMEN[m.monat]} {jahr}</td>
                      <td style={{ textAlign: 'right' }}>{fmtStd(m.stunden)}</td>
                      <td style={{ textAlign: 'right' }}>{m.anzahl}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{m.betrag.toFixed(2)} €</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ fontWeight: 700 }}>Gesamt</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtStd(gesamtStunden)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{rows.length}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{gesamtBetrag.toFixed(2)} €</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Spieler-Übersicht */}
          <div className="card">
            <div className="card-header"><h3 style={{ margin: 0 }}>Pro Spieler</h3></div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Spieler</th>
                    <th style={{ textAlign: 'right' }}>Stunden</th>
                    <th style={{ textAlign: 'right' }}>Einheiten</th>
                    <th style={{ textAlign: 'right' }}>Platzgebühr</th>
                  </tr>
                </thead>
                <tbody>
                  {spielerSummen.map((s) => (
                    <tr
                      key={s.spieler.id}
                      onClick={() => setSelectedSpielerId(selectedSpielerId === s.spieler.id ? '' : s.spieler.id)}
                      style={{
                        cursor: 'pointer',
                        background: selectedSpielerId === s.spieler.id ? 'var(--gray-100)' : undefined
                      }}
                      title="Stunden dieses Spielers anzeigen"
                    >
                      <td style={{ color: 'var(--primary)', fontWeight: 500 }}>{s.spieler.name}</td>
                      <td style={{ textAlign: 'right' }}>{fmtStd(s.stunden)}</td>
                      <td style={{ textAlign: 'right' }}>{s.anzahl}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{s.betrag.toFixed(2)} €</td>
                    </tr>
                  ))}
                  {spielerSummen.length === 0 && (
                    <tr><td colSpan={4} className="empty-state">Keine Platzgebühr-Stunden in dieser Saison</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailliste pro Stunde */}
          <div className="card">
            <div className="card-header">
              <h3 style={{ margin: 0 }}>
                Einzelne Stunden{selectedSpielerId ? ` · ${spieler.find((s) => s.id === selectedSpielerId)?.name}` : ''}
              </h3>
            </div>

            {/* Desktop */}
            <div className="table-container desktop-table">
              <table>
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Uhrzeit</th>
                    <th>Spieler</th>
                    <th style={{ textAlign: 'right' }}>Stunden</th>
                    <th style={{ textAlign: 'right' }}>Platzgebühr</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((r, i) => (
                    <tr key={r.training.id + r.spieler.id + i}>
                      <td>{formatDateGerman(r.training.datum)}</td>
                      <td>{formatTime(r.training.uhrzeit_von)}–{formatTime(r.training.uhrzeit_bis)}</td>
                      <td style={{ color: 'var(--primary)' }}>
                        {r.spieler.name}
                        {r.training.status === 'durchgefuehrt_halb' && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--gray-500)' }}>(halb)</span>
                        )}
                        {r.einmalig && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--pay-ausstehend, #d97706)' }}>(einmalig)</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>{fmtStd(r.stunden)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{r.betrag.toFixed(2)} €</td>
                    </tr>
                  ))}
                  {detailRows.length === 0 && (
                    <tr><td colSpan={5} className="empty-state">Keine Stunden</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="mobile-card-list">
              {detailRows.map((r, i) => (
                <div key={r.training.id + r.spieler.id + i} className="mobile-card">
                  <div className="mobile-card-header">
                    <div>
                      <div className="mobile-card-title" style={{ color: 'var(--primary)' }}>{r.spieler.name}</div>
                      <div className="mobile-card-subtitle">
                        {formatDateGerman(r.training.datum)} · {formatTime(r.training.uhrzeit_von)}–{formatTime(r.training.uhrzeit_bis)}
                        {r.training.status === 'durchgefuehrt_halb' && ' (halb)'}
                        {r.einmalig && ' (einmalig)'}
                      </div>
                    </div>
                    <span className="mobile-card-value" style={{ fontWeight: 600 }}>{r.betrag.toFixed(2)} €</span>
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Stunden</span>
                      <span className="mobile-card-value">{fmtStd(r.stunden)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {detailRows.length === 0 && (
                <div className="empty-state">Keine Stunden</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function AbrechnungView({
  trainings,
  spieler,
  tarife,
  adjustments,
  spielerPayments,
  setSpielerPayments,
  onUpdate,
  onNavigateToTraining,
  userId,
  lexofficeEnabled
}: {
  trainings: Training[]
  spieler: Spieler[]
  tarife: Tarif[]
  adjustments: MonthlyAdjustment[]
  spielerPayments: SpielerTrainingPayment[]
  setSpielerPayments: React.Dispatch<React.SetStateAction<SpielerTrainingPayment[]>>
  onUpdate: () => void
  onNavigateToTraining: (training: Training) => void
  userId: string
  lexofficeEnabled: boolean
}) {
  const [selectedMonth, setSelectedMonth] = useState(() => localStorage.getItem('abrechnung_monat') || getMonthString(new Date()))
  const [filter, setFilter] = useState<'alle' | 'bezahlt' | 'offen' | 'ausstehend' | 'bar'>(
    () => (localStorage.getItem('abrechnung_filter') as 'alle' | 'bezahlt' | 'offen' | 'ausstehend' | 'bar') || 'alle'
  )
  const [selectedSpielerId, setSelectedSpielerId] = useState<string>('')
  const [spielerSuche, setSpielerSuche] = useState('')
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [selectedSpielerDetail, setSelectedSpielerDetail] = useState<string | null>(null)
  // Welche Statistik-Kachel ist zur Aufschluesselung geoeffnet (null = keine)
  const [statBreakdown, setStatBreakdown] = useState<'total' | 'bar' | 'bezahlt' | 'ausstehend' | 'offen' | null>(null)

  // Monat + Status-Filter merken, damit der Tab beim Zurueckkommen den letzten
  // Stand zeigt statt auf aktuellen Monat / "Alle" zurueckzuspringen.
  useEffect(() => { localStorage.setItem('abrechnung_monat', selectedMonth) }, [selectedMonth])
  useEffect(() => { localStorage.setItem('abrechnung_filter', filter) }, [filter])
  const [showKorrekturModal, setShowKorrekturModal] = useState<string | null>(null)
  const [korrekturBetrag, setKorrekturBetrag] = useState('')
  const [korrekturGrund, setKorrekturGrund] = useState('')
  const [korrekturSaving, setKorrekturSaving] = useState(false)
  const [showTrainingKorrekturModal, setShowTrainingKorrekturModal] = useState<Training | null>(null)
  const [trainingKorrekturBetrag, setTrainingKorrekturBetrag] = useState('')
  const [trainingKorrekturGrund, setTrainingKorrekturGrund] = useState('')
  // Bulk-Auswahl für Trainings eines Spielers
  const [selectedTrainingsForBulk, setSelectedTrainingsForBulk] = useState<Set<string>>(new Set())
  // Lexoffice-Rechnung: Daten fuer das Rechnungs-Modal (null = geschlossen)
  const [lexofficeData, setLexofficeData] = useState<null | {
    spieler: Spieler
    lineItems: LexofficeLineItem[]
    monthStr: string
    shippingStart: string
    shippingEnd: string
  }>(null)

  const monthTrainings = useMemo(() => {
    return trainings.filter((t) => {
      const tMonth = t.datum.substring(0, 7)
      if (tMonth !== selectedMonth) return false

      // Durchgeführte Trainings (auch 50%) immer einbeziehen
      if (t.status === 'durchgefuehrt' || t.status === 'durchgefuehrt_halb') return true

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
      const entfernteMitBezahlung = (t.entfernte_spieler || []).filter(es => es.muss_bezahlen)
      // Abrechnungsart des Trainings (nur fuer Fallback bei entfernten Spielern)
      const tarif = tarife.find((ta) => ta.id === t.tarif_id)
      const abrechnungsart = tarif?.abrechnung || 'proTraining'

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

        // Preis mit Helper berechnen (beruecksichtigt individuelle Tarife pro Spieler)
        const calc = calculateSpielerPreisForTraining(t, spielerId, tarife)
        let spielerPreis = 0

        if (calc.abrechnungsart === 'monatlich') {
          // Monatlicher Tarif: nur einmal pro Tarif pro Spieler pro Monat berechnen
          const monatlichKey = calc.tarifId || t.id
          if (!summary[spielerId].monatlicheSerien.has(monatlichKey)) {
            summary[spielerId].monatlicheSerien.add(monatlichKey)
            spielerPreis = calc.spielerPreis
          }
        } else {
          spielerPreis = calc.spielerPreis
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

      // Entfernte Spieler mit Bezahlpflicht (nur bei proTraining)
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

          // Preis mit Helper berechnen (beruecksichtigt individuelle Tarife)
          const calcEntfernt = calculateSpielerPreisForTraining(t, spielerId, tarife)
          const spielerPreis = calcEntfernt.spielerPreis

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

  const summaryBeforeStatus = useMemo(() => {
    let result = spielerSummary

    // Bei Tag-Filter: Zeige nur Trainings des Tages mit korrekten Tages-Summen
    if (selectedTag) {
      result = result
        .filter(s => s.trainings.some(t => t.datum === selectedTag))
        .map(s => {
          const tagTrainings = s.trainings.filter(t => t.datum === selectedTag)

          // Bestimme welches Training das ERSTE des Monats für jeden monatlichen Tarif ist
          const alleTrainingsSortiert = [...s.trainings].sort((a, b) => a.datum.localeCompare(b.datum))
          const monatlicheErstesTraining = new Map<string, string>() // tarifKey -> erstes training.id
          alleTrainingsSortiert.forEach(t => {
            const calc = calculateSpielerPreisForTraining(t, s.spieler.id, tarife)
            if (calc.abrechnungsart === 'monatlich') {
              const monatlichKey = calc.tarifId || t.id
              if (!monatlicheErstesTraining.has(monatlichKey)) {
                monatlicheErstesTraining.set(monatlichKey, t.id)
              }
            }
          })

          // Berechne Summen nur für die Trainings des gewählten Tages
          let tagSumme = 0
          let tagBarSumme = 0
          let tagBezahltSumme = 0
          let tagAusstehendSumme = 0
          let tagOffeneSumme = 0

          tagTrainings.forEach(t => {
            const calc = calculateSpielerPreisForTraining(t, s.spieler.id, tarife)
            let spielerPreis = 0

            if (calc.abrechnungsart === 'monatlich') {
              // Monatlicher Tarif: nur wenn dieses Training das ERSTE des Monats ist
              const monatlichKey = calc.tarifId || t.id
              const erstesTrainingId = monatlicheErstesTraining.get(monatlichKey)
              if (t.id === erstesTrainingId) {
                spielerPreis = calc.spielerPreis
              }
              // Sonst: 0€ da inkl. im Monatstarif
            } else {
              spielerPreis = calc.spielerPreis
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
              } else if (paymentStatus.ausstehend) {
                tagAusstehendSumme += spielerPreis
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
            ausstehendSumme: tagAusstehendSumme,
            offeneSumme: tagOffeneSumme
            // bezahlt bleibt vom Original (Monatsstatus)
          }
        })
        // Filtere Spieler heraus die keine Trainings am Tag haben
        .filter(s => s.trainings.length > 0)
        // Chronologisch nach frühester Uhrzeit des Tages sortieren
        .sort((a, b) => {
          const aZeit = a.trainings.reduce((min, t) => t.uhrzeit_von < min ? t.uhrzeit_von : min, a.trainings[0].uhrzeit_von)
          const bZeit = b.trainings.reduce((min, t) => t.uhrzeit_von < min ? t.uhrzeit_von : min, b.trainings[0].uhrzeit_von)
          return aZeit.localeCompare(bZeit)
        })
    }

    // Zusätzlicher Filter nach Spieler
    if (selectedSpielerId) {
      result = result.filter((s) => s.spieler.id === selectedSpielerId)
    }

    return result
  }, [spielerSummary, selectedSpielerId, selectedTag, tarife, getSpielerPaymentStatus])

  // Anzahl Spieler je Status – fuer die Filter-Pills. Basis: nach Tag-/Spieler-
  // Filter, aber VOR dem Status-Filter, damit die Zahlen konstant bleiben.
  const statusCounts = useMemo(() => {
    const c = { alle: 0, offen: 0, ausstehend: 0, bar: 0, bezahlt: 0 }
    summaryBeforeStatus.forEach((s) => {
      c.alle++
      if (s.bezahlt) c.bezahlt++
      else if (s.ausstehend) c.ausstehend++
      else c.offen++
      if (s.barSumme > 0) c.bar++
    })
    return c
  }, [summaryBeforeStatus])

  const filteredSummary = useMemo(() => {
    let result = summaryBeforeStatus

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

    // Offene/ausstehende Spieler nach oben (brauchen noch Aktion), bezahlte nach
    // unten. Bei Tag-Filter bleibt die chronologische Sortierung erhalten.
    if (!selectedTag) {
      const rang = (s: typeof result[number]) => (s.bezahlt ? 2 : s.ausstehend ? 1 : 0)
      result = [...result].sort((a, b) => rang(a) - rang(b) || a.spieler.name.localeCompare(b.spieler.name))
    }

    return result
  }, [summaryBeforeStatus, filter, selectedTag])

  const stats = useMemo(() => {
    // Trainings-Stats: vier disjunkte Kategorien (Bar + Bezahlt + Ausstehend + Offen = Gesamtumsatz)
    const trainingsTotal = filteredSummary.reduce((sum, s) => sum + s.summe, 0)
    const trainingsBar = filteredSummary.reduce((sum, s) => sum + s.barSumme, 0)
    const trainingsBezahlt = filteredSummary.reduce((sum, s) => sum + s.bezahltSumme, 0)
    const trainingsAusstehend = filteredSummary.reduce((sum, s) => sum + (s.ausstehendSumme || 0), 0)
    const trainingsOffen = filteredSummary.reduce((sum, s) => sum + s.offeneSumme, 0)

    return {
      total: trainingsTotal,
      bar: trainingsBar,
      bezahlt: trainingsBezahlt,
      ausstehend: trainingsAusstehend,
      offen: trainingsOffen
    }
  }, [filteredSummary])

  // Alle Trainings eines Spielers im Monat als bezahlt/offen markieren
  const toggleAlleBezahlt = async (spielerId: string, currentStatus: boolean) => {
    preserveScroll()
    const spielerData = spielerSummary.find(s => s.spieler.id === spielerId)
    if (!spielerData) return

    const newStatus = !currentStatus

    // Bar bezahlte Trainings NIE anfassen (sonst stimmt die Bar-Einnahme nicht).
    // Markieren (newStatus=true): offene/ausstehende -> bezahlt (Überweisung).
    // Zurücksetzen (newStatus=false): per Überweisung bezahlte -> offen.
    const betroffene = spielerData.trainings.filter(t => {
      const ps = getSpielerPaymentStatus(spielerId, t)
      if (ps.barBezahlt) return false
      return newStatus ? !ps.bezahlt : ps.bezahlt
    })

    // Optimistisches Update
    const updatedPayments: SpielerTrainingPayment[] = []
    const newPayments: SpielerTrainingPayment[] = []

    for (const training of betroffene) {
      const existingPayment = spielerPayments.find(
        p => p.training_id === training.id && p.spieler_id === spielerId
      )

      if (existingPayment) {
        updatedPayments.push({ ...existingPayment, bezahlt: newStatus, bar_bezahlt: false, ausstehend: false })
      } else {
        newPayments.push({
          id: `temp-${training.id}-${spielerId}`,
          user_id: userId,
          training_id: training.id,
          spieler_id: spielerId,
          bezahlt: newStatus,
          bar_bezahlt: false,
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

    // Datenbank: nur betroffene upserten
    const rows = betroffene.map(training => ({
      user_id: userId,
      training_id: training.id,
      spieler_id: spielerId,
      bezahlt: newStatus,
      bar_bezahlt: false,
      ausstehend: false
    }))
    if (rows.length > 0) {
      const { error: dbError } = await supabase
        .from('spieler_training_payments')
        .upsert(rows, { onConflict: 'training_id,spieler_id' })
      if (dbError) {
        console.error('Bezahlt speichern fehlgeschlagen:', dbError)
        alert('Konnte „Bezahlt" nicht speichern:\n' + dbError.message)
      }
    }
    onUpdate()
  }

  // Alle Trainings eines Spielers im Monat als bar bezahlt markieren
  const toggleAlleBarBezahlt = async (spielerId: string) => {
    preserveScroll()
    const spielerData = spielerSummary.find(s => s.spieler.id === spielerId)
    if (!spielerData) return

    // Nur offene/ausstehende Trainings als bar markieren – bereits per
    // Überweisung bezahlte bleiben erhalten (sonst stimmt die Aufteilung
    // bar/Überweisung nicht).
    const betroffene = spielerData.trainings.filter(t => {
      const ps = getSpielerPaymentStatus(spielerId, t)
      return !ps.bezahlt && !ps.barBezahlt
    })

    // Optimistisches Update
    const updatedPayments: SpielerTrainingPayment[] = []
    const newPayments: SpielerTrainingPayment[] = []

    for (const training of betroffene) {
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

    // Datenbank: nur betroffene upserten
    const rows = betroffene.map(training => ({
      user_id: userId,
      training_id: training.id,
      spieler_id: spielerId,
      bezahlt: true,
      bar_bezahlt: true,
      ausstehend: false
    }))
    if (rows.length > 0) {
      const { error: dbError } = await supabase
        .from('spieler_training_payments')
        .upsert(rows, { onConflict: 'training_id,spieler_id' })
      if (dbError) {
        console.error('Bar speichern fehlgeschlagen:', dbError)
        alert('Konnte „Bar bezahlt" nicht speichern:\n' + dbError.message)
      }
    }

    // Einzeltrainings (1 Spieler): Training-Felder mitziehen, damit die
    // Trainingsansicht ebenfalls „bar bezahlt" zeigt. Gruppentrainings bleiben
    // unberührt – dort ist der Status pro Spieler maßgeblich.
    const einzelTrainingIds = betroffene
      .filter(t => t.spieler_ids.length === 1)
      .map(t => t.id)
    if (einzelTrainingIds.length > 0) {
      const { error: tErr } = await supabase
        .from('trainings')
        .update({ bar_bezahlt: true, bezahlt: true })
        .in('id', einzelTrainingIds)
      if (tErr) console.error('Training-Status-Sync fehlgeschlagen:', tErr)
    }

    onUpdate()
  }

  // Alle Trainings eines Spielers im Monat als ausstehend/offen markieren (Toggle)
  const toggleAlleAusstehend = async (spielerId: string, currentAusstehend: boolean) => {
    preserveScroll()
    const spielerData = spielerSummary.find(s => s.spieler.id === spielerId)
    if (!spielerData) return

    const newAusstehend = !currentAusstehend

    // NUR offene bzw. bereits ausstehende Trainings betreffen – schon (bar oder
    // per Überweisung) bezahlte bleiben unangetastet, damit ihr Bezahlstatus
    // nicht verloren geht.
    const betroffene = spielerData.trainings.filter(t => {
      const ps = getSpielerPaymentStatus(spielerId, t)
      return !ps.bezahlt && !ps.barBezahlt
    })

    // Optimistisches Update - sofort UI aktualisieren
    const updatedPayments: SpielerTrainingPayment[] = []
    const newPayments: SpielerTrainingPayment[] = []

    for (const training of betroffene) {
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

    // Datenbank: nur die betroffenen (nicht bezahlten) Trainings upserten.
    const rows = betroffene.map(training => ({
      user_id: userId,
      training_id: training.id,
      spieler_id: spielerId,
      bezahlt: false,
      bar_bezahlt: false,
      ausstehend: newAusstehend
    }))
    if (rows.length > 0) {
      const { error: dbError } = await supabase
        .from('spieler_training_payments')
        .upsert(rows, { onConflict: 'training_id,spieler_id' })
      if (dbError) {
        console.error('Ausstehend speichern fehlgeschlagen:', dbError)
        alert('Konnte „Ausstehend" nicht speichern:\n' + dbError.message)
      }
    }
    onUpdate()
  }

  // Einzelnes Training eines Spielers gezielt auf offen / bar / bezahlt setzen.
  // Die Spieler-Zahlungszeile ist die Quelle der Wahrheit. Bei Einzeltrainings
  // (1 Spieler) werden die Training-Felder mitgezogen, damit Kalender/Trainings-
  // ansicht und Abrechnung nicht auseinanderlaufen (z.B. Abrechnung "bezahlt",
  // Trainingsansicht aber weiterhin "bar").
  const setTrainingPaymentStatus = async (
    trainingId: string,
    spielerId: string,
    status: 'offen' | 'bar' | 'bezahlt'
  ) => {
    preserveScroll()
    const bezahlt = status === 'bar' || status === 'bezahlt'
    const bar = status === 'bar'

    const existingPayment = spielerPayments.find(
      p => p.training_id === trainingId && p.spieler_id === spielerId
    )

    // Optimistisches Update - sofort UI aktualisieren
    if (existingPayment) {
      setSpielerPayments(prev => prev.map(p =>
        p.id === existingPayment.id ? { ...p, bezahlt, bar_bezahlt: bar, ausstehend: false } : p
      ))
    } else {
      const tempPayment: SpielerTrainingPayment = {
        id: `temp-${trainingId}-${spielerId}`,
        user_id: userId,
        training_id: trainingId,
        spieler_id: spielerId,
        bezahlt,
        bar_bezahlt: bar,
        ausstehend: false,
        created_at: new Date().toISOString()
      }
      setSpielerPayments(prev => [...prev, tempPayment])
    }

    // Datenbank: Spieler-Zahlungszeile per upsert (training_id, spieler_id)
    const { error: dbError } = await supabase
      .from('spieler_training_payments')
      .upsert({
        user_id: userId,
        training_id: trainingId,
        spieler_id: spielerId,
        bezahlt,
        bar_bezahlt: bar,
        ausstehend: false
      }, { onConflict: 'training_id,spieler_id' })
    if (dbError) {
      console.error('Status speichern fehlgeschlagen:', dbError)
      alert('Konnte Status nicht speichern:\n' + dbError.message)
    }

    // Einzeltraining: Training-Felder mitziehen, damit die Trainingsansicht
    // dasselbe zeigt. Gruppentrainings: gemeinsames Flag nicht anfassen, da dort
    // die Spieler-Zeilen maßgeblich sind.
    const training = monthTrainings.find(t => t.id === trainingId)
    if (
      training &&
      training.spieler_ids.length === 1 &&
      (training.bar_bezahlt !== bar || training.bezahlt !== bezahlt)
    ) {
      const { error: tErr } = await supabase
        .from('trainings')
        .update({ bar_bezahlt: bar, bezahlt })
        .eq('id', trainingId)
      if (tErr) console.error('Training-Status-Sync fehlgeschlagen:', tErr)
    }

    onUpdate()
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

    const rows = Array.from(selectedTrainingsForBulk).map(trainingId => {
      const training = monthTrainings.find(t => t.id === trainingId)
      return {
        user_id: userId,
        training_id: trainingId,
        spieler_id: spielerId,
        bezahlt: true,
        bar_bezahlt: training?.bar_bezahlt || false
      }
    })
    const { error: dbError } = await supabase
      .from('spieler_training_payments')
      .upsert(rows, { onConflict: 'training_id,spieler_id' })
    if (dbError) {
      console.error('Speichern fehlgeschlagen:', dbError)
      alert('Konnte nicht speichern:\n' + dbError.message)
    }

    setSelectedTrainingsForBulk(new Set())
    onUpdate()
  }

  // Nach Erstellen einer Lexoffice-Rechnung: die berechneten (offenen) Trainings
  // des Spielers automatisch auf "ausstehend" setzen (Rechnung raus, Zahlung
  // erwartet). Bereits bezahlte/bar bleiben unangetastet.
  const markSpielerAusstehendNachRechnung = async (spielerId: string) => {
    const spielerData = spielerSummary.find(s => s.spieler.id === spielerId)
    if (!spielerData) return
    const betroffene = spielerData.trainings.filter(t => {
      const ps = getSpielerPaymentStatus(spielerId, t)
      return !ps.bezahlt && !ps.barBezahlt
    })
    if (betroffene.length === 0) { onUpdate(); return }
    const rows = betroffene.map(training => ({
      user_id: userId,
      training_id: training.id,
      spieler_id: spielerId,
      bezahlt: false,
      bar_bezahlt: false,
      ausstehend: true
    }))
    const { error } = await supabase
      .from('spieler_training_payments')
      .upsert(rows, { onConflict: 'training_id,spieler_id' })
    if (error) console.error('Auto-Ausstehend nach Rechnung fehlgeschlagen:', error)
    onUpdate()
  }

  // Baut aus den Trainings eines Spielers die offenen Rechnungspositionen.
  // Beruecksichtigt monatliche Tarife (nur erstes Training pro Tarif PRO MONAT),
  // Korrekturen und Stunden (Menge = Dauer, Preis pro Stunde). Funktioniert auch
  // ueber mehrere Monate hinweg (Schluessel enthaelt den Monat).
  const buildLexofficeLines = (sp: Spieler, trainingsList: Training[]): LexofficeLineItem[] => {
    const sorted = [...trainingsList].sort((a, b) => a.datum.localeCompare(b.datum))
    const monatlichErstes = new Map<string, string>()
    sorted.forEach(t => {
      const calc = calculateSpielerPreisForTraining(t, sp.id, tarife)
      if (calc.abrechnungsart === 'monatlich') {
        const key = `${calc.tarifId || t.id}|${t.datum.substring(0, 7)}`
        if (!monatlichErstes.has(key)) monatlichErstes.set(key, t.id)
      }
    })
    return sorted
      .map(t => {
        const calc = calculateSpielerPreisForTraining(t, sp.id, tarife)
        let basis = 0
        if (calc.abrechnungsart === 'monatlich') {
          const key = `${calc.tarifId || t.id}|${t.datum.substring(0, 7)}`
          if (monatlichErstes.get(key) === t.id) basis = calc.spielerPreis
        } else {
          basis = calc.spielerPreis
        }
        const betrag = basis + (t.korrektur_betrag || 0)
        const tarif = calc.tarifId ? tarife.find(ta => ta.id === calc.tarifId) : undefined
        return { t, betrag, tarif }
      })
      .filter(x => {
        const ps = getSpielerPaymentStatus(sp.id, x.t)
        return !ps.bezahlt && !ps.barBezahlt && x.betrag > 0
      })
      .map(x => {
        const dur = calculateDuration(x.t.uhrzeit_von, x.t.uhrzeit_bis)
        const hours = dur > 0 ? dur : 1
        // Lexoffice erlaubt fuer die Menge max. 4 Nachkommastellen. Krumme
        // Dauern (z.B. 1h20min = 1.33333… h) sonst -> "Validation failed".
        // Ganze/halbe Stunden bleiben unveraendert (1.5 -> 1.5).
        const qty = Number(hours.toFixed(4))
        return {
          name: `${x.tarif?.name || x.t.name || 'Tennistraining'} – ${formatWeekdayGerman(x.t.datum)}, ${formatDateGerman(x.t.datum)}`,
          amount: Number((x.betrag / qty).toFixed(2)),
          quantity: qty
        }
      })
  }

  // Baut die offenen Rechnungspositionen eines Spielers (Monat) und oeffnet das
  // Lexoffice-Modal.
  const openLexofficeRechnung = (item: { spieler: Spieler; trainings: Training[] }) => {
    const lines = buildLexofficeLines(item.spieler, item.trainings)
    const [yy, mm] = selectedMonth.split('-').map(Number)
    const lastDay = String(new Date(yy, mm, 0).getDate()).padStart(2, '0')
    setLexofficeData({
      spieler: item.spieler,
      lineItems: lines,
      monthStr: selectedMonth,
      shippingStart: `${selectedMonth}-01`,
      shippingEnd: `${selectedMonth}-${lastDay}`
    })
  }

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card stat-card-clickable" onClick={() => setStatBreakdown('total')} title="Aufschlüsselung anzeigen">
          <div className="stat-label">Gesamtumsatz</div>
          <div className="stat-value" style={{ color: '#1E293B' }}>{stats.total.toFixed(2)} €</div>
        </div>
        <div className="stat-card stat-card-clickable" onClick={() => setStatBreakdown('bar')} title="Aufschlüsselung anzeigen">
          <div className="stat-label">Bar bezahlt</div>
          <div className="stat-value" style={{ color: 'var(--pay-bar)' }}>{stats.bar.toFixed(2)} €</div>
        </div>
        <div className="stat-card stat-card-clickable" onClick={() => setStatBreakdown('bezahlt')} title="Aufschlüsselung anzeigen">
          <div className="stat-label">Bezahlt (Überweisung)</div>
          <div className="stat-value" style={{ color: 'var(--pay-bezahlt)' }}>
            {stats.bezahlt.toFixed(2)} €
          </div>
        </div>
        <div className="stat-card stat-card-clickable" onClick={() => setStatBreakdown('ausstehend')} title="Aufschlüsselung anzeigen">
          <div className="stat-label">Ausstehend</div>
          <div className="stat-value" style={{ color: 'var(--pay-ausstehend)' }}>
            {stats.ausstehend.toFixed(2)} €
          </div>
        </div>
        <div className="stat-card stat-card-clickable" onClick={() => setStatBreakdown('offen')} title="Aufschlüsselung anzeigen">
          <div className="stat-label">Offen</div>
          <div className="stat-value" style={{ color: 'var(--pay-offen)' }}>
            {stats.offen.toFixed(2)} €
          </div>
        </div>
      </div>

      {statBreakdown && (() => {
        const cfgMap = {
          total: { label: 'Gesamtumsatz', color: '#1E293B', get: (s: (typeof filteredSummary)[number]) => s.summe },
          bar: { label: 'Bar bezahlt', color: 'var(--pay-bar)', get: (s: (typeof filteredSummary)[number]) => s.barSumme },
          bezahlt: { label: 'Bezahlt (Überweisung)', color: 'var(--pay-bezahlt)', get: (s: (typeof filteredSummary)[number]) => s.bezahltSumme },
          ausstehend: { label: 'Ausstehend', color: 'var(--pay-ausstehend)', get: (s: (typeof filteredSummary)[number]) => s.ausstehendSumme },
          offen: { label: 'Offen', color: 'var(--pay-offen)', get: (s: (typeof filteredSummary)[number]) => s.offeneSumme }
        }
        const cfg = cfgMap[statBreakdown]
        const items = filteredSummary
          .map((s) => ({ spieler: s.spieler, betrag: cfg.get(s) }))
          .filter((x) => Math.abs(x.betrag) > 0.005)
          .sort((a, b) => b.betrag - a.betrag)
        const total = items.reduce((sum, x) => sum + x.betrag, 0)
        return (
          <div className="modal-overlay" onClick={() => setStatBreakdown(null)}>
            <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, background: cfg.color, display: 'inline-block' }} />
                  {cfg.label}
                  <span style={{ color: cfg.color }}>· {total.toFixed(2)} €</span>
                </h3>
                <button className="modal-close" onClick={() => setStatBreakdown(null)}>×</button>
              </div>
              <div className="modal-body">
                <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 10 }}>
                  {selectedTag ? formatDateGerman(selectedTag) : selectedMonth} · {items.length} Spieler
                </div>
                {items.length === 0 ? (
                  <div className="empty-state">Keine Beträge in dieser Kategorie</div>
                ) : (
                  <div className="table-container">
                    <table>
                      <tbody>
                        {items.map(({ spieler, betrag }) => (
                          <tr
                            key={spieler.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => { setStatBreakdown(null); setSelectedSpielerDetail(spieler.id) }}
                            title="Detailansicht öffnen"
                          >
                            <td style={{ color: 'var(--primary)', fontWeight: 500 }}>{spieler.name}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: cfg.color }}>{betrag.toFixed(2)} €</td>
                          </tr>
                        ))}
                        <tr>
                          <td style={{ fontWeight: 700 }}>Summe</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{total.toFixed(2)} €</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

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
              <div className="filter-pill-group">
                {([
                  ['alle', 'Alle'],
                  ['offen', 'Offen'],
                  ['ausstehend', 'Ausstehend'],
                  ['bar', 'Bar'],
                  ['bezahlt', 'Bezahlt']
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`pay-pill pay-pill-${key} ${filter === key ? 'active' : ''}`}
                    onClick={() => setFilter(key)}
                  >
                    {label}
                    <span className="pay-pill-count">{statusCounts[key]}</span>
                  </button>
                ))}
              </div>
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
                      <span style={{ color: 'var(--pay-bar)', fontSize: 12, marginLeft: 8, fontWeight: 600 }}>
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
                      {lexofficeEnabled && (
                        <button
                          className="btn btn-sm"
                          onClick={(e) => { e.stopPropagation(); openLexofficeRechnung(item) }}
                          style={{ background: '#6366F1', color: 'white', borderColor: '#6366F1' }}
                          title="Lexoffice-Rechnung erstellen"
                        >
                          📄
                        </button>
                      )}
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
                              background: item.ausstehend ? 'var(--pay-offen)' : 'var(--pay-ausstehend)',
                              color: 'white',
                              borderColor: item.ausstehend ? 'var(--pay-offen)' : 'var(--pay-ausstehend)'
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
                            style={{ background: 'var(--pay-bar)', color: 'white', borderColor: 'var(--pay-bar)' }}
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
                    <span className="mobile-card-value" style={{ color: 'var(--pay-bar)', fontWeight: 600 }}>
                      {item.barSumme.toFixed(2)} €
                    </span>
                  </div>
                )}
              </div>
              <div className="mobile-card-actions">
                {lexofficeEnabled && (
                  <button
                    className="btn btn-sm"
                    onClick={(e) => { e.stopPropagation(); openLexofficeRechnung(item) }}
                    style={{ background: '#6366F1', color: 'white', borderColor: '#6366F1' }}
                    title="Lexoffice-Rechnung erstellen"
                  >
                    📄
                  </button>
                )}
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
                        background: item.ausstehend ? 'var(--pay-offen)' : 'var(--pay-ausstehend)',
                        color: 'white',
                        borderColor: item.ausstehend ? 'var(--pay-offen)' : 'var(--pay-ausstehend)'
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
                      style={{ background: 'var(--pay-bar)', color: 'white', borderColor: 'var(--pay-bar)' }}
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
          const calc = calculateSpielerPreisForTraining(t, detail.spieler.id, tarife)
          if (calc.abrechnungsart === 'monatlich') {
            const monatlichKey = calc.tarifId || t.id
            if (!monatlicheErstesTraining.has(monatlichKey)) {
              monatlicheErstesTraining.set(monatlichKey, t.id)
            }
          }
        })

        // Filtere Trainings nach Tag wenn Tag-Filter aktiv
        const gefilterteTrainings = selectedTag
          ? detail.trainings.filter(t => t.datum === selectedTag)
          : detail.trainings

        // Berechne Betrag pro Training (mit korrektem monatlichen Tracking)
        const trainingsDetail = gefilterteTrainings
          .sort((a, b) => {
            const datumCmp = a.datum.localeCompare(b.datum)
            return datumCmp !== 0 ? datumCmp : a.uhrzeit_von.localeCompare(b.uhrzeit_von)
          })
          .map(t => {
            const calc = calculateSpielerPreisForTraining(t, detail.spieler.id, tarife)
            // Effektiver Tarif fuer Anzeige: individuell oder global
            const effektiverTarif = calc.tarifId ? tarife.find(ta => ta.id === calc.tarifId) : undefined

            let basisBetrag = 0
            let istMonatlicheSerieErstesTraining = false

            if (calc.abrechnungsart === 'monatlich') {
              const monatlichKey = calc.tarifId || t.id
              const erstesTrainingId = monatlicheErstesTraining.get(monatlichKey)
              if (t.id === erstesTrainingId) {
                basisBetrag = calc.spielerPreis // Monatsbetrag
                istMonatlicheSerieErstesTraining = true
              }
            } else {
              basisBetrag = calc.spielerPreis
            }

            // Korrektur anwenden (z.B. Kartenlesergebühren abziehen)
            const korrektur = t.korrektur_betrag || 0
            const betrag = basisBetrag + korrektur
            return { training: t, basisBetrag, korrektur, betrag, tarif: effektiverTarif, istMonatlicheSerieErstesTraining, abrechnungsart: calc.abrechnungsart }
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
                    <strong>{selectedTag ? 'Tag:' : 'Monat:'}</strong> {selectedTag ? formatDateGerman(selectedTag) : selectedMonth}
                  </div>
                  <div>
                    <strong>Gesamt:</strong> {gefilterteSumme.toFixed(2)} €
                  </div>
                  {gefilterteBarSumme > 0 && (
                    <div style={{ color: 'var(--pay-bar)' }}>
                      <strong>Bar:</strong> {gefilterteBarSumme.toFixed(2)} €
                    </div>
                  )}
                  {gefilterteBezahltSumme > 0 && (
                    <div style={{ color: 'var(--pay-bezahlt)' }}>
                      <strong>Bezahlt:</strong> {gefilterteBezahltSumme.toFixed(2)} €
                    </div>
                  )}
                  {gefilterteOffeneSumme > 0 && (
                    <div style={{ color: 'var(--pay-offen)' }}>
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
                                ? { background: 'var(--pay-bar-bg)' }
                                : paymentStatusRow.bezahlt
                                ? { background: 'var(--pay-bezahlt-bg)' }
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
                              {(() => {
                                const aktuell: 'offen' | 'bar' | 'bezahlt' = paymentStatusRow.barBezahlt
                                  ? 'bar'
                                  : paymentStatusRow.bezahlt
                                  ? 'bezahlt'
                                  : 'offen'
                                const optionen = [
                                  { key: 'offen' as const, label: 'Offen', farbe: 'var(--pay-offen)' },
                                  { key: 'bar' as const, label: 'Bar', farbe: 'var(--pay-bar)' },
                                  { key: 'bezahlt' as const, label: 'Bez.', farbe: 'var(--pay-bezahlt)' }
                                ]
                                return (
                                  <div style={{ display: 'inline-flex', gap: 3 }}>
                                    {optionen.map(({ key, label, farbe }) => {
                                      const aktiv = aktuell === key
                                      return (
                                        <button
                                          key={key}
                                          className="btn btn-sm"
                                          title={`Auf "${label}" setzen`}
                                          style={{
                                            fontSize: 10,
                                            padding: '2px 7px',
                                            ...(aktiv
                                              ? { background: farbe, borderColor: farbe, color: '#fff' }
                                              : { background: 'var(--gray-100)', color: 'var(--gray-500)' })
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            if (!aktiv) setTrainingPaymentStatus(training.id, detail.spieler.id, key)
                                          }}
                                        >
                                          {label}
                                        </button>
                                      )
                                    })}
                                  </div>
                                )
                              })()}
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
                {!selectedTag && (
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
                {lexofficeEnabled && (
                  <button className="btn btn-primary" onClick={() => openLexofficeRechnung(detail)}>
                    📄 Lexoffice-Rechnung
                  </button>
                )}
                <button className="btn btn-secondary" onClick={() => setSelectedSpielerDetail(null)}>
                  Schließen
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {lexofficeData && (
        <LexofficeRechnungModal
          spieler={lexofficeData.spieler}
          lineItems={lexofficeData.lineItems}
          monthStr={lexofficeData.monthStr}
          shippingStart={lexofficeData.shippingStart}
          shippingEnd={lexofficeData.shippingEnd}
          onClose={() => setLexofficeData(null)}
          onSaved={onUpdate}
          onInvoiced={() => markSpielerAusstehendNachRechnung(lexofficeData.spieler.id)}
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
        const halbFaktor = training.status === 'durchgefuehrt_halb' ? 0.5 : 1
        const basisBetrag = preis * duration * halbFaktor

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
      return tMonth === selectedMonth && (t.status === 'durchgefuehrt' || t.status === 'durchgefuehrt_halb')
    })

    return trainer.map((tr) => {
      // Filter trainings for this trainer
      const trainerTrainings = monthTrainings.filter((t) => t.trainer_id === tr.id)

      // Calculate total hours (50%-Trainings nur zur Haelfte)
      const totalStunden = trainerTrainings.reduce((sum, t) => {
        const faktor = t.status === 'durchgefuehrt_halb' ? 0.5 : 1
        return sum + calculateDuration(t.uhrzeit_von, t.uhrzeit_bis) * faktor
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




export default App
