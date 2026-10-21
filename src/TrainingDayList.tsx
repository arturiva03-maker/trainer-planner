import { useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabaseClient'
import type { Spieler, Training } from './types'

type Status = Training['status']

const statusLabels: Record<Status, string> = {
  geplant: 'Geplant', durchgefuehrt: 'Durchgeführt',
  durchgefuehrt_halb: 'Durchgeführt · 50 %', abgesagt: 'Abgesagt'
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

const formatGap = (gap: number) =>
  gap >= 60 ? `${Math.floor(gap / 60)} h${gap % 60 ? ` ${gap % 60} min` : ''}` : `${gap} min`

const countLabel = (n: number) => `${n} ${n === 1 ? 'Training' : 'Trainings'}`

// Zeile, die sich nach rechts (durchgeführt) oder links (abgesagt) wischen laesst.
// touch-action: pan-y laesst vertikales Scrollen beim Browser, horizontale
// Bewegungen kommen als Pointer-Events hier an.
function SwipeRow({ canRight, canLeft, disabled, onRight, onLeft, children }: {
  canRight: boolean
  canLeft: boolean
  disabled: boolean
  onRight: () => Promise<void>
  onLeft: () => Promise<void>
  children: ReactNode
}) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number, y: number, axis: 'x' | 'y' | null } | null>(null)
  const swiped = useRef(false)
  const surface = useRef<HTMLDivElement>(null)
  const enabled = !disabled && (canRight || canLeft)
  const width = surface.current?.offsetWidth || 320
  const threshold = Math.min(110, width * 0.3)

  const finish = async (action: () => Promise<void>, direction: 1 | -1) => {
    setDx(direction * width)
    await action()
    setDx(0)
  }

  return <div className={`day-list-swipe${dragging ? ' is-dragging' : ''}`}>
    {dx !== 0 && <div className={`day-list-swipe-bg ${dx > 0 ? 'is-done' : 'is-cancel'}${Math.abs(dx) >= threshold ? ' is-armed' : ''}`} aria-hidden="true">
      <span>{dx > 0 ? 'Durchgeführt' : 'Abgesagt'}</span>
    </div>}
    <div ref={surface} className="day-list-item" style={{ transform: dx ? `translateX(${dx}px)` : undefined, touchAction: enabled ? 'pan-y' : undefined }}
      onPointerDown={e => {
        swiped.current = false
        if (!enabled || e.button !== 0) return
        start.current = { x: e.clientX, y: e.clientY, axis: null }
      }}
      onPointerMove={e => {
        const s = start.current
        if (!s) return
        const moveX = e.clientX - s.x, moveY = e.clientY - s.y
        if (!s.axis) {
          if (Math.abs(moveX) > 8 && Math.abs(moveX) > Math.abs(moveY)) {
            s.axis = 'x'
            setDragging(true)
            e.currentTarget.setPointerCapture(e.pointerId)
          } else if (Math.abs(moveY) > 8) {
            start.current = null
            return
          }
        }
        if (s.axis !== 'x') return
        const allowed = moveX > 0 ? canRight : canLeft
        setDx(allowed ? moveX : moveX * 0.15)
      }}
      onPointerUp={() => {
        const s = start.current
        start.current = null
        if (!s || s.axis !== 'x') return
        swiped.current = true
        setDragging(false)
        if (dx >= threshold && canRight) void finish(onRight, 1)
        else if (dx <= -threshold && canLeft) void finish(onLeft, -1)
        else setDx(0)
      }}
      onPointerCancel={() => { start.current = null; setDragging(false); setDx(0) }}
      onClickCapture={e => {
        if (!swiped.current) return
        swiped.current = false
        e.preventDefault()
        e.stopPropagation()
      }}>
      {children}
    </div>
  </div>
}

