import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabaseClient'
import type { User, Session } from '@supabase/supabase-js'
import type {
  TrainerProfile,
  Spieler,
  Tarif,
  Training,
  Trainer,
  Payment,
  MonthlyAdjustment,
  Notiz,
  PlanungSheet,
  PlanungData,
  Tab
} from './types'
import {
  formatDate,
  formatDateGerman,
  formatTime,
  getWeekDates,
  getMonthString,
  calculateDuration,
  generateRechnungsnummer,
  WOCHENTAGE,
  WOCHENTAGE_LANG
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
            kleinunternehmer: false
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

  // Data states
  const [profile, setProfile] = useState<TrainerProfile | null>(null)
  const [spieler, setSpieler] = useState<Spieler[]>([])
  const [tarife, setTarife] = useState<Tarif[]>([])
  const [trainings, setTrainings] = useState<Training[]>([])
  const [trainer, setTrainer] = useState<Trainer[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [adjustments, setAdjustments] = useState<MonthlyAdjustment[]>([])
  const [notizen, setNotizen] = useState<Notiz[]>([])
  const [planungSheets, setPlanungSheets] = useState<PlanungSheet[]>([])
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
        paymentsRes,
        adjustmentsRes,
        notizenRes,
        planungRes
      ] = await Promise.all([
        supabase.from('trainer_profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('spieler').select('*').eq('user_id', user.id).order('name'),
        supabase.from('tarife').select('*').eq('user_id', user.id).order('name'),
        supabase.from('trainings').select('*').eq('user_id', user.id).order('datum', { ascending: false }),
        supabase.from('trainer').select('*').eq('user_id', user.id).order('name'),
        supabase.from('payments').select('*').eq('user_id', user.id),
        supabase.from('monthly_adjustments').select('*').eq('user_id', user.id),
        supabase.from('notizen').select('*').eq('user_id', user.id).order('erstellt_am', { ascending: false }),
        supabase.from('planung_sheets').select('*').eq('user_id', user.id).order('created_at')
      ])

      if (profileRes.data) setProfile(profileRes.data)
      if (spielerRes.data) setSpieler(spielerRes.data)
      if (tarifeRes.data) setTarife(tarifeRes.data)
      if (trainingsRes.data) setTrainings(trainingsRes.data)
      if (trainerRes.data) setTrainer(trainerRes.data)
      if (paymentsRes.data) setPayments(paymentsRes.data)
      if (adjustmentsRes.data) setAdjustments(adjustmentsRes.data)
      if (notizenRes.data) setNotizen(notizenRes.data)
      if (planungRes.data) setPlanungSheets(planungRes.data)
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setDataLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const baseTabs = [
    { id: 'kalender' as Tab, label: 'Kalender', icon: '📅' },
    { id: 'training' as Tab, label: 'Training', icon: '🎾' },
    { id: 'verwaltung' as Tab, label: 'Verwaltung', icon: '👥' },
    { id: 'abrechnung' as Tab, label: 'Abrechnung', icon: '💰' },
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

  return (
    <div className="app-container">
      {/* Mobile Header */}
      <div className="mobile-header">
        <button className="burger-btn" onClick={() => setSidebarOpen(true)}>☰</button>
        <h2>Trainer Planner</h2>
        <div style={{ width: 40 }} />
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
              />
            )}
            {activeTab === 'training' && (
              <TrainingView
                trainings={trainings}
                spieler={spieler}
                tarife={tarife}
                onUpdate={loadAllData}
                userId={user.id}
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
                payments={payments}
                adjustments={adjustments}
                profile={profile}
                onUpdate={loadAllData}
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
  userId
}: {
  trainings: Training[]
  spieler: Spieler[]
  tarife: Tarif[]
  onUpdate: () => void
  userId: string
}) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week')
  const [editingTraining, setEditingTraining] = useState<Training | null>(null)

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

  const getSpielerNames = (ids: string[]) => {
    return ids
      .map((id) => spieler.find((s) => s.id === id)?.name || 'Unbekannt')
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

  return (
    <div>
      <div className="card">
        <div className="calendar-header">
          <div className="calendar-nav">
            <button className="btn btn-secondary" onClick={() => isDayView ? navigateDay(-1) : navigateWeek(-1)}>←</button>
            <button className="btn btn-primary" onClick={goToToday}>Heute</button>
            <button className="btn btn-secondary" onClick={() => isDayView ? navigateDay(1) : navigateWeek(1)}>→</button>
          </div>
          {!isDayView && (
            <h3>
              {weekDates[0].toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })} -
              {weekDates[6].toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
            </h3>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
              <button
                className={`tab ${viewMode === 'week' ? 'active' : ''}`}
                onClick={() => setViewMode('week')}
              >
                Woche
              </button>
              <button
                className={`tab ${viewMode === 'day' ? 'active' : ''}`}
                onClick={() => setViewMode('day')}
              >
                Tag
              </button>
            </div>
            <button className="btn btn-primary" onClick={() => setShowAddTraining(true)}>
              + Training
            </button>
          </div>
        </div>

        {/* Day View Header */}
        {isDayView && (
          <div className="day-view-header">
            <div className="day-name">
              {WOCHENTAGE_LANG[currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1]}
            </div>
            <div className="day-date">{currentDate.getDate()}</div>
            <div className="day-month">
              {currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
            </div>
          </div>
        )}

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
                          <div className="training-title">{getSpielerNames(training.spieler_ids)}</div>
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

// ============ TRAINING VIEW ============
function TrainingView({
  trainings,
  spieler,
  tarife,
  onUpdate,
  userId
}: {
  trainings: Training[]
  spieler: Spieler[]
  tarife: Tarif[]
  onUpdate: () => void
  userId: string
}) {
  const [showModal, setShowModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredTrainings = useMemo(() => {
    if (!searchTerm) return trainings.slice(0, 50)
    const term = searchTerm.toLowerCase()
    return trainings.filter((t) => {
      const spielerNames = t.spieler_ids
        .map((id) => spieler.find((s) => s.id === id)?.name || '')
        .join(' ')
        .toLowerCase()
      return spielerNames.includes(term) || t.datum.includes(term)
    }).slice(0, 50)
  }, [trainings, spieler, searchTerm])

  const getSpielerNames = (ids: string[]) => {
    return ids
      .map((id) => spieler.find((s) => s.id === id)?.name || 'Unbekannt')
      .join(', ')
  }

  const getTarifName = (id?: string) => {
    if (!id) return '-'
    return tarife.find((t) => t.id === id)?.name || '-'
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3>Trainings</h3>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Neues Training
          </button>
        </div>

        <div className="search-box">
          <input
            type="text"
            placeholder="Suche nach Spieler oder Datum..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Zeit</th>
                <th>Spieler</th>
                <th>Tarif</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrainings.map((training) => (
                <tr key={training.id}>
                  <td>{formatDateGerman(training.datum)}</td>
                  <td>{formatTime(training.uhrzeit_von)} - {formatTime(training.uhrzeit_bis)}</td>
                  <td>{getSpielerNames(training.spieler_ids)}</td>
                  <td>{getTarifName(training.tarif_id)}</td>
                  <td>
                    <span className={`status-badge ${training.status}`}>
                      {training.status === 'geplant' ? 'Geplant' :
                        training.status === 'durchgefuehrt' ? 'Durchgeführt' : 'Abgesagt'}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-secondary">Bearbeiten</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <TrainingModal
          spieler={spieler}
          tarife={tarife}
          userId={userId}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false)
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
  const [wiederholenBis, setWiederholenBis] = useState('')
  const [saving, setSaving] = useState(false)

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
        await supabase.from('trainings').update(trainingData).eq('id', training.id)
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
    if (!confirm('Training wirklich löschen?')) return

    await supabase.from('trainings').delete().eq('id', training.id)
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
                onChange={(e) => setUhrzeitVon(e.target.value)}
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

          <div className="table-container">
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

          <div className="table-container">
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
  const [email, setEmail] = useState(spieler?.kontakt_email || '')
  const [telefon, setTelefon] = useState(spieler?.kontakt_telefon || '')
  const [adresse, setAdresse] = useState(spieler?.rechnungs_adresse || '')
  const [notizen, setNotizen] = useState(spieler?.notizen || '')
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
        kontakt_email: email || null,
        kontakt_telefon: telefon || null,
        rechnungs_adresse: adresse || null,
        notizen: notizen || null
      }

      if (spieler) {
        await supabase.from('spieler').update(data).eq('id', spieler.id)
      } else {
        await supabase.from('spieler').insert(data)
      }
      onSave()
    } catch (err) {
      console.error('Error saving spieler:', err)
      alert('Fehler beim Speichern')
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
  const [saving, setSaving] = useState(false)

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
  payments,
  adjustments,
  profile,
  onUpdate,
  userId
}: {
  trainings: Training[]
  spieler: Spieler[]
  tarife: Tarif[]
  payments: Payment[]
  adjustments: MonthlyAdjustment[]
  profile: TrainerProfile | null
  onUpdate: () => void
  userId: string
}) {
  const [selectedMonth, setSelectedMonth] = useState(getMonthString(new Date()))
  const [filter, setFilter] = useState<'alle' | 'bezahlt' | 'offen' | 'bar'>('alle')
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)

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
        if (t.bar_bezahlt) {
          summary[spielerId].barSumme += spielerPreis
        }
      })
    })

    // Apply adjustments and payments
    Object.keys(summary).forEach((spielerId) => {
      const payment = payments.find(
        (p) => p.spieler_id === spielerId && p.monat === selectedMonth
      )
      const adjustment = adjustments.find(
        (a) => a.spieler_id === spielerId && a.monat === selectedMonth
      )

      summary[spielerId].bezahlt = payment?.bezahlt || false
      summary[spielerId].adjustment = adjustment?.betrag || 0
      summary[spielerId].summe += summary[spielerId].adjustment
    })

    return Object.values(summary)
  }, [monthTrainings, spieler, tarife, payments, adjustments, selectedMonth])

  const filteredSummary = useMemo(() => {
    switch (filter) {
      case 'bezahlt':
        return spielerSummary.filter((s) => s.bezahlt)
      case 'offen':
        return spielerSummary.filter((s) => !s.bezahlt)
      case 'bar':
        return spielerSummary.filter((s) => s.barSumme > 0)
      default:
        return spielerSummary
    }
  }, [spielerSummary, filter])

  const stats = useMemo(() => {
    const total = spielerSummary.reduce((sum, s) => sum + s.summe, 0)
    const bar = spielerSummary.reduce((sum, s) => sum + s.barSumme, 0)
    const bezahlt = spielerSummary.filter((s) => s.bezahlt).reduce((sum, s) => sum + s.summe, 0)
    const offen = total - bezahlt
    return { total, bar, bezahlt, offen }
  }, [spielerSummary])

  const toggleBezahlt = async (spielerId: string, currentStatus: boolean) => {
    const existingPayment = payments.find(
      (p) => p.spieler_id === spielerId && p.monat === selectedMonth
    )

    if (existingPayment) {
      await supabase
        .from('payments')
        .update({ bezahlt: !currentStatus })
        .eq('id', existingPayment.id)
    } else {
      await supabase.from('payments').insert({
        user_id: userId,
        monat: selectedMonth,
        spieler_id: spielerId,
        bezahlt: true
      })
    }
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
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <input
              type="month"
              className="form-control"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ width: 'auto' }}
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
          </div>
          <button className="btn btn-primary" onClick={() => setShowInvoiceModal(true)}>
            Rechnung erstellen
          </button>
        </div>

        <div className="table-container">
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
                <tr key={item.spieler.id}>
                  <td>{item.spieler.name}</td>
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
                      onClick={() => toggleBezahlt(item.spieler.id, item.bezahlt)}
                    >
                      {item.bezahlt ? 'Als offen' : 'Als bezahlt'}
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
      </div>

      {/* Invoice Modal */}
      {showInvoiceModal && (
        <InvoiceModal
          spieler={spieler}
          spielerSummary={spielerSummary}
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
  profile,
  selectedMonth,
  onClose
}: {
  spieler: Spieler[]
  spielerSummary: {
    spieler: Spieler
    trainings: Training[]
    summe: number
    bezahlt: boolean
  }[]
  profile: TrainerProfile | null
  selectedMonth: string
  onClose: () => void
}) {
  const [step, setStep] = useState(1)
  const [selectedSpielerId, setSelectedSpielerId] = useState('')
  const [rechnungsbetrag, setRechnungsbetrag] = useState('')
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
  const [position, setPosition] = useState('Trainerstunden')

  useEffect(() => {
    if (selectedSpielerId) {
      const summary = spielerSummary.find((s) => s.spieler.id === selectedSpielerId)
      const sp = spieler.find((s) => s.id === selectedSpielerId)
      if (summary && sp) {
        // Offenen Umsatz als Rechnungsbetrag übernehmen
        setRechnungsbetrag(summary.summe.toFixed(2))
        setRechnungsempfaengerName(sp.name)
        setRechnungsempfaengerAdresse(sp.rechnungs_adresse || '')
      }
    }
  }, [selectedSpielerId, spielerSummary, spieler])

  const zwischensumme = parseFloat(rechnungsbetrag) || 0
  const mwst = kleinunternehmer ? 0 : zwischensumme * 0.19
  const gesamtbetrag = zwischensumme + mwst

  const generatePDF = () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Rechnung ${rechnungsnummer}</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.6; }
          h1 { text-align: center; margin-bottom: 40px; }
          .section { margin-bottom: 20px; }
          .flex { display: flex; justify-content: space-between; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background: #f5f5f5; }
          .total { text-align: right; margin-top: 20px; }
          .footer { margin-top: 40px; }
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
          <div class="section">
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
              <th>Position</th>
              <th>Betrag</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${position}</td>
              <td>${zwischensumme.toFixed(2)} €</td>
            </tr>
          </tbody>
        </table>

        <div class="total">
          <strong>Nettobetrag:</strong> ${zwischensumme.toFixed(2)} €<br>
          ${!kleinunternehmer ? `<strong>MwSt. 19%:</strong> ${mwst.toFixed(2)} €<br>` : ''}
          <strong>Gesamtbetrag:</strong> ${gesamtbetrag.toFixed(2)} €
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

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.print()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
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
                  {spielerSummary.filter(s => s.summe > 0).map((s) => (
                    <option key={s.spieler.id} value={s.spieler.id}>
                      {s.spieler.name} - {s.summe.toFixed(2)} € offen
                    </option>
                  ))}
                </select>
              </div>
              {selectedSpielerId && (
                <div className="form-group" style={{ background: 'var(--success-light)', padding: 12, borderRadius: 'var(--radius)' }}>
                  <label style={{ color: 'var(--success)', marginBottom: 4 }}>Rechnungsbetrag (offener Betrag übernommen)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={rechnungsbetrag}
                    onChange={(e) => setRechnungsbetrag(e.target.value)}
                    step="0.01"
                    style={{ fontWeight: 600, fontSize: 18 }}
                  />
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
                  Kleinunternehmer (§19 UStG)
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
              <div className="form-group">
                <label>Position</label>
                <input
                  type="text"
                  className="form-control"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                />
              </div>

              <div style={{ background: 'var(--gray-100)', padding: 16, borderRadius: 'var(--radius)', marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Nettobetrag:</span>
                  <strong>{zwischensumme.toFixed(2)} €</strong>
                </div>
                {!kleinunternehmer && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>MwSt. 19%:</span>
                    <strong>{mwst.toFixed(2)} €</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, marginTop: 8 }}>
                  <span>Gesamtbetrag:</span>
                  <strong>{gesamtbetrag.toFixed(2)} €</strong>
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

        <div className="table-container">
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
