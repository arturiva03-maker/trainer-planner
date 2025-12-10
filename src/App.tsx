import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabaseClient'
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
  Ausgabe
} from './types'
import { AUSGABE_KATEGORIEN } from './types'
import {
  formatDate,
  formatDateGerman,
  formatTime,
  getWeekDates,
  getMonthString,
  calculateDuration,
  generateRechnungsnummer,
  WOCHENTAGE,
  formatMonthGerman,
  formatQuartal
} from './utils'

// ============ AUTH COMPONENT ============
function AuthScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      <div className="auth-box">
        <h1>{isLogin ? 'Anmelden' : 'Registrieren'}</h1>
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
  )
}

// ============ MAIN APP COMPONENT ============
function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

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

  return <MainApp user={session.user} />
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
  const [notizen, setNotizen] = useState<Notiz[]>([])
  const [planungSheets, setPlanungSheets] = useState<PlanungSheet[]>([])
  const [ausgaben, setAusgaben] = useState<Ausgabe[]>([])
  const [dataLoading, setDataLoading] = useState(true)

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
        ausgabenRes
      ] = await Promise.all([
        supabase.from('trainer_profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('spieler').select('*').eq('user_id', user.id).order('name'),
        supabase.from('tarife').select('*').eq('user_id', user.id).order('name'),
        supabase.from('trainings').select('*').eq('user_id', user.id).order('datum', { ascending: false }),
        supabase.from('trainer').select('*').eq('user_id', user.id).order('name'),
        supabase.from('monthly_adjustments').select('*').eq('user_id', user.id),
        supabase.from('notizen').select('*').eq('user_id', user.id).order('erstellt_am', { ascending: false }),
        supabase.from('planung_sheets').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('ausgaben').select('*').eq('user_id', user.id).order('datum', { ascending: false })
      ])

      if (profileRes.data) setProfile(profileRes.data)
      if (spielerRes.data) setSpieler(spielerRes.data)
      if (tarifeRes.data) setTarife(tarifeRes.data)
      if (trainingsRes.data) setTrainings(trainingsRes.data)
      if (trainerRes.data) setTrainer(trainerRes.data)
      if (adjustmentsRes.data) setAdjustments(adjustmentsRes.data)
      if (notizenRes.data) setNotizen(notizenRes.data)
      if (planungRes.data) setPlanungSheets(planungRes.data)
      if (ausgabenRes.data) setAusgaben(ausgabenRes.data)
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

  const baseTabs = [
    { id: 'kalender' as Tab, label: 'Kalender', icon: '📅' },
    { id: 'verwaltung' as Tab, label: 'Verwaltung', icon: '👥' },
    { id: 'abrechnung' as Tab, label: 'Abrechnung', icon: '💰' },
    { id: 'buchhaltung' as Tab, label: 'Buchhaltung', icon: '📊' },
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
    { id: 'buchhaltung' as Tab, label: 'Buchh.', icon: '📊' },
    { id: 'weiteres' as Tab, label: 'Mehr', icon: '⚙️' }
  ]

  // Warte-Bildschirm für nicht freigeschaltete User
  if (!dataLoading && profile && !profile.approved) {
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
        <div className="header-content">
          <h1 className="header-title">Tennistrainer Planung</h1>
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
          <h2>Trainer Planner</h2>
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
                profile={profile}
                onUpdate={loadAllData}
                onNavigateToTraining={handleNavigateToTraining}
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
            {activeTab === 'buchhaltung' && (
              <BuchhaltungView
                trainings={trainings}
                tarife={tarife}
                spieler={spieler}
                ausgaben={ausgaben}
                profile={profile}
                onUpdate={loadAllData}
                userId={user.id}
                userEmail={user.email || ''}
              />
            )}
            {activeTab === 'weiteres' && (
              <WeiteresView
                profile={profile}
                notizen={notizen}
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
  onNavigateComplete
}: {
  trainings: Training[]
  spieler: Spieler[]
  tarife: Tarif[]
  onUpdate: () => void
  userId: string
  navigateToTraining?: Training | null
  onNavigateComplete?: () => void
}) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'week' | 'day'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'week'
  )
  const [editingTraining, setEditingTraining] = useState<Training | null>(null)

  // Navigation von Abrechnung: Zum Training-Datum springen und Bearbeitung öffnen
  useEffect(() => {
    if (navigateToTraining) {
      const trainingDate = new Date(navigateToTraining.datum + 'T12:00:00')
      setCurrentDate(trainingDate)
      setEditingTraining(navigateToTraining)
      onNavigateComplete?.()
    }
  }, [navigateToTraining, onNavigateComplete])

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

  const getSpielerNames = (ids: string[], vornameOnly = false) => {
    return ids
      .map((id) => {
        const name = spieler.find((s) => s.id === id)?.name || 'Unbekannt'
        return vornameOnly ? name.split(' ')[0] : name
      })
      .join(', ')
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

  const navigateDay = (direction: number) => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + direction)
    setCurrentDate(newDate)
  }

  const handleDoubleClick = async (training: Training) => {
    const newStatus = training.status === 'geplant' ? 'durchgefuehrt' : 'geplant'
    await supabase.from('trainings').update({ status: newStatus }).eq('id', training.id)
    onUpdate()
  }

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + direction * 7)
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
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
      <div className="card">
        <div className="calendar-header">
          <div className="calendar-nav">
            <button className="btn btn-secondary" onClick={() => isDayView ? navigateDay(-1) : navigateWeek(-1)}>←</button>
            <h3>
              {isDayView
                ? currentDate.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
                : `${weekDates[0].toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} - ${weekDates[6].toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}`
              }
            </h3>
            <button className="btn btn-secondary" onClick={() => isDayView ? navigateDay(1) : navigateWeek(1)}>→</button>
          </div>
          <div className="view-toggle">
            <button
              className={`btn ${viewMode === 'week' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('week')}
            >
              Woche
            </button>
            <button
              className={`btn ${viewMode === 'day' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('day')}
            >
              Tag
            </button>
            <button className="btn btn-primary" onClick={goToToday}>Heute</button>
            <button className="btn btn-success" onClick={() => setShowAddTraining(true)}>
              + Neu
            </button>
          </div>
        </div>


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
                  const slotTrainings = dayTrainings.filter((t) => {
                    const [h] = t.uhrzeit_von.split(':').map(Number)
                    return h === parseInt(time)
                  })

                  return (
                    <div key={`cell-${dayIndex}-${time}`} className="calendar-day-cell">
                      {slotTrainings.map((training) => {
                        const pos = getTrainingPosition(training, isDayView)
                        const tarifName = getTarifName(training.tarif_id)
                        return (
                          <div
                            key={training.id}
                            className={`training-block status-${training.status}`}
                            style={{ top: pos.top % cellHeight, height: pos.height }}
                            onClick={() => setEditingTraining(training)}
                            onDoubleClick={() => handleDoubleClick(training)}
                          >
                            <div className="training-title">{getSpielerNames(training.spieler_ids, true)}</div>
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
  const [tarifId, setTarifId] = useState(training?.tarif_id || '')
  const [status, setStatus] = useState<Training['status']>(training?.status || 'geplant')
  const [notiz, setNotiz] = useState(training?.notiz || '')
  const [barBezahlt, setBarBezahlt] = useState(training?.bar_bezahlt || false)
  const [customPreis, setCustomPreis] = useState(training?.custom_preis_pro_stunde?.toString() || '')
  const [wiederholen, setWiederholen] = useState(false)
  const [wiederholenBis, setWiederholenBis] = useState('2026-03-29')
  const [serienAktion, setSerienAktion] = useState<'einzeln' | 'nachfolgende'>('einzeln')
  const [saving, setSaving] = useState(false)

  // Prüfen ob Training Teil einer Serie ist
  const istSerie = training?.serie_id != null

  const toggleSpieler = (id: string) => {
    setSelectedSpieler((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const handleSave = async () => {
    if (selectedSpieler.length === 0) {
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
        tarif_id: tarifId || null,
        status,
        notiz: notiz || null,
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

    if (serienAktion === 'nachfolgende' && training.serie_id) {
      if (!confirm('Dieses und alle nachfolgenden Trainings der Serie wirklich löschen?')) return
      await supabase
        .from('trainings')
        .delete()
        .eq('serie_id', training.serie_id)
        .gte('datum', training.datum)
    } else {
      if (!confirm('Training wirklich löschen?')) return
      await supabase.from('trainings').delete().eq('id', training.id)
    }
    onSave()
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
            <div className="multi-select">
              {spieler.map((s) => (
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
            </div>
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
                onChange={(e) => setStatus(e.target.value as Training['status'])}
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
        notizen: notizen || null
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
    if (!confirm('Spieler wirklich löschen?')) return

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
    if (!confirm('Tarif wirklich löschen?')) return

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
    if (!confirm('Trainer wirklich löschen?')) return

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
  profile,
  onUpdate,
  onNavigateToTraining
}: {
  trainings: Training[]
  spieler: Spieler[]
  tarife: Tarif[]
  adjustments: MonthlyAdjustment[]
  profile: TrainerProfile | null
  onUpdate: () => void
  onNavigateToTraining: (training: Training) => void
}) {
  const [selectedMonth, setSelectedMonth] = useState(getMonthString(new Date()))
  const [filter, setFilter] = useState<'alle' | 'bezahlt' | 'offen' | 'bar'>('alle')
  const [filterType, setFilterType] = useState<'keine' | 'spieler' | 'tag'>('keine')
  const [selectedSpielerId, setSelectedSpielerId] = useState<string>('')
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [selectedSpielerDetail, setSelectedSpielerDetail] = useState<string | null>(null)

  const monthTrainings = useMemo(() => {
    return trainings.filter((t) => {
      const tMonth = t.datum.substring(0, 7)
      return tMonth === selectedMonth && t.status === 'durchgefuehrt'
    })
  }, [trainings, selectedMonth])

  const spielerSummary = useMemo(() => {
    const summary: {
      [spielerId: string]: {
        spieler: Spieler
        trainings: Training[]
        summe: number
        barSumme: number
        bezahltSumme: number
        offeneSumme: number
        bezahlt: boolean
        adjustment: number
      }
    } = {}

    monthTrainings.forEach((t) => {
      const tarif = tarife.find((ta) => ta.id === t.tarif_id)
      const preis = t.custom_preis_pro_stunde || tarif?.preis_pro_stunde || 0
      const duration = calculateDuration(t.uhrzeit_von, t.uhrzeit_bis)
      const totalPreis = preis * duration

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
            offeneSumme: 0,
            bezahlt: false,
            adjustment: 0
          }
        }

        summary[spielerId].trainings.push(t)

        const abrechnungsart = t.custom_abrechnung || tarif?.abrechnung || 'proTraining'
        let spielerPreis = totalPreis
        if (abrechnungsart === 'proSpieler') {
          spielerPreis = totalPreis / t.spieler_ids.length
        }

        summary[spielerId].summe += spielerPreis

        // Kategorisiere nach Bezahlstatus
        if (t.bar_bezahlt) {
          summary[spielerId].barSumme += spielerPreis
        } else if (t.bezahlt) {
          summary[spielerId].bezahltSumme += spielerPreis
        } else {
          summary[spielerId].offeneSumme += spielerPreis
        }
      })
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

      // Bezahlt nur wenn ALLE Trainings bezahlt sind (bar oder normal) UND keine offenen Beträge
      summary[spielerId].bezahlt = summary[spielerId].offeneSumme <= 0
    })

    return Object.values(summary)
  }, [monthTrainings, spieler, tarife, adjustments, selectedMonth])

  // Alle Tage im Monat mit Trainings
  const tageImMonat = useMemo(() => {
    const tage = new Set<string>()
    monthTrainings.forEach(t => tage.add(t.datum))
    return Array.from(tage).sort()
  }, [monthTrainings])

  const filteredSummary = useMemo(() => {
    let result = spielerSummary

    // Bei Tag-Filter: Neu berechnen mit nur Trainings des Tages
    if (filterType === 'tag' && selectedTag) {
      result = result
        .filter(s => s.trainings.some(t => t.datum === selectedTag))
        .map(s => {
          const tagTrainings = s.trainings.filter(t => t.datum === selectedTag)
          let summe = 0
          let barSumme = 0
          let bezahltSumme = 0
          let offeneSumme = 0

          tagTrainings.forEach(t => {
            const tarif = tarife.find(ta => ta.id === t.tarif_id)
            const preis = t.custom_preis_pro_stunde || tarif?.preis_pro_stunde || 0
            const duration = calculateDuration(t.uhrzeit_von, t.uhrzeit_bis)
            const abrechnungsart = t.custom_abrechnung || tarif?.abrechnung || 'proTraining'
            let betrag = preis * duration
            if (abrechnungsart === 'proSpieler') {
              betrag = betrag / t.spieler_ids.length
            }

            summe += betrag
            if (t.bar_bezahlt) {
              barSumme += betrag
            } else if (t.bezahlt) {
              bezahltSumme += betrag
            } else {
              offeneSumme += betrag
            }
          })

          return {
            ...s,
            trainings: tagTrainings,
            summe,
            barSumme,
            bezahltSumme,
            offeneSumme,
            bezahlt: offeneSumme <= 0
          }
        })
    }

    // Status-Filter (bezahlt/offen/bar)
    switch (filter) {
      case 'bezahlt':
        result = result.filter((s) => s.bezahlt)
        break
      case 'offen':
        result = result.filter((s) => !s.bezahlt)
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
  }, [spielerSummary, filter, filterType, selectedSpielerId, selectedTag, tarife])

  const stats = useMemo(() => {
    const total = filteredSummary.reduce((sum, s) => sum + s.summe, 0)
    const bar = filteredSummary.reduce((sum, s) => sum + s.barSumme, 0)
    const bezahlt = bar + filteredSummary.reduce((sum, s) => sum + s.bezahltSumme, 0)
    const offen = filteredSummary.reduce((sum, s) => sum + s.offeneSumme, 0)
    return { total, bar, bezahlt, offen }
  }, [filteredSummary])

  // Alle Trainings eines Spielers im Monat als bezahlt/offen markieren
  const toggleAlleBezahlt = async (spielerId: string, currentStatus: boolean) => {
    const spielerData = spielerSummary.find(s => s.spieler.id === spielerId)
    if (!spielerData) return

    const trainingIds = spielerData.trainings.map(t => t.id)

    await supabase
      .from('trainings')
      .update({ bezahlt: !currentStatus })
      .in('id', trainingIds)

    onUpdate()
  }

  // Einzelnes Training als bezahlt markieren
  const toggleTrainingBezahlt = async (trainingId: string, currentStatus: boolean) => {
    await supabase
      .from('trainings')
      .update({ bezahlt: !currentStatus })
      .eq('id', trainingId)

    onUpdate()
  }

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Gesamtumsatz</div>
          <div className="stat-value">{stats.total.toFixed(2)} €</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Bar bezahlt</div>
          <div className="stat-value">{stats.bar.toFixed(2)} €</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Bezahlt</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {stats.bezahlt.toFixed(2)} €
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Offen</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
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
                <select
                  className="form-control"
                  value={selectedSpielerId}
                  onChange={(e) => setSelectedSpielerId(e.target.value)}
                  style={{ width: 'auto', minWidth: 150 }}
                >
                  <option value="">Spieler wählen...</option>
                  {spielerSummary.map(s => (
                    <option key={s.spieler.id} value={s.spieler.id}>
                      {s.spieler.name}
                    </option>
                  ))}
                </select>
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
            <button className="btn btn-primary" onClick={() => setShowInvoiceModal(true)}>
              Rechnung erstellen
            </button>
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
                    <span className={`status-badge ${item.bezahlt ? 'durchgefuehrt' : 'geplant'}`}>
                      {item.bezahlt ? 'Bezahlt' : 'Offen'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleAlleBezahlt(item.spieler.id, item.bezahlt)
                      }}
                    >
                      {item.bezahlt ? 'Alle offen' : 'Alle bezahlt'}
                    </button>
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
                <span className={`status-badge ${item.bezahlt ? 'durchgefuehrt' : 'geplant'}`}>
                  {item.bezahlt ? 'Bezahlt' : 'Offen'}
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
                  {item.bezahlt ? 'Alle offen' : 'Alle bezahlt'}
                </button>
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

        // Filtere Trainings nach Tag wenn Tag-Filter aktiv
        const gefilterteTrainings = filterType === 'tag' && selectedTag
          ? detail.trainings.filter(t => t.datum === selectedTag)
          : detail.trainings

        // Berechne Betrag pro Training
        const trainingsDetail = gefilterteTrainings.map(t => {
          const tarif = tarife.find(ta => ta.id === t.tarif_id)
          const preis = t.custom_preis_pro_stunde || tarif?.preis_pro_stunde || 0
          const duration = calculateDuration(t.uhrzeit_von, t.uhrzeit_bis)
          const abrechnungsart = t.custom_abrechnung || tarif?.abrechnung || 'proTraining'
          let betrag = preis * duration
          if (abrechnungsart === 'proSpieler') {
            betrag = betrag / t.spieler_ids.length
          }
          return { training: t, betrag, tarif }
        }).sort((a, b) => a.training.datum.localeCompare(b.training.datum))

        // Berechne gefilterte Summen
        const gefilterteSumme = trainingsDetail.reduce((sum, t) => sum + t.betrag, 0)
        const gefilterteBarSumme = trainingsDetail.filter(t => t.training.bar_bezahlt).reduce((sum, t) => sum + t.betrag, 0)
        const gefilterteBezahltSumme = trainingsDetail.filter(t => t.training.bezahlt && !t.training.bar_bezahlt).reduce((sum, t) => sum + t.betrag, 0)
        const gefilterteOffeneSumme = trainingsDetail.filter(t => !t.training.bezahlt && !t.training.bar_bezahlt).reduce((sum, t) => sum + t.betrag, 0)

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
                <div className="table-container" style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Datum</th>
                        <th>Uhrzeit</th>
                        <th>Tarif</th>
                        <th style={{ textAlign: 'right' }}>Betrag</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trainingsDetail.map(({ training, betrag, tarif }) => {
                        return (
                          <tr
                            key={training.id}
                            style={{
                              cursor: 'pointer',
                              ...(training.bar_bezahlt
                                ? { background: 'var(--warning-light)' }
                                : training.bezahlt
                                ? { background: 'var(--success-light)' }
                                : {})
                            }}
                            onClick={() => {
                              setSelectedSpielerDetail(null)
                              onNavigateToTraining(training)
                            }}
                            title="Klicken um im Kalender zu bearbeiten"
                          >
                            <td style={{ color: 'var(--primary)' }}>{formatDateGerman(training.datum)}</td>
                            <td>{formatTime(training.uhrzeit_von)} - {formatTime(training.uhrzeit_bis)}</td>
                            <td>{tarif?.name || '-'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 500 }}>{betrag.toFixed(2)} €</td>
                            <td style={{ textAlign: 'center' }}>
                              {training.bar_bezahlt ? (
                                <span className="status-badge" style={{ background: 'var(--warning)', color: '#000', fontSize: 11 }}>
                                  Bar
                                </span>
                              ) : (
                                <button
                                  className={`btn btn-sm ${training.bezahlt ? 'btn-success' : 'btn-secondary'}`}
                                  style={{ fontSize: 11, padding: '2px 8px' }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleTrainingBezahlt(training.id, training.bezahlt)
                                  }}
                                >
                                  {training.bezahlt ? 'Bezahlt' : 'Offen'}
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 'bold', background: 'var(--gray-100)' }}>
                        <td colSpan={4}>Summe</td>
                        <td style={{ textAlign: 'right' }}>{gefilterteSumme.toFixed(2)} €</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
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
          onClose={() => {
            setShowInvoiceModal(false)
          }}
        />
      )}
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
  onClose
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
  onClose: () => void
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

  // Manuelle Korrektur (z.B. Regenausfall)
  const [korrekturBetrag, setKorrekturBetrag] = useState('')
  const [korrekturGrund, setKorrekturGrund] = useState('')

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

    return alleTrainings.map(({ training: t, spielerName, spielerId }) => {
      const tarif = tarife.find((ta) => ta.id === t.tarif_id)
      const preis = t.custom_preis_pro_stunde || tarif?.preis_pro_stunde || 0
      const duration = calculateDuration(t.uhrzeit_von, t.uhrzeit_bis)
      const abrechnungsart = t.custom_abrechnung || tarif?.abrechnung || 'proTraining'

      let einzelPreis = preis * duration
      if (abrechnungsart === 'proSpieler') {
        einzelPreis = einzelPreis / t.spieler_ids.length
      }

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

      return {
        datum: t.datum,
        zeit: `${t.uhrzeit_von} - ${t.uhrzeit_bis}`,
        dauer: duration,
        tarifName: tarif?.name || 'Unbekannt',
        spielerName,
        spielerId,
        ustSatz,
        netto,
        ust,
        brutto
      }
    }).sort((a, b) => a.datum.localeCompare(b.datum))
  }, [selectedSummary, verknuepfteSummaries, tarife, kleinunternehmer])

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

  const generatePDF = () => {
    const hatMehrereSpieler = verknuepfteSummaries.length > 0

    // Erstelle Tabellenzeilen für jede Position
    const positionenHtml = rechnungsPositionen.map((p) => `
      <tr>
        <td>${formatDateGerman(p.datum)}</td>
        <td>${p.zeit}</td>
        <td>${p.dauer.toFixed(1)} Std.</td>
        ${hatMehrereSpieler ? `<td>${p.spielerName}</td>` : ''}
        <td>${p.tarifName}</td>
        <td style="text-align: right">${p.netto.toFixed(2)} €</td>
        ${!kleinunternehmer ? `<td style="text-align: right">${p.ust.toFixed(2)} €</td>` : ''}
        <td style="text-align: right">${p.brutto.toFixed(2)} €</td>
      </tr>
    `).join('')

    // Korrekturzeile falls vorhanden
    const korrekturColSpan = hatMehrereSpieler ? 4 : 3
    const korrekturHtml = summen.korrektur !== 0 ? `
      <tr style="background: ${summen.korrektur < 0 ? '#fee2e2' : '#dcfce7'}">
        <td colspan="${korrekturColSpan}"><em>${korrekturGrund || 'Manuelle Korrektur'}</em></td>
        <td><em>Korrektur</em></td>
        <td style="text-align: right">${summen.korrekturNetto >= 0 ? '' : ''}${summen.korrekturNetto.toFixed(2)} €</td>
        ${!kleinunternehmer ? `<td style="text-align: right">${summen.korrekturUst.toFixed(2)} €</td>` : ''}
        <td style="text-align: right">${summen.korrektur >= 0 ? '' : ''}${summen.korrektur.toFixed(2)} €</td>
      </tr>
    ` : ''

    const html = `
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
            @page {
              size: A4;
              margin: 15mm;
            }
          }
        </style>
      </head>
      <body>
        <h1>RECHNUNG</h1>

        <div class="flex">
          <div class="section">
            <strong>Rechnungssteller:</strong><br>
            ${rechnungsstellerName}<br>
            ${rechnungsstellerAdresse.replace(/\n/g, '<br>')}
            ${ustIdNr ? `<br>USt-IdNr: ${ustIdNr}` : ''}
          </div>
          <div class="section" style="text-align: right;">
            <strong>Rechnungsempfänger:</strong><br>
            ${rechnungsempfaengerName}<br>
            ${rechnungsempfaengerAdresse.replace(/\n/g, '<br>')}
          </div>
        </div>

        <div class="section">
          <strong>Rechnungsnummer:</strong> ${rechnungsnummer}<br>
          <strong>Rechnungsdatum:</strong> ${formatDateGerman(rechnungsdatum)}<br>
          <strong>Leistungszeitraum:</strong> ${selectedMonth}
        </div>

        <p>Sehr geehrte Damen und Herren,</p>
        <p>für die im Leistungszeitraum erbrachten Trainerstunden erlaube ich mir, folgende Rechnung zu stellen:</p>

        <table>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Zeit</th>
              <th>Dauer</th>
              ${hatMehrereSpieler ? '<th>Spieler</th>' : ''}
              <th>Tarif</th>
              <th style="text-align: right">Netto</th>
              ${!kleinunternehmer ? '<th style="text-align: right">USt</th>' : ''}
              <th style="text-align: right">Brutto</th>
            </tr>
          </thead>
          <tbody>
            ${positionenHtml}
            ${korrekturHtml}
          </tbody>
        </table>

        <div class="total">
          <div class="total-row">
            <span>Nettobetrag:</span>
            <span>${summen.gesamtNetto.toFixed(2)} €</span>
          </div>
          ${!kleinunternehmer ? `
          <div class="total-row">
            <span>USt (19%):</span>
            <span>${summen.gesamtUst.toFixed(2)} €</span>
          </div>
          ` : ''}
          <div class="total-row highlight">
            <span>Gesamtbetrag:</span>
            <span>${summen.gesamtBrutto.toFixed(2)} €</span>
          </div>
        </div>

        ${kleinunternehmer ? '<p><em>Gemäß §19 UStG wird keine Umsatzsteuer berechnet.</em></p>' : ''}

        <div class="footer">
          <p>Bitte überweisen Sie den Betrag innerhalb von 14 Tagen auf folgendes Konto:</p>
          <p>
            <strong>IBAN:</strong> ${iban}<br>
            <strong>Kontoinhaber:</strong> ${rechnungsstellerName}
          </p>
          <p>Vielen Dank für die Zusammenarbeit.</p>
          <p>Mit freundlichen Grüßen<br>${rechnungsstellerName}</p>
        </div>
      </body>
      </html>
    `

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
                          <tr key={i}>
                            <td>{formatDateGerman(p.datum)}</td>
                            <td>{p.zeit}</td>
                            {verknuepfteSummaries.length > 0 && <td>{p.spielerName}</td>}
                            <td>{p.tarifName}</td>
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
        </div>
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
            <button className="btn btn-primary" onClick={generatePDF}>
              PDF erstellen
            </button>
          )}
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
    if (!confirm('Plan wirklich löschen?')) return

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

// ============ BUCHHALTUNG VIEW ============
function BuchhaltungView({
  trainings,
  tarife,
  spieler,
  ausgaben,
  profile,
  onUpdate,
  userId,
  userEmail
}: {
  trainings: Training[]
  tarife: Tarif[]
  spieler: Spieler[]
  ausgaben: Ausgabe[]
  profile: TrainerProfile | null
  onUpdate: () => void
  userId: string
  userEmail: string
}) {
  const isAdmin = userEmail === 'arturiva03@gmail.com'
  const [activeSubTab, setActiveSubTab] = useState<'einnahmen' | 'ausgaben' | 'ust' | 'euer'>('einnahmen')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [zeitraumTyp, setZeitraumTyp] = useState<'monat' | 'quartal'>('monat')
  const [showAusgabeModal, setShowAusgabeModal] = useState(false)
  const [editingAusgabe, setEditingAusgabe] = useState<Ausgabe | null>(null)
  const [inclBarEinnahmen, setInclBarEinnahmen] = useState(true)

  const kleinunternehmer = profile?.kleinunternehmer ?? false

  // Verfügbare Jahre berechnen
  const verfuegbareJahre = useMemo(() => {
    const jahre = new Set<number>()
    trainings.forEach(t => jahre.add(parseInt(t.datum.substring(0, 4))))
    ausgaben.forEach(a => jahre.add(parseInt(a.datum.substring(0, 4))))
    jahre.add(new Date().getFullYear())
    return Array.from(jahre).sort((a, b) => b - a)
  }, [trainings, ausgaben])

  // Einnahmen aus bezahlten Trainings berechnen
  const einnahmenPositionen = useMemo(() => {
    const bezahlteTrainings = trainings.filter(t => {
      if (t.status !== 'durchgefuehrt') return false
      if (!t.datum.startsWith(selectedYear.toString())) return false
      // Prüfe Zahlungsstatus basierend auf Bar-Einnahmen-Filter
      if (inclBarEinnahmen) {
        return t.bezahlt || t.bar_bezahlt
      } else {
        return t.bezahlt && !t.bar_bezahlt
      }
    })

    return bezahlteTrainings.flatMap(t => {
      const tarif = tarife.find(ta => ta.id === t.tarif_id)
      const preis = t.custom_preis_pro_stunde || tarif?.preis_pro_stunde || 0
      const duration = calculateDuration(t.uhrzeit_von, t.uhrzeit_bis)
      const abrechnungsart = t.custom_abrechnung || tarif?.abrechnung || 'proTraining'

      return t.spieler_ids.map(spielerId => {
        let einzelPreis = preis * duration
        if (abrechnungsart === 'proSpieler') {
          einzelPreis = einzelPreis / t.spieler_ids.length
        }

        const inklUst = tarif?.inkl_ust ?? true
        const ustSatz = tarif?.ust_satz ?? 19

        let netto: number, ust: number, brutto: number

        if (kleinunternehmer || ustSatz === 0) {
          netto = einzelPreis
          ust = 0
          brutto = einzelPreis
        } else if (inklUst) {
          brutto = einzelPreis
          netto = brutto / (1 + ustSatz / 100)
          ust = brutto - netto
        } else {
          netto = einzelPreis
          ust = netto * (ustSatz / 100)
          brutto = netto + ust
        }

        const sp = spieler.find(s => s.id === spielerId)

        return {
          trainingId: t.id,
          datum: t.datum,
          spielerName: sp?.name || 'Unbekannt',
          tarifName: tarif?.name || 'Standard',
          brutto,
          netto,
          ust,
          ustSatz,
          barBezahlt: t.bar_bezahlt
        }
      })
    }).sort((a, b) => a.datum.localeCompare(b.datum))
  }, [trainings, tarife, spieler, selectedYear, kleinunternehmer, inclBarEinnahmen])

  // Einnahmen nach Monat gruppiert
  const einnahmenNachMonat = useMemo(() => {
    const grouped: { [monat: string]: typeof einnahmenPositionen } = {}

    einnahmenPositionen.forEach(e => {
      const monat = e.datum.substring(0, 7)
      if (!grouped[monat]) grouped[monat] = []
      grouped[monat].push(e)
    })

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monat, positionen]) => ({
        monat,
        positionen,
        summeNetto: positionen.reduce((s, p) => s + p.netto, 0),
        summeBrutto: positionen.reduce((s, p) => s + p.brutto, 0),
        summeUst: positionen.reduce((s, p) => s + p.ust, 0)
      }))
  }, [einnahmenPositionen])

  // Ausgaben des Jahres
  const jahresAusgaben = useMemo(() => {
    return ausgaben.filter(a => a.datum.startsWith(selectedYear.toString()))
  }, [ausgaben, selectedYear])

  // USt-Berechnung
  const ustBerechnung = useMemo(() => {
    if (kleinunternehmer) return []

    const perioden: {
      periode: string
      label: string
      einnahmenUst: number
      vorsteuer: number
      zahllast: number
    }[] = []

    if (zeitraumTyp === 'monat') {
      for (let m = 1; m <= 12; m++) {
        const monatStr = `${selectedYear}-${m.toString().padStart(2, '0')}`
        const monatEinnahmen = einnahmenPositionen.filter(e => e.datum.startsWith(monatStr))
        const monatAusgaben = jahresAusgaben.filter(a => a.datum.startsWith(monatStr))

        const einnahmenUst = monatEinnahmen.reduce((s, e) => s + e.ust, 0)
        const vorsteuer = monatAusgaben
          .filter(a => a.hat_vorsteuer)
          .reduce((s, a) => s + (a.betrag * a.vorsteuer_satz / (100 + a.vorsteuer_satz)), 0)

        perioden.push({
          periode: monatStr,
          label: formatMonthGerman(monatStr),
          einnahmenUst,
          vorsteuer,
          zahllast: einnahmenUst - vorsteuer
        })
      }
    } else {
      for (let q = 1; q <= 4; q++) {
        const startMonth = (q - 1) * 3 + 1
        const endMonth = q * 3
        const quartalEinnahmen = einnahmenPositionen.filter(e => {
          const month = parseInt(e.datum.substring(5, 7))
          return month >= startMonth && month <= endMonth
        })
        const quartalAusgaben = jahresAusgaben.filter(a => {
          const month = parseInt(a.datum.substring(5, 7))
          return month >= startMonth && month <= endMonth
        })

        const einnahmenUst = quartalEinnahmen.reduce((s, e) => s + e.ust, 0)
        const vorsteuer = quartalAusgaben
          .filter(a => a.hat_vorsteuer)
          .reduce((s, a) => s + (a.betrag * a.vorsteuer_satz / (100 + a.vorsteuer_satz)), 0)

        perioden.push({
          periode: `${selectedYear}-Q${q}`,
          label: formatQuartal(selectedYear, q),
          einnahmenUst,
          vorsteuer,
          zahllast: einnahmenUst - vorsteuer
        })
      }
    }

    return perioden
  }, [einnahmenPositionen, jahresAusgaben, selectedYear, zeitraumTyp, kleinunternehmer])

  // EÜR-Berechnung
  const euerZeilen = useMemo(() => {
    const zeilen: {
      periode: string
      label: string
      einnahmenNetto: number
      ausgabenNetto: number
      gewinn: number
    }[] = []

    if (zeitraumTyp === 'monat') {
      for (let m = 1; m <= 12; m++) {
        const monatStr = `${selectedYear}-${m.toString().padStart(2, '0')}`
        const monatEinnahmen = einnahmenPositionen.filter(e => e.datum.startsWith(monatStr))
        const monatAusgaben = jahresAusgaben.filter(a => a.datum.startsWith(monatStr))

        const einnahmenNetto = monatEinnahmen.reduce((s, e) => s + e.netto, 0)
        const ausgabenNetto = monatAusgaben.reduce((s, a) => {
          if (a.hat_vorsteuer) return s + (a.betrag / (1 + a.vorsteuer_satz / 100))
          return s + a.betrag
        }, 0)

        zeilen.push({
          periode: monatStr,
          label: formatMonthGerman(monatStr),
          einnahmenNetto,
          ausgabenNetto,
          gewinn: einnahmenNetto - ausgabenNetto
        })
      }
    } else {
      for (let q = 1; q <= 4; q++) {
        const startMonth = (q - 1) * 3 + 1
        const endMonth = q * 3
        const quartalEinnahmen = einnahmenPositionen.filter(e => {
          const month = parseInt(e.datum.substring(5, 7))
          return month >= startMonth && month <= endMonth
        })
        const quartalAusgaben = jahresAusgaben.filter(a => {
          const month = parseInt(a.datum.substring(5, 7))
          return month >= startMonth && month <= endMonth
        })

        const einnahmenNetto = quartalEinnahmen.reduce((s, e) => s + e.netto, 0)
        const ausgabenNetto = quartalAusgaben.reduce((s, a) => {
          if (a.hat_vorsteuer) return s + (a.betrag / (1 + a.vorsteuer_satz / 100))
          return s + a.betrag
        }, 0)

        zeilen.push({
          periode: `${selectedYear}-Q${q}`,
          label: formatQuartal(selectedYear, q),
          einnahmenNetto,
          ausgabenNetto,
          gewinn: einnahmenNetto - ausgabenNetto
        })
      }
    }

    return zeilen
  }, [einnahmenPositionen, jahresAusgaben, selectedYear, zeitraumTyp])

  // Gesamtsummen
  const gesamtEinnahmenNetto = einnahmenPositionen.reduce((s, e) => s + e.netto, 0)
  const gesamtEinnahmenBrutto = einnahmenPositionen.reduce((s, e) => s + e.brutto, 0)
  const gesamtEinnahmenUst = einnahmenPositionen.reduce((s, e) => s + e.ust, 0)
  const gesamtAusgabenBrutto = jahresAusgaben.reduce((s, a) => s + a.betrag, 0)
  const gesamtAusgabenNetto = jahresAusgaben.reduce((s, a) => {
    if (a.hat_vorsteuer) return s + (a.betrag / (1 + a.vorsteuer_satz / 100))
    return s + a.betrag
  }, 0)
  const gesamtVorsteuer = jahresAusgaben
    .filter(a => a.hat_vorsteuer)
    .reduce((s, a) => s + (a.betrag * a.vorsteuer_satz / (100 + a.vorsteuer_satz)), 0)

  // Tabs für Navigation - USt nur wenn kein Kleinunternehmer
  const availableTabs = kleinunternehmer
    ? (['einnahmen', 'ausgaben', 'euer'] as const)
    : (['einnahmen', 'ausgaben', 'ust', 'euer'] as const)

  return (
    <div>
      {/* Tab Navigation wie in Verwaltung */}
      <div className="tabs">
        {availableTabs.map(tab => (
          <button
            key={tab}
            className={`tab ${activeSubTab === tab ? 'active' : ''}`}
            onClick={() => setActiveSubTab(tab)}
          >
            {tab === 'einnahmen' ? 'Einnahmen' :
             tab === 'ausgaben' ? 'Ausgaben' :
             tab === 'ust' ? 'USt' : 'EÜR'}
          </button>
        ))}
      </div>

      {/* Filter-Optionen */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Jahr</label>
            <select
              className="form-control"
              value={selectedYear}
              onChange={e => setSelectedYear(parseInt(e.target.value))}
            >
              {verfuegbareJahre.map(j => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>
          {(activeSubTab === 'ust' || activeSubTab === 'euer') && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Zeitraum</label>
              <select
                className="form-control"
                value={zeitraumTyp}
                onChange={e => setZeitraumTyp(e.target.value as 'monat' | 'quartal')}
              >
                <option value="monat">Monatlich</option>
                <option value="quartal">Quartalsweise</option>
              </select>
            </div>
          )}
          {isAdmin && (activeSubTab === 'einnahmen' || activeSubTab === 'euer') && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 0 }}>
              <input
                type="checkbox"
                checked={inclBarEinnahmen}
                onChange={e => setInclBarEinnahmen(e.target.checked)}
              />
              Bar-Einnahmen einbeziehen
            </label>
          )}
        </div>
      </div>

      {/* Einnahmen Tab */}
      {activeSubTab === 'einnahmen' && (
        <div className="card">
          <div className="card-header">
            <h3>Einnahmen {selectedYear}</h3>
            <div style={{ textAlign: 'right' }}>
              <div>Gesamt Netto: <strong>{gesamtEinnahmenNetto.toFixed(2)} €</strong></div>
              {!kleinunternehmer && <div>Gesamt USt: <strong>{gesamtEinnahmenUst.toFixed(2)} €</strong></div>}
              <div>Gesamt Brutto: <strong>{gesamtEinnahmenBrutto.toFixed(2)} €</strong></div>
            </div>
          </div>

          {einnahmenNachMonat.length === 0 ? (
            <div className="empty-state">Keine Einnahmen in {selectedYear}</div>
          ) : (
            einnahmenNachMonat.map(({ monat, positionen, summeNetto, summeBrutto, summeUst }) => (
              <div key={monat} style={{ marginBottom: 24 }}>
                <h4 style={{ margin: '16px 0 8px', color: 'var(--gray-700)' }}>
                  {formatMonthGerman(monat)}
                </h4>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Datum</th>
                        <th>Spieler</th>
                        <th>Tarif</th>
                        <th style={{ textAlign: 'right' }}>Netto</th>
                        {!kleinunternehmer && <th style={{ textAlign: 'right' }}>USt</th>}
                        <th style={{ textAlign: 'right' }}>Brutto</th>
                        <th>Zahlart</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positionen.map((p, i) => (
                        <tr key={i}>
                          <td>{formatDateGerman(p.datum)}</td>
                          <td>{p.spielerName}</td>
                          <td>{p.tarifName}</td>
                          <td style={{ textAlign: 'right' }}>{p.netto.toFixed(2)} €</td>
                          {!kleinunternehmer && (
                            <td style={{ textAlign: 'right' }}>{p.ust.toFixed(2)} € ({p.ustSatz}%)</td>
                          )}
                          <td style={{ textAlign: 'right' }}>{p.brutto.toFixed(2)} €</td>
                          <td>
                            <span className={`status-badge ${p.barBezahlt ? 'abgesagt' : 'durchgefuehrt'}`}
                                  style={{ fontSize: 11 }}>
                              {p.barBezahlt ? 'Bar' : 'Überweisung'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 'bold', background: 'var(--gray-100)' }}>
                        <td colSpan={3}>Summe {formatMonthGerman(monat)}</td>
                        <td style={{ textAlign: 'right' }}>{summeNetto.toFixed(2)} €</td>
                        {!kleinunternehmer && <td style={{ textAlign: 'right' }}>{summeUst.toFixed(2)} €</td>}
                        <td style={{ textAlign: 'right' }}>{summeBrutto.toFixed(2)} €</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Ausgaben Tab */}
      {activeSubTab === 'ausgaben' && (
        <div className="card">
          <div className="card-header">
            <h3>Ausgaben {selectedYear}</h3>
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditingAusgabe(null)
                setShowAusgabeModal(true)
              }}
            >
              + Neue Ausgabe
            </button>
          </div>

          <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
            <div>Gesamt Brutto: <strong>{gesamtAusgabenBrutto.toFixed(2)} €</strong></div>
            <div>Gesamt Netto: <strong>{gesamtAusgabenNetto.toFixed(2)} €</strong></div>
            {!kleinunternehmer && <div>Vorsteuer: <strong>{gesamtVorsteuer.toFixed(2)} €</strong></div>}
          </div>

          {jahresAusgaben.length === 0 ? (
            <div className="empty-state">Keine Ausgaben in {selectedYear}</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Kategorie</th>
                    <th>Beschreibung</th>
                    <th style={{ textAlign: 'right' }}>Brutto</th>
                    {!kleinunternehmer && <th style={{ textAlign: 'right' }}>Vorsteuer</th>}
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {jahresAusgaben.map(a => {
                    const vorsteuer = a.hat_vorsteuer
                      ? a.betrag * a.vorsteuer_satz / (100 + a.vorsteuer_satz)
                      : 0
                    return (
                      <tr key={a.id}>
                        <td>{formatDateGerman(a.datum)}</td>
                        <td>{AUSGABE_KATEGORIEN.find(k => k.value === a.kategorie)?.label || a.kategorie}</td>
                        <td>{a.beschreibung || '-'}</td>
                        <td style={{ textAlign: 'right' }}>{a.betrag.toFixed(2)} €</td>
                        {!kleinunternehmer && (
                          <td style={{ textAlign: 'right' }}>
                            {a.hat_vorsteuer ? `${vorsteuer.toFixed(2)} € (${a.vorsteuer_satz}%)` : '-'}
                          </td>
                        )}
                        <td>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => {
                              setEditingAusgabe(a)
                              setShowAusgabeModal(true)
                            }}
                          >
                            Bearbeiten
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* USt Tab */}
      {activeSubTab === 'ust' && (
        <div className="card">
          <div className="card-header">
            <h3>Umsatzsteuer {selectedYear}</h3>
          </div>

          {kleinunternehmer ? (
            <div className="empty-state" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              Als Kleinunternehmer bist du von der Umsatzsteuer befreit (§19 UStG).
            </div>
          ) : (
            <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Zeitraum</th>
                      <th style={{ textAlign: 'right' }}>USt (Einnahmen)</th>
                      <th style={{ textAlign: 'right' }}>Vorsteuer (Ausgaben)</th>
                      <th style={{ textAlign: 'right' }}>Zahllast</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ustBerechnung.map(p => (
                      <tr key={p.periode}>
                        <td>{p.label}</td>
                        <td style={{ textAlign: 'right' }}>{p.einnahmenUst.toFixed(2)} €</td>
                        <td style={{ textAlign: 'right' }}>{p.vorsteuer.toFixed(2)} €</td>
                        <td style={{
                          textAlign: 'right',
                          fontWeight: 500,
                          color: p.zahllast < 0 ? 'var(--success)' : 'inherit'
                        }}>
                          {p.zahllast.toFixed(2)} €
                          {p.zahllast < 0 && ' (Erstattung)'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 'bold', background: 'var(--gray-100)' }}>
                      <td>Gesamt {selectedYear}</td>
                      <td style={{ textAlign: 'right' }}>{gesamtEinnahmenUst.toFixed(2)} €</td>
                      <td style={{ textAlign: 'right' }}>{gesamtVorsteuer.toFixed(2)} €</td>
                      <td style={{
                        textAlign: 'right',
                        color: (gesamtEinnahmenUst - gesamtVorsteuer) < 0 ? 'var(--success)' : 'inherit'
                      }}>
                        {(gesamtEinnahmenUst - gesamtVorsteuer).toFixed(2)} €
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* EÜR Tab */}
      {activeSubTab === 'euer' && (
        <div className="card">
          <div className="card-header">
            <h3>Einnahme-Überschuss-Rechnung {selectedYear}</h3>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Zeitraum</th>
                  <th style={{ textAlign: 'right' }}>Einnahmen (netto)</th>
                  <th style={{ textAlign: 'right' }}>Ausgaben (netto)</th>
                  <th style={{ textAlign: 'right' }}>Gewinn/Verlust</th>
                </tr>
              </thead>
              <tbody>
                {euerZeilen.map(z => (
                  <tr key={z.periode}>
                    <td>{z.label}</td>
                    <td style={{ textAlign: 'right' }}>{z.einnahmenNetto.toFixed(2)} €</td>
                    <td style={{ textAlign: 'right' }}>{z.ausgabenNetto.toFixed(2)} €</td>
                    <td style={{
                      textAlign: 'right',
                      fontWeight: 500,
                      color: z.gewinn >= 0 ? 'var(--success)' : 'var(--danger)'
                    }}>
                      {z.gewinn >= 0 ? '+' : ''}{z.gewinn.toFixed(2)} €
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 'bold', background: 'var(--gray-100)' }}>
                  <td>Gesamt {selectedYear}</td>
                  <td style={{ textAlign: 'right' }}>{gesamtEinnahmenNetto.toFixed(2)} €</td>
                  <td style={{ textAlign: 'right' }}>{gesamtAusgabenNetto.toFixed(2)} €</td>
                  <td style={{
                    textAlign: 'right',
                    color: (gesamtEinnahmenNetto - gesamtAusgabenNetto) >= 0 ? 'var(--success)' : 'var(--danger)'
                  }}>
                    {(gesamtEinnahmenNetto - gesamtAusgabenNetto) >= 0 ? '+' : ''}
                    {(gesamtEinnahmenNetto - gesamtAusgabenNetto).toFixed(2)} €
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Ausgabe Modal */}
      {showAusgabeModal && (
        <AusgabeModal
          ausgabe={editingAusgabe}
          onClose={() => {
            setShowAusgabeModal(false)
            setEditingAusgabe(null)
          }}
          onSave={() => {
            setShowAusgabeModal(false)
            setEditingAusgabe(null)
            onUpdate()
          }}
          userId={userId}
        />
      )}
    </div>
  )
}

// ============ AUSGABE MODAL ============
function AusgabeModal({
  ausgabe,
  onClose,
  onSave,
  userId
}: {
  ausgabe: Ausgabe | null
  onClose: () => void
  onSave: () => void
  userId: string
}) {
  const [datum, setDatum] = useState(ausgabe?.datum || formatDate(new Date()))
  const [betrag, setBetrag] = useState(ausgabe?.betrag?.toString() || '')
  const [kategorie, setKategorie] = useState<Ausgabe['kategorie']>(ausgabe?.kategorie || 'sonstiges')
  const [beschreibung, setBeschreibung] = useState(ausgabe?.beschreibung || '')
  const [hatVorsteuer, setHatVorsteuer] = useState(ausgabe?.hat_vorsteuer || false)
  const [vorsteuerSatz, setVorsteuerSatz] = useState(ausgabe?.vorsteuer_satz || 19)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!betrag || parseFloat(betrag) <= 0) {
      alert('Bitte einen gültigen Betrag eingeben')
      return
    }

    setSaving(true)
    try {
      const data = {
        datum,
        betrag: parseFloat(betrag),
        kategorie,
        beschreibung: beschreibung || null,
        hat_vorsteuer: hatVorsteuer,
        vorsteuer_satz: hatVorsteuer ? vorsteuerSatz : 0
      }

      if (ausgabe) {
        await supabase.from('ausgaben').update(data).eq('id', ausgabe.id)
      } else {
        await supabase.from('ausgaben').insert({ ...data, user_id: userId })
      }

      onSave()
    } catch (err) {
      console.error('Error saving ausgabe:', err)
      alert('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!ausgabe) return
    if (!confirm('Diese Ausgabe wirklich löschen?')) return

    try {
      await supabase.from('ausgaben').delete().eq('id', ausgabe.id)
      onSave()
    } catch (err) {
      console.error('Error deleting ausgabe:', err)
      alert('Fehler beim Löschen')
    }
  }

  // Vorsteuer berechnen für Anzeige
  const vorsteuerBetrag = hatVorsteuer && betrag
    ? (parseFloat(betrag) * vorsteuerSatz / (100 + vorsteuerSatz))
    : 0
  const nettoBetrag = betrag
    ? (hatVorsteuer ? parseFloat(betrag) - vorsteuerBetrag : parseFloat(betrag))
    : 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{ausgabe ? 'Ausgabe bearbeiten' : 'Neue Ausgabe'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Datum</label>
            <input
              type="date"
              className="form-control"
              value={datum}
              onChange={e => setDatum(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Betrag (brutto)</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              value={betrag}
              onChange={e => setBetrag(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="form-group">
            <label>Kategorie</label>
            <select
              className="form-control"
              value={kategorie}
              onChange={e => setKategorie(e.target.value as Ausgabe['kategorie'])}
            >
              {AUSGABE_KATEGORIEN.map(k => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Beschreibung</label>
            <input
              type="text"
              className="form-control"
              value={beschreibung}
              onChange={e => setBeschreibung(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={hatVorsteuer}
                onChange={e => setHatVorsteuer(e.target.checked)}
              />
              Mit Vorsteuer
            </label>
          </div>

          {hatVorsteuer && (
            <div className="form-group">
              <label>Vorsteuer-Satz</label>
              <select
                className="form-control"
                value={vorsteuerSatz}
                onChange={e => setVorsteuerSatz(parseInt(e.target.value))}
              >
                <option value={19}>19%</option>
                <option value={7}>7%</option>
              </select>
            </div>
          )}

          {betrag && parseFloat(betrag) > 0 && (
            <div style={{ padding: 12, background: 'var(--gray-100)', borderRadius: 8, marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Brutto:</span>
                <strong>{parseFloat(betrag).toFixed(2)} €</strong>
              </div>
              {hatVorsteuer && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>Vorsteuer ({vorsteuerSatz}%):</span>
                    <strong>{vorsteuerBetrag.toFixed(2)} €</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Netto:</span>
                    <strong>{nettoBetrag.toFixed(2)} €</strong>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          {ausgabe && (
            <button className="btn btn-danger" onClick={handleDelete} style={{ marginRight: 'auto' }}>
              Löschen
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ WEITERES VIEW ============
function WeiteresView({
  profile,
  notizen,
  onUpdate,
  userId
}: {
  profile: TrainerProfile | null
  notizen: Notiz[]
  onUpdate: () => void
  userId: string
}) {
  const [activeSubTab, setActiveSubTab] = useState<'profil' | 'notizen'>('profil')
  const [showNotizModal, setShowNotizModal] = useState(false)
  const [editingNotiz, setEditingNotiz] = useState<Notiz | null>(null)

  // Profile form
  const [name, setName] = useState(profile?.name || '')
  const [nachname, setNachname] = useState(profile?.nachname || '')
  const [adresse, setAdresse] = useState(profile?.adresse || '')
  const [stundensatz, setStundensatz] = useState(profile?.stundensatz?.toString() || '25')
  const [iban, setIban] = useState(profile?.iban || '')
  const [ustIdNr, setUstIdNr] = useState(profile?.ust_id_nr || '')
  const [kleinunternehmer, setKleinunternehmer] = useState(profile?.kleinunternehmer || false)
  const [notiz, setNotiz] = useState(profile?.notiz || '')
  const [saving, setSaving] = useState(false)

  const saveProfile = async () => {
    setSaving(true)
    try {
      const data = {
        name,
        nachname: nachname || null,
        adresse: adresse || null,
        stundensatz: parseFloat(stundensatz),
        iban: iban || null,
        ust_id_nr: ustIdNr || null,
        kleinunternehmer,
        notiz: notiz || null,
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
              <label>Standard-Stundensatz (€)</label>
              <input
                type="number"
                className="form-control"
                value={stundensatz}
                onChange={(e) => setStundensatz(e.target.value)}
              />
            </div>
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
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>USt-IdNr (optional)</label>
              <input
                type="text"
                className="form-control"
                value={ustIdNr}
                onChange={(e) => setUstIdNr(e.target.value)}
              />
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
          </div>

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
    </div>
  )
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
    if (!confirm('Notiz wirklich löschen?')) return

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

export default App
