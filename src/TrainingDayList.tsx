import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import type { Spieler, Training } from './types'

const statusLabels: Record<Training['status'], string> = {
  geplant: 'Geplant', durchgefuehrt: 'Durchgeführt',
  durchgefuehrt_halb: 'Durchgeführt · 50 %', abgesagt: 'Abgesagt'
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
  const [undoIds, setUndoIds] = useState<string[]>([])
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const rows = trainings.filter(t => t.datum === day && t.user_id === userId)
    .sort((a, b) => a.uhrzeit_von.localeCompare(b.uhrzeit_von) || a.id.localeCompare(b.id))
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const refresh = () => setNow(new Date())
    const timer = window.setInterval(refresh, 1000)
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
      <p>{rows.length} Trainings · {eligible.length} zum Abschließen</p>
      <button className="btn" disabled={busy || eligible.length === 0} aria-pressed={selecting}
        onClick={() => { setSelecting(!selecting); setSelected(new Set()) }}>
        {selecting ? 'Auswahl beenden' : 'Auswählen'}
      </button>
    </div>
    {selecting && <button className="btn day-list-select-all" disabled={busy}
      onClick={() => setSelected(new Set(eligible.map(t => t.id)))}>Alle vergangenen auswählen</button>}
    <div className="day-list-feedback" role="status">
      {busy ? 'Wird gespeichert …' : message}
      {undoIds.length > 0 && <button className="btn" disabled={busy}
        onClick={() => void save(undoIds, true)}>Rückgängig</button>}
    </div>
    {error && <p className="day-list-error" role="alert">{error}</p>}
    {rows.length === 0 && <p className="day-list-empty">Keine Trainings an diesem Tag.</p>}
    <ul className="day-list-rows">
      {rows.map(t => {
        const canComplete = eligible.some(item => item.id === t.id)
        const names = t.spieler_ids.map(id => spieler.find(s => s.id === id)?.name || 'Unbekannter Spieler').join(', ')
        return <li key={t.id} className={`day-list-row${selected.has(t.id) ? ' is-selected' : ''}`}>
          {selecting && <label className="day-list-checkbox">
            <input type="checkbox" disabled={busy || !canComplete} checked={selected.has(t.id)}
              aria-label={`${t.uhrzeit_von.slice(0, 5)} ${t.name || names} auswählen`}
              onChange={e => { const checked = e.target.checked; setSelected(prev => {
                const next = new Set(prev)
                if (checked) next.add(t.id); else next.delete(t.id)
                return next
              }) }} />
          </label>}
          <div className="day-list-detail">
            <p className="day-list-time">{t.uhrzeit_von.slice(0, 5)}–{t.uhrzeit_bis.slice(0, 5)}</p>
            <h4>{t.name || names || 'Training ohne Teilnehmer'}</h4>
            {t.name && names && <p className="day-list-names">{names}</p>}
            <span className={`status-badge ${t.status}`}>{statusLabels[t.status]}</span>
          </div>
          <div className="day-list-actions">
            {!selecting && canComplete && <button className="btn btn-primary" disabled={busy}
              aria-label={`${t.uhrzeit_von.slice(0, 5)} ${t.name || names} als durchgeführt markieren`}
              onClick={() => void save([t.id])}>Durchgeführt</button>}
            <button className="btn" disabled={busy} onClick={() => onEdit(t)}
              aria-label={`${t.uhrzeit_von.slice(0, 5)} ${t.name || names} bearbeiten`}>Bearbeiten</button>
          </div>
        </li>
      })}
    </ul>
    {selecting && <div className="day-list-bulk">
      <button className="btn btn-primary" disabled={busy || selectedIds.length === 0}
        onClick={() => void save(selectedIds)}>{selectedIds.length} Trainings abschließen</button>
    </div>}
  </section>
}
