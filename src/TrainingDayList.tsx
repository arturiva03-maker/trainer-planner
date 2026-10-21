import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import type { Spieler, Training } from './types'

const statusLabels: Record<Training['status'], string> = {
  geplant: 'Geplant', durchgefuehrt: 'Durchgeführt',
  durchgefuehrt_halb: 'Durchgeführt · 50 %', abgesagt: 'Abgesagt'
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

const formatGap = (gap: number) =>
  gap >= 60 ? `${Math.floor(gap / 60)} h${gap % 60 ? ` ${gap % 60} min` : ''}` : `${gap} min`

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
  const [undoIds, setUndoIds] = useState<string[]>([])
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

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  async function save(ids: string[], undo = false) {
    if (locked.current || ids.length === 0) return
    locked.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { data, error: dbError } = await supabase.from('trainings')
        .update({ status: undo ? 'geplant' : 'durchgefuehrt' })
        .eq('user_id', userId).eq('status', undo ? 'durchgefuehrt' : 'geplant')
        .in('id', ids).select('id')
      if (dbError) throw dbError
      const changed = (data || []).map(t => t.id as string)
      if (!undo) setUndoIds(changed)
      else setUndoIds([])
      setSelected(new Set())
      setSelecting(false)
      setMessage(changed.length
        ? undo ? `${changed.length} ${changed.length === 1 ? 'Training' : 'Trainings'} wieder auf geplant gesetzt.` : `${changed.length} ${changed.length === 1 ? 'Training' : 'Trainings'} abgeschlossen.`
        : 'Keine Änderung: Die Trainings wurden inzwischen geändert.')
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
        {rows.length === 0 ? 'Kein Training' : `${rows.length} ${rows.length === 1 ? 'Training' : 'Trainings'}`}
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
      {undoIds.length > 0 && <button className="day-list-link" disabled={busy}
        onClick={() => void save(undoIds, true)}>Rückgängig</button>}
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
          <div className="day-list-item">
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
            {canComplete && (selecting
              ? <span className={`day-list-check${isSelected ? ' is-on' : ''}`} aria-hidden="true" />
              : <button className="day-list-done" disabled={busy} title="Als durchgeführt markieren"
                aria-label={`${label} als durchgeführt markieren`} onClick={() => void save([t.id])}>
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>)}
          </div>
        </li>
      })}
    </ul>
    {selecting && <div className="day-list-bulk">
      <button className="btn btn-primary" disabled={busy || selectedIds.length === 0}
        onClick={() => void save(selectedIds)}>
        {selectedIds.length === 1 ? '1 Training' : `${selectedIds.length} Trainings`} abschließen
      </button>
    </div>}
  </section>
}