export function TrainingDayList({ trainings, spieler, date, userId, onEdit, onUpdate }: {
  trainings: Training[]
  spieler: Spieler[]
  date: Date
  userId: string
  onEdit: (training: Training) => void
  onUpdate: () => void | Promise<void>
}) {
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [undo, setUndo] = useState<{ ids: string[], status: Status } | null>(null)
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const rows = trainings.filter(t => t.datum === day && t.user_id === userId)
    .sort((a, b) => a.uhrzeit_von.localeCompare(b.uhrzeit_von) || a.id.localeCompare(b.id))
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const refresh = () => setNow(new Date())
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  const eligible = rows.filter(t => t.status === 'geplant' &&
    new Date(`${t.datum}T${t.uhrzeit_bis}`).getTime() <= now.getTime())
  const selectedIds = eligible.filter(t => selected.has(t.id)).map(t => t.id)
  const doneCount = rows.filter(t => t.status === 'durchgefuehrt' || t.status === 'durchgefuehrt_halb').length
  const hasPlanned = rows.some(t => t.status === 'geplant')

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  // Setzt Trainings von `from` auf `to`. Die Status-Bedingung verhindert, dass
  // zwischenzeitlich anderweitig geaenderte Trainings ueberschrieben werden.
  async function save(ids: string[], to: Status, from: Status, isUndo = false) {
    if (locked.current || ids.length === 0) return
    locked.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { data, error: dbError } = await supabase.from('trainings')
        .update({ status: to })
        .eq('user_id', userId).eq('status', from)
        .in('id', ids).select('id')
      if (dbError) throw dbError
      const changed = (data || []).map(t => t.id as string)
      setUndo(isUndo || changed.length === 0 ? null : { ids: changed, status: to })
      setSelected(new Set())
      setSelecting(false)
      setMessage(changed.length === 0 ? 'Keine Änderung: Die Trainings wurden inzwischen geändert.'
        : isUndo ? `${countLabel(changed.length)} wieder auf geplant gesetzt.`
        : to === 'abgesagt' ? `${countLabel(changed.length)} abgesagt.`
        : `${countLabel(changed.length)} abgeschlossen.`)
      if (changed.length < ids.length && changed.length > 0) {
        setError('Einige Trainings wurden inzwischen geändert und deshalb ausgelassen.')
      }
      await onUpdate()
    } catch {
      setError('Speichern fehlgeschlagen. Bitte Verbindung prüfen und erneut versuchen.')
    } finally {
      locked.current = false
      setBusy(false)
    }
  }

  return <section className="training-day-list" aria-label="Trainings des Tages" aria-busy={busy}>
    <div className="day-list-toolbar">
      <p>
        {rows.length === 0 ? 'Kein Training' : countLabel(rows.length)}
        {doneCount > 0 && ` · ${doneCount} erledigt`}
        {eligible.length > 0 && ` · ${eligible.length} offen`}
      </p>
      {eligible.length > 1 && <button className="day-list-link" disabled={busy} aria-pressed={selecting}
        onClick={() => { setSelecting(!selecting); setSelected(new Set()) }}>
        {selecting ? 'Fertig' : 'Mehrere abschließen'}
      </button>}
    </div>
    {selecting && <button className="day-list-link" disabled={busy}
      onClick={() => setSelected(new Set(eligible.map(t => t.id)))}>Alle offenen auswählen</button>}
    {(busy || message) && <div className="day-list-feedback" role="status">
      <span>{busy ? 'Wird gespeichert …' : message}</span>
      {undo && <button className="day-list-link" disabled={busy}
        onClick={() => void save(undo.ids, 'geplant', undo.status, true)}>Rückgängig</button>}
    </div>}
    {error && <p className="day-list-error" role="alert">{error}</p>}
    {rows.length === 0 && <p className="day-list-empty">Keine Trainings an diesem Tag.</p>}
    <ul className="day-list-rows">
      {rows.map((t, index) => {
        const canComplete = eligible.some(item => item.id === t.id)
        const isSelected = selected.has(t.id)
        const names = t.spieler_ids.map(id => spieler.find(s => s.id === id)?.name || 'Unbekannter Spieler').join(', ')
        const title = t.name || names || 'Training ohne Teilnehmer'
        const duration = toMinutes(t.uhrzeit_bis) - toMinutes(t.uhrzeit_von)
        const previous = rows[index - 1]
        const gap = previous ? toMinutes(t.uhrzeit_von) - toMinutes(previous.uhrzeit_bis) : 0
        const running = t.status === 'geplant' &&
          now.getTime() >= new Date(`${t.datum}T${t.uhrzeit_von}`).getTime() &&
          now.getTime() < new Date(`${t.datum}T${t.uhrzeit_bis}`).getTime()
        const label = `${t.uhrzeit_von.slice(0, 5)} ${title}`
        const statusText = running ? 'läuft gerade' : t.status !== 'geplant' ? statusLabels[t.status] : ''
        return <li key={t.id} className={`day-list-row status-${t.status}${isSelected ? ' is-selected' : ''}${running ? ' is-running' : ''}`}>
          {gap >= 30 && <p className="day-list-gap">{formatGap(gap)} frei</p>}
          <SwipeRow canRight={canComplete} canLeft={t.status === 'geplant'} disabled={busy || selecting}
            onRight={() => save([t.id], 'durchgefuehrt', 'geplant')}
            onLeft={() => save([t.id], 'abgesagt', 'geplant')}>
            <button className="day-list-main" disabled={busy || (selecting && !canComplete)}
              aria-pressed={selecting ? isSelected : undefined}
              aria-label={selecting ? `${label} auswählen` : `${label} bearbeiten`}
              onClick={() => selecting ? toggle(t.id) : onEdit(t)}>
              <span className="day-list-time">
                <strong>{t.uhrzeit_von.slice(0, 5)}</strong>
                <span>{t.uhrzeit_bis.slice(0, 5)}</span>
              </span>
              <span className="day-list-detail">
                <span className="day-list-title">{title}</span>
                {t.name && names && <span className="day-list-names">{names}</span>}
                <span className="day-list-meta">
                  {duration} min{statusText && <> · <span className="day-list-status">{statusText}</span></>}
                </span>
              </span>
            </button>
            {selecting && canComplete && <span className={`day-list-check${isSelected ? ' is-on' : ''}`} aria-hidden="true" />}
          </SwipeRow>
        </li>
      })}
    </ul>
    {hasPlanned && !selecting && <p className="day-list-hint">
      Nach rechts wischen: durchgeführt · nach links: abgesagt
    </p>}
    {selecting && <div className="day-list-bulk">
      <button className="btn btn-primary" disabled={busy || selectedIds.length === 0}
        onClick={() => void save(selectedIds, 'durchgefuehrt', 'geplant')}>
        {selectedIds.length === 1 ? '1 Training' : `${selectedIds.length} Trainings`} abschließen
      </button>
    </div>}
  </section>
}
